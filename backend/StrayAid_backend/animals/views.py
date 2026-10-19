from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone

from organizations.permissions import IsOrganizationUser
from rescue.models import Case

from .models import AdoptionApplication, Animal, Sponsorship
from .serializers import (
    AdoptionApplicationSerializer,
    AnimalSerializer,
    MyApplicationSerializer,
    NewSponsorshipSerializer,
    SponsorshipSerializer,
)


def _person(user):
    return user.get_full_name() or user.username


def sync_case_with_animal(animal):
    """Keep the rescue case's status in step with the animal's. The animal's own
    notification already tells reporters what happened, so the case change stays quiet."""
    case = animal.case
    case._changed_by_animal = True
    if animal.status == Animal.STATUS_ADOPTABLE and case.status != "adoption":
        case.status = "adoption"
        case.save(update_fields=["status", "updated_at"])
    elif animal.status == Animal.STATUS_ADOPTED and case.status != "closed":
        case.status = "closed"
        case.resolved_at = timezone.now()
        case.save(update_fields=["status", "resolved_at", "updated_at"])
    elif animal.status in [Animal.STATUS_RESCUED, Animal.STATUS_RECOVERING] and case.status != "rescued":
        case.status = "rescued"
        case.save(update_fields=["status", "updated_at"])


class AnimalViewSet(viewsets.ModelViewSet):
    queryset = Animal.objects.select_related("case", "organization", "organization__user")
    serializer_class = AnimalSerializer

    def get_permissions(self):
        # Public users can browse animals, but only organizations can manage them.
        if self.action in ["public", "retrieve"]:
            return [AllowAny()]
        if self.action in ["apply", "sponsor"]:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsOrganizationUser()]

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action in ["public", "retrieve", "apply", "sponsor"]:
            return queryset

        # Organization dashboards should only see animals they manage.
        organization = getattr(self.request.user, "organization_profile", None)
        if organization:
            return queryset.filter(organization=organization)
        return queryset.none()

    def perform_create(self, serializer):
        organization = self.request.user.organization_profile
        case = serializer.validated_data["case"]
        if case.organization_id != organization.id:
            raise serializers.ValidationError({"case": "You can only create animals for your own cases."})
        active_animals = Animal.objects.filter(organization=organization).exclude(status=Animal.STATUS_ADOPTED).count()
        if organization.capacity and active_animals >= organization.capacity:
            raise serializers.ValidationError({"capacity": "Organization animal capacity has been reached."})
        animal = serializer.save(organization=organization)
        # Keep case status in sync with the new public outcome for the animal.
        sync_case_with_animal(animal)

    def perform_update(self, serializer):
        if serializer.instance.organization_id != self.request.user.organization_profile.id:
            raise serializers.ValidationError({"detail": "You can only update your own animals."})
        animal = serializer.save(organization=self.request.user.organization_profile)
        # Updating an animal can reopen or close the linked rescue workflow.
        sync_case_with_animal(animal)

    @action(detail=False, methods=["get"], permission_classes=[AllowAny], url_path="public")
    def public(self, request):
        queryset = super().get_queryset()
        # The public feed supports simple filter chips on the frontend.
        status_filter = request.query_params.get("status")
        organization_id = request.query_params.get("organization_id")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if organization_id:
            queryset = queryset.filter(organization_id=organization_id)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="apply")
    def apply(self, request, pk=None):
        """Send an adoption application (Stitch 14)."""
        animal = self.get_object()
        if animal.status != Animal.STATUS_ADOPTABLE:
            return Response({"detail": f"{animal.name} isn't up for adoption right now."}, status=400)
        if animal.organization and animal.organization.user_id == request.user.id:
            return Response({"detail": "Organizations can't apply to adopt their own animals."}, status=400)
        if animal.adoption_applications.filter(applicant=request.user, status__in=AdoptionApplication.ACTIVE_STATUSES).exists():
            return Response({"detail": f"You've already applied to adopt {animal.name}."}, status=400)

        serializer = AdoptionApplicationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        application = serializer.save(animal=animal, applicant=request.user)

        if animal.organization:
            from notifications.services import notify_users

            notify_users(
                [animal.organization.user_id],
                title="Adoption",
                body=f"**{application.full_name}** wants to adopt **{animal.name}**.",
                data={"type": "adoption_application", "application_id": application.id, "animal_id": animal.id},
            )
        return Response(AdoptionApplicationSerializer(application).data, status=201)

    @action(detail=True, methods=["post"], url_path="sponsor")
    def sponsor(self, request, pk=None):
        """Pledge support (Stitch 16). There's no payment gateway: people transfer to the
        organization's bank account and attach the receipt, and the organization confirms it."""
        animal = self.get_object()
        organization = animal.organization
        if animal.status == Animal.STATUS_ADOPTED:
            return Response({"detail": f"{animal.name} has been adopted and doesn't need sponsors any more."}, status=400)
        if not organization or not organization.bank_account_number:
            return Response({"detail": "This organization hasn't added bank details yet."}, status=400)
        if organization.user_id == request.user.id:
            return Response({"detail": "Organizations can't sponsor their own animals."}, status=400)
        if animal.sponsorships.filter(sponsor=request.user, status="pending").exists():
            return Response({"detail": f"Your last pledge for {animal.name} is still being checked."}, status=400)

        serializer = NewSponsorshipSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        pledge = Sponsorship.objects.create(animal=animal, sponsor=request.user, **serializer.validated_data)

        from notifications.services import notify_users

        amount = f"PKR {pledge.amount_pkr:,}{' a month' if pledge.monthly else ''}"
        data = {"type": "sponsorship", "sponsorship_id": pledge.id, "animal_id": animal.id}
        notify_users(
            [organization.user_id],
            title="Sponsorship",
            body=f"**{_person(request.user)}** pledged {amount} for **{animal.name}**. Check the receipt.",
            data=data,
        )
        notify_users(
            [request.user.id],
            title="Sponsorship",
            body=f"Receipt uploaded for **{animal.name}**. **{organization.name}** will confirm your pledge soon.",
            data=data,
        )
        return Response(SponsorshipSerializer(pledge, context={"request": request}).data, status=201)

    @action(detail=False, methods=["get"], url_path="organization")
    def organization_animals(self, request):
        serializer = self.get_serializer(self.get_queryset(), many=True)
        return Response(serializer.data)


