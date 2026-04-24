from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from animals.models import Animal
from animals.serializers import AnimalSerializer
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
        # Public pages can read profiles, but management remains organization-only.
        if self.action in ["retrieve", "animals"]:
            return [AllowAny()]
        if self.action in ["create", "me"]:
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
