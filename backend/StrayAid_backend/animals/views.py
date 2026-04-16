from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone

from organizations.permissions import IsOrganizationUser
from rescue.models import Case

from .models import Animal
from .serializers import AnimalSerializer


class AnimalViewSet(viewsets.ModelViewSet):
    queryset = Animal.objects.select_related("case", "organization", "organization__user")
    serializer_class = AnimalSerializer

    def get_permissions(self):
        if self.action in ["public", "retrieve"]:
            return [AllowAny()]
        return [IsAuthenticated(), IsOrganizationUser()]

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action in ["public", "retrieve"]:
            return queryset

        organization = getattr(self.request.user, "organization_profile", None)
        if organization:
            return queryset.filter(organization=organization)
        return queryset.none()

    def perform_create(self, serializer):
        organization = self.request.user.organization_profile
        case = serializer.validated_data["case"]
        if case.organization_id != organization.id:
            raise serializers.ValidationError({"case": "You can only create animals for your own cases."})
        animal = serializer.save(organization=organization)
        if animal.status == Animal.STATUS_ADOPTABLE:
            case.status = "adoption"
            case.save(update_fields=["status", "updated_at"])
        elif animal.status == Animal.STATUS_ADOPTED:
            case.status = "closed"
            case.resolved_at = timezone.now()
            case.save(update_fields=["status", "resolved_at", "updated_at"])
        elif case.status != "rescued":
            case.status = "rescued"
            case.save(update_fields=["status", "updated_at"])

    def perform_update(self, serializer):
        if serializer.instance.organization_id != self.request.user.organization_profile.id:
            raise serializers.ValidationError({"detail": "You can only update your own animals."})
        animal = serializer.save(organization=self.request.user.organization_profile)
        case = animal.case
        if animal.status == Animal.STATUS_ADOPTABLE and case.status != "adoption":
            case.status = "adoption"
            case.save(update_fields=["status", "updated_at"])
        elif animal.status == Animal.STATUS_ADOPTED:
            case.status = "closed"
            case.resolved_at = timezone.now()
            case.save(update_fields=["status", "resolved_at", "updated_at"])
        elif animal.status in [Animal.STATUS_RESCUED, Animal.STATUS_RECOVERING] and case.status != "rescued":
            case.status = "rescued"
            case.save(update_fields=["status", "updated_at"])

    @action(detail=False, methods=["get"], permission_classes=[AllowAny], url_path="public")
    def public(self, request):
        queryset = super().get_queryset()
        status_filter = request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="organization")
    def organization_animals(self, request):
        serializer = self.get_serializer(self.get_queryset(), many=True)
        return Response(serializer.data)