class ApplicationViewSet(viewsets.GenericViewSet):
    """"My Applications" (Stitch 15). People see the applications they sent; organizations
    see the ones sent for their animals and approve or reject them."""

    permission_classes = [IsAuthenticated]
    serializer_class = MyApplicationSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = AdoptionApplication.objects.select_related("animal", "animal__organization", "applicant")
        if getattr(user, "organization_profile", None):
            return queryset.filter(animal__organization__user=user)
        return queryset.filter(applicant=user)

    def list(self, request):
        queryset = self.get_queryset()
        if request.query_params.get("status"):
            queryset = queryset.filter(status=request.query_params["status"])
        return Response(self.get_serializer(queryset, many=True).data)

    def retrieve(self, request, pk=None):
        return Response(self.get_serializer(self.get_object()).data)

    @action(detail=True, methods=["post"], url_path="withdraw")
    def withdraw(self, request, pk=None):
        application = self.get_object()
        if application.applicant_id != request.user.id:
            return Response({"detail": "Only the person who applied can withdraw."}, status=403)
        if application.status not in AdoptionApplication.ACTIVE_STATUSES:
            return Response({"detail": "This application is already closed."}, status=400)
        application.status = "withdrawn"
        application.decided_at = timezone.now()
        application.save(update_fields=["status", "decided_at"])

        from notifications.services import notify_users

        animal = application.animal
        notify_users(
            [animal.organization.user_id] if animal.organization else [],
            title="Adoption",
            body=f"**{application.full_name}** withdrew their application for **{animal.name}**.",
            data={"type": "adoption_withdrawn", "application_id": application.id, "animal_id": animal.id},
        )
        return Response(self.get_serializer(application).data)

    @action(detail=True, methods=["post"], url_path="decide")
    def decide(self, request, pk=None):
        """The organization approves or rejects a pending application."""
        application = self.get_object()
        animal = application.animal
        if not animal.organization or animal.organization.user_id != request.user.id:
            return Response({"detail": "Only the animal's organization can decide."}, status=403)
        decision = request.data.get("status")
        if decision not in ("approved", "rejected"):
            return Response({"detail": "Choose approved or rejected."}, status=400)
        if application.status != "pending":
            return Response({"detail": "Only pending applications can be decided."}, status=400)
        application.status = decision
        application.decided_at = timezone.now()
        application.save(update_fields=["status", "decided_at"])

        from notifications.services import notify_users

        organization = animal.organization.name
        body = (
            f"Your application for **{animal.name}** has been approved! 🎉 **{organization}** will call you to arrange a visit."
            if decision == "approved"
            else f"Your application for **{animal.name}** wasn't approved this time. Thank you for offering a home."
        )
        notify_users(
            [application.applicant_id],
            title="Adoption",
            body=body,
            data={"type": "adoption_decision", "application_id": application.id, "animal_id": animal.id, "status": decision},
        )

        if decision == "approved":
            # The animal is adopted: the other pending applicants are turned down and told,
            # and its reporters and followers hear the news from the animal's own update.
            others = list(animal.adoption_applications.filter(status="pending").exclude(pk=application.pk))
            for other in others:
                other.status = "rejected"
                other.decided_at = application.decided_at
                other.save(update_fields=["status", "decided_at"])
                notify_users(
                    [other.applicant_id],
                    title="Adoption",
                    body=f"**{animal.name}** has found a home with another family. Thank you for offering yours.",
                    data={"type": "adoption_decision", "application_id": other.id, "animal_id": animal.id, "status": "rejected"},
                )
            if animal.status != Animal.STATUS_ADOPTED:
                animal.status = Animal.STATUS_ADOPTED
                animal._skip_notify_user_ids = {application.applicant_id}
                animal.save(update_fields=["status", "updated_at"])
                sync_case_with_animal(animal)
        return Response(self.get_serializer(application).data)


