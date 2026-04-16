from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from animals.models import Animal
from posts.models import Post
from rescue.models import Case
from rescue.serializers import CaseSerializer

from .models import Organization
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
        if self.action in ["create", "me"]:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsOrganizationUser()]

    def perform_create(self, serializer):
        if hasattr(self.request.user, "organization_profile"):
            raise serializers.ValidationError({"detail": "Organization profile already exists."})

        if self.request.user.role != "organization":
            self.request.user.role = "organization"
            self.request.user.save(update_fields=["role"])

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
        nearby_cases = (
            Case.objects.select_related("reported_by", "organization")
            .prefetch_related("reports")
            .filter(organization__isnull=True)
            .exclude(status="closed")[:5]
        )

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
