from rest_framework import exceptions, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from animals.models import Animal
from organizations.permissions import IsOrganizationUser

from .models import Post
from .serializers import PostSerializer


class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.select_related("animal", "organization", "organization__user")
    serializer_class = PostSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve", "public_feed", "by_animal"]:
            return [AllowAny()]
        return [IsAuthenticated(), IsOrganizationUser()]

    def get_queryset(self):
        queryset = super().get_queryset()
        animal_id = self.request.query_params.get("animal")
        if animal_id:
            queryset = queryset.filter(animal_id=animal_id)
        if self.action not in ["list", "retrieve", "public_feed", "by_animal"]:
            organization = getattr(self.request.user, "organization_profile", None)
            if organization:
                queryset = queryset.filter(organization=organization)
            else:
                queryset = queryset.none()
        return queryset

    def perform_create(self, serializer):
        organization = self.request.user.organization_profile
        animal_id = self.request.data.get("animal")
        animal = Animal.objects.get(id=animal_id, organization=organization)
        serializer.save(organization=organization, animal=animal)

    def perform_update(self, serializer):
        if serializer.instance.organization_id != self.request.user.organization_profile.id:
            raise exceptions.PermissionDenied("You can only update your own posts.")
        serializer.save()

    @action(detail=False, methods=["get"], permission_classes=[AllowAny], url_path="public-feed")
    def public_feed(self, request):
        serializer = self.get_serializer(self.get_queryset(), many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], permission_classes=[AllowAny], url_path="by-animal")
    def by_animal(self, request):
        animal_id = request.query_params.get("animal_id")
        queryset = self.get_queryset()
        if animal_id:
            queryset = queryset.filter(animal_id=animal_id)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