class SponsorshipViewSet(viewsets.GenericViewSet):
    """Pledges you made, or (for organizations) pledges to check against receipts."""

    permission_classes = [IsAuthenticated]
    serializer_class = SponsorshipSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = Sponsorship.objects.select_related("animal", "animal__organization", "sponsor")
        if getattr(user, "organization_profile", None):
            return queryset.filter(animal__organization__user=user)
        return queryset.filter(sponsor=user)

    def list(self, request):
        return Response(self.get_serializer(self.get_queryset(), many=True).data)

    @action(detail=True, methods=["post"], url_path="review")
    def review(self, request, pk=None):
        pledge = self.get_object()
        animal = pledge.animal
        if not animal.organization or animal.organization.user_id != request.user.id:
            return Response({"detail": "Only the animal's organization can check receipts."}, status=403)
        decision = request.data.get("status")
        if decision not in ("confirmed", "rejected"):
            return Response({"detail": "Choose confirmed or rejected."}, status=400)
        if pledge.status != "pending":
            return Response({"detail": "This pledge has already been checked."}, status=400)
        pledge.status = decision
        pledge.save(update_fields=["status"])

        from notifications.services import notify_users

        organization = animal.organization.name
        body = (
            f"**{organization}** confirmed your PKR {pledge.amount_pkr:,} pledge for **{animal.name}**. Thank you! 💚"
            if decision == "confirmed"
            else f"**{organization}** couldn't match your receipt for **{animal.name}**. Message them to sort it out."
        )
        notify_users(
            [pledge.sponsor_id],
            title="Sponsorship",
            body=body,
            data={"type": "sponsorship", "sponsorship_id": pledge.id, "animal_id": animal.id, "status": decision},
        )
        return Response(self.get_serializer(pledge).data)
