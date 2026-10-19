from django.db.models import Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from animals.models import Animal, Sponsorship
from animals.serializers import AnimalSerializer
from posts.models import Post
from rescue.models import Case
from rescue.serializers import CaseSerializer
from rescue.views import case_is_within_organization_radius

from .models import Organization, ShelterDonation
from .permissions import IsOrganizationUser
from .serializers import OrganizationSerializer


class OrganizationViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Organization.objects.select_related("user")
    serializer_class = OrganizationSerializer

    def get_permissions(self):
        # Public pages can read profiles, but management remains organization-only.
        if self.action in ["retrieve", "animals", "profile", "directory"]:
            return [AllowAny()]
        if self.action in ["create", "me", "donate"]:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsOrganizationUser()]

    def _ensure_organization_role(self):
        if self.request.user.role != "organization":
            self.request.user.role = "organization"
            self.request.user.save(update_fields=["role"])

    def create(self, request, *args, **kwargs):
        organization = getattr(request.user, "organization_profile", None)

        if organization:
            # Treat a repeated create request as profile completion/update.
            serializer = self.get_serializer(organization, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            self._ensure_organization_role()

            save_kwargs = {}
            if not organization.email and not serializer.validated_data.get("email"):
                save_kwargs["email"] = request.user.email

            serializer.save(**save_kwargs)
            return Response(serializer.data, status=status.HTTP_200_OK)

        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        self._ensure_organization_role()

        serializer.save(
            user=self.request.user,
            email=serializer.validated_data.get("email") or self.request.user.email,
        )

    @action(detail=False, methods=["get", "patch"], url_path="me")
    def me(self, request):
        organization = getattr(request.user, "organization_profile", None)
        if request.method == "GET":
            if not organization:
                return Response({"detail": "Organization profile not found."}, status=status.HTTP_404_NOT_FOUND)
            return Response(self.get_serializer(organization).data)

        if not organization:
            return Response({"detail": "Organization profile not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = self.get_serializer(organization, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="dashboard")
    def dashboard(self, request):
        organization = getattr(request.user, "organization_profile", None)
        if not organization:
            return Response({"detail": "Organization profile not found."}, status=status.HTTP_404_NOT_FOUND)

        organization_cases = Case.objects.filter(organization=organization)
        # Nearby cases are limited so the dashboard stays lightweight.
        nearby_queryset = (
            Case.objects.select_related("reported_by", "organization")
            .prefetch_related("reports")
            .filter(organization__isnull=True)
            .exclude(status="closed")
        )
        nearby_cases = [
            case
            for case in nearby_queryset
            if case_is_within_organization_radius(case, organization)
        ][:5]

        data = {
            "organization": self.get_serializer(organization).data,
            "summary": {
                "total_cases": organization_cases.count(),
                "active_cases": organization_cases.exclude(status__in=["closed", "rescued"]).count(),
                "rescued_cases": organization_cases.filter(status="rescued").count(),
                "adoption_cases": organization_cases.filter(status="adoption").count(),
                "animals_count": Animal.objects.filter(organization=organization).count(),
                "posts_count": Post.objects.filter(organization=organization).count(),
            },
            "recent_cases": CaseSerializer(organization_cases[:5], many=True).data,
            "nearby_cases": CaseSerializer(nearby_cases, many=True).data,
        }
        return Response(data)

    @action(detail=False, methods=["get"], url_path="directory")
    def directory(self, request):
        """Every organization's public card, for search and for calling a rescue team when
        the app is offline (the phone numbers are kept on the device)."""
        def image(organization):
            return request.build_absolute_uri(organization.image.url) if organization.image else None

        return Response([
            {
                "id": organization.id,
                "name": organization.name,
                "city": organization.city,
                "address": organization.address,
                "image": image(organization),
                "is_verified": organization.is_verified,
                "is_available": organization.is_available,
                "latitude": organization.latitude,
                "longitude": organization.longitude,
                "phone": organization.phone,
            }
            for organization in Organization.objects.order_by("-is_verified", "name")
        ])

    @action(detail=True, methods=["get"], url_path="profile")
    def profile(self, request, pk=None):
        """The public organization profile: its numbers and this month's supply fund."""
        organization = self.get_object()
        from notifications.models import OrganizationFollow

        animals = Animal.objects.filter(organization=organization)
        month_start = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        donated = organization.donations.filter(status="confirmed", created_at__gte=month_start).aggregate(total=Sum("amount_pkr"))["total"] or 0
        sponsored = (
            Sponsorship.objects.filter(animal__organization=organization, status="confirmed", created_at__gte=month_start)
            .aggregate(total=Sum("amount_pkr"))["total"]
            or 0
        )
        raised = donated + sponsored
        goal = max(organization.supply_goal_pkr, 1)
        user = request.user
        return Response({
            "stats": {
                "rescued": animals.count(),
                "adopted": animals.filter(status=Animal.STATUS_ADOPTED).count(),
                "in_care": animals.exclude(status=Animal.STATUS_ADOPTED).count(),
                "followers": OrganizationFollow.objects.filter(organization=organization).count(),
                "active_cases": Case.objects.filter(organization=organization, status__in=["assigned", "in_progress"]).count(),
            },
            "fund": {
                "month": month_start.strftime("%B"),
                "goal_pkr": organization.supply_goal_pkr,
                "raised_pkr": raised,
                "percent": min(100, round(100 * raised / goal)),
            },
            "type": organization.type,
            "is_available": organization.is_available,
            "following": bool(user.is_authenticated and OrganizationFollow.objects.filter(user=user, organization=organization).exists()),
            "my_pending_donation": bool(
                user.is_authenticated and organization.donations.filter(donor=user, status="pending").exists()
            ),
        })

    @action(detail=True, methods=["post"], url_path="donate")
    def donate(self, request, pk=None):
        """Give to the shelter's medical supplies: transfer, then attach the receipt."""
        organization = self.get_object()
        if not organization.bank_account_number:
            return Response({"detail": "This organization hasn't added bank details yet."}, status=status.HTTP_400_BAD_REQUEST)
        if organization.user_id == request.user.id:
            return Response({"detail": "Organizations can't donate to themselves."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = DonationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        donation = ShelterDonation.objects.create(organization=organization, donor=request.user, **serializer.validated_data)

        from notifications.services import notify_users

        name = request.user.get_full_name() or request.user.username
        data = {"type": "shelter_donation", "donation_id": donation.id, "organization_id": organization.id}
        notify_users([organization.user_id], title="Sponsorship",
                     body=f"**{name}** gave PKR {donation.amount_pkr:,} for medical supplies. Check the receipt.", data=data)
        notify_users([request.user.id], title="Sponsorship",
                     body=f"Receipt uploaded for **{organization.name}**. They'll confirm your gift soon.", data=data)
        return Response({"id": donation.id, "status": donation.status, "amount_pkr": donation.amount_pkr}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], permission_classes=[AllowAny], url_path="animals")
    def animals(self, request, pk=None):
        organization = self.get_object()
        # Public organization pages reuse the animal card data shape.
        animals = (
            Animal.objects.select_related("case", "organization", "organization__user")
            .filter(organization=organization)
        )
        serializer = AnimalSerializer(animals, many=True, context={"request": request})
        return Response(serializer.data)


class DonationSerializer(serializers.Serializer):
    amount_pkr = serializers.IntegerField(
        min_value=100, max_value=500000,
        error_messages={"min_value": "The smallest gift is PKR 100.", "max_value": "For more than PKR 500,000, please contact the organization."},
    )
    receipt = serializers.ImageField(error_messages={"required": "Attach a photo or screenshot of your transfer receipt."})


def donation_row(donation, request):
    donor = donation.donor
    return {
        "id": donation.id,
        "donor_name": donor.get_full_name() or donor.username,
        "organization": {"id": donation.organization_id, "name": donation.organization.name},
        "amount_pkr": donation.amount_pkr,
        "receipt": request.build_absolute_uri(donation.receipt.url) if donation.receipt else None,
        "status": donation.status,
        "created_at": donation.created_at,
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def donations(request):
    """Shelter donations: an organization sees the gifts it received (to check receipts),
    anyone else sees the gifts they gave. ?status=pending|confirmed|rejected filters."""
    organization = getattr(request.user, "organization_profile", None)
    queryset = ShelterDonation.objects.select_related("donor", "organization")
    queryset = queryset.filter(organization=organization) if organization else queryset.filter(donor=request.user)
    if request.query_params.get("status"):
        queryset = queryset.filter(status=request.query_params["status"])
    return Response([donation_row(donation, request) for donation in queryset])


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def review_donation(request, donation_id):
    """The organization confirms or rejects a gift after checking the receipt."""
    donation = get_object_or_404(ShelterDonation.objects.select_related("organization"), pk=donation_id)
    if donation.organization.user_id != request.user.id:
        return Response({"detail": "Only the organization can check its receipts."}, status=status.HTTP_403_FORBIDDEN)
    decision = request.data.get("status")
    if decision not in ("confirmed", "rejected") or donation.status != "pending":
        return Response({"detail": "Choose confirmed or rejected for a pending gift."}, status=status.HTTP_400_BAD_REQUEST)
    donation.status = decision
    donation.save(update_fields=["status"])

    from notifications.services import notify_users

    body = (
        f"**{donation.organization.name}** confirmed your PKR {donation.amount_pkr:,} gift. Thank you! 💚"
        if decision == "confirmed"
        else f"**{donation.organization.name}** couldn't match your receipt. Message them to sort it out."
    )
    notify_users([donation.donor_id], title="Sponsorship", body=body,
                 data={"type": "shelter_donation", "donation_id": donation.id, "organization_id": donation.organization_id})
    return Response({"id": donation.id, "status": donation.status})
