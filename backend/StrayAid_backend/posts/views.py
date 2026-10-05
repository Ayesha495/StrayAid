from django.db.models import BooleanField, Count, Exists, OuterRef, Value
from rest_framework import exceptions, serializers, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from animals.models import Animal
from organizations.permissions import IsOrganizationUser

from .models import Post, PostLike, Story
from .serializers import PostSerializer, StorySerializer

PUBLIC_ACTIONS = ["list", "retrieve", "public_feed", "by_animal"]


class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.select_related("animal", "organization", "organization__user")
    serializer_class = PostSerializer

    def get_permissions(self):
        # The public feed is open, liking needs any account, and managing updates is organization-only.
        if self.action in PUBLIC_ACTIONS:
            return [AllowAny()]
        if self.action == "like":
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsOrganizationUser()]

    def get_queryset(self):
        # Explicit ordering: Django drops Meta.ordering on queries with aggregate annotations.
        queryset = (
            super()
            .get_queryset()
            .annotate(
                like_count=Count("likes", distinct=True),
                comment_count=Count("comments", distinct=True),
            )
            .order_by("-created_at")
        )
        user = self.request.user
        if user.is_authenticated:
            queryset = queryset.annotate(
                liked_by_me=Exists(PostLike.objects.filter(post=OuterRef("pk"), user=user))
            )
        else:
            queryset = queryset.annotate(liked_by_me=Value(False, output_field=BooleanField()))

        animal_id = self.request.query_params.get("animal")
        if animal_id:
            queryset = queryset.filter(animal_id=animal_id)
        # Private management views should stay scoped to the signed-in organization.
        if self.action not in PUBLIC_ACTIONS + ["like"]:
            organization = getattr(self.request.user, "organization_profile", None)
            if organization:
                queryset = queryset.filter(organization=organization)
            else:
                queryset = queryset.none()
        return queryset

    def perform_create(self, serializer):
        organization = self.request.user.organization_profile
        animal_id = self.request.data.get("animal")
        try:
            animal = Animal.objects.get(id=animal_id, organization=organization)
        except Animal.DoesNotExist as error:
            raise serializers.ValidationError({"animal": "You can only post updates for your own animals."}) from error
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

    @action(detail=True, methods=["post", "delete"], url_path="like")
    def like(self, request, pk=None):
        post = self.get_object()
        if request.method == "POST":
            PostLike.objects.get_or_create(post=post, user=request.user)
        else:
            PostLike.objects.filter(post=post, user=request.user).delete()
        return Response(
            {
                "liked_by_me": request.method == "POST",
                "like_count": PostLike.objects.filter(post=post).count(),
            },
            status=status.HTTP_200_OK,
        )


@api_view(["GET"])
@permission_classes([AllowAny])
def story_groups(request):
    """Active stories grouped by category, newest first within each group."""
    stories = Story.objects.active().select_related("organization")
    serializer_context = {"request": request}
    groups = []
    for category, label in Story.CATEGORY_CHOICES:
        in_category = [story for story in stories if story.category == category]
        if not in_category:
            continue
        groups.append(
            {
                "category": category,
                "label": label,
                "latest_at": in_category[0].created_at,
                "stories": StorySerializer(in_category, many=True, context=serializer_context).data,
            }
        )
    return Response(groups)
