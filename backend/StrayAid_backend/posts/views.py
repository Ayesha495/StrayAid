from django.db.models import BooleanField, Count, Exists, F, OuterRef, Prefetch, Value
from django.shortcuts import get_object_or_404
from rest_framework import exceptions, serializers, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from animals.models import Animal
from organizations.permissions import IsOrganizationUser

from .models import CommentLike, Post, PostComment, PostLike, SavedPost, Story, StoryView
from .serializers import CommentSerializer, PostSerializer, StorySerializer

PUBLIC_ACTIONS = ["list", "retrieve", "public_feed", "by_animal", "comments", "share"]
# Actions any signed-in person can use on any organization's posts.
MEMBER_ACTIONS = ["like", "save_post", "saved"]


def comment_context(post, request):
    """What the comment badges need (Stitch 23): the post's organization, the person who
    reported the animal, approved adopters and confirmed sponsors."""
    animal = post.animal
    return {
        "request": request,
        "organization": post.organization,
        "reporter_id": animal.case.reported_by_id if animal.case_id else None,
        "adopter_ids": set(animal.adoption_applications.filter(status="approved").values_list("applicant_id", flat=True)),
        "donor_ids": set(
            animal.sponsorships.model.objects.filter(animal__organization=post.organization, status="confirmed")
            .values_list("sponsor_id", flat=True)
        ),
    }


class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.select_related("animal", "organization", "organization__user")
    serializer_class = PostSerializer

    def get_permissions(self):
        # The public feed is open, liking needs any account, and managing updates is organization-only.
        if self.action == "comments" and self.request.method == "POST":
            return [IsAuthenticated()]
        if self.action in PUBLIC_ACTIONS:
            return [AllowAny()]
        if self.action in MEMBER_ACTIONS:
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
                liked_by_me=Exists(PostLike.objects.filter(post=OuterRef("pk"), user=user)),
                saved_by_me=Exists(SavedPost.objects.filter(post=OuterRef("pk"), user=user)),
            )
        else:
            queryset = queryset.annotate(
                liked_by_me=Value(False, output_field=BooleanField()),
                saved_by_me=Value(False, output_field=BooleanField()),
            )

        animal_id = self.request.query_params.get("animal")
        if animal_id:
            queryset = queryset.filter(animal_id=animal_id)
        # Private management views should stay scoped to the signed-in organization.
        if self.action not in PUBLIC_ACTIONS + MEMBER_ACTIONS:
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
        # Once an animal is adopted it has left the team's care: its posts stay on its own
        # profile (by-animal) as a record, but no longer appear in the community feed.
        queryset = self.get_queryset().exclude(animal__status=Animal.STATUS_ADOPTED)
        serializer = self.get_serializer(queryset, many=True)
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


    @action(detail=True, methods=["get", "post"], url_path="comments")
    def comments(self, request, pk=None):
        """GET the comments sheet (?sort=top|new, pinned first), POST {body, parent} to comment
        or reply (Stitch 23)."""
        post = self.get_object()
        context = comment_context(post, request)
        if request.method == "POST":
            body = (request.data.get("body") or "").strip()
            if not body:
                return Response({"body": ["Write a comment first."]}, status=status.HTTP_400_BAD_REQUEST)
            parent = None
            if request.data.get("parent"):
                parent = get_object_or_404(PostComment, pk=request.data["parent"], post=post)
                # Replies to a reply join the same thread.
                parent = parent.parent or parent
            comment = PostComment.objects.create(post=post, user=request.user, body=body[:1000], parent=parent)
            notify_comment(comment)
            return Response(CommentSerializer(comment, context=context).data, status=status.HTTP_201_CREATED)

        likes = Prefetch("likes", queryset=CommentLike.objects.only("comment_id", "user_id"))
        replies = Prefetch("replies", queryset=PostComment.objects.select_related("user").prefetch_related(likes).order_by("created_at"))
        top_level = list(post.comments.filter(parent__isnull=True).select_related("user").prefetch_related(likes, replies))
        if request.query_params.get("sort") == "new":
            top_level.sort(key=lambda comment: comment.created_at, reverse=True)
        else:
            top_level.sort(key=lambda comment: (len(comment.likes.all()) + len(comment.replies.all()), comment.created_at), reverse=True)
        top_level.sort(key=lambda comment: not comment.is_pinned)
        return Response({
            "count": post.comments.count(),
            "results": CommentSerializer(top_level, many=True, context=context).data,
        })

    @action(detail=True, methods=["post", "delete"], url_path="save")
    def save_post(self, request, pk=None):
        post = self.get_object()
        if request.method == "POST":
            SavedPost.objects.get_or_create(post=post, user=request.user)
        else:
            SavedPost.objects.filter(post=post, user=request.user).delete()
        return Response({"saved_by_me": request.method == "POST"})

    @action(detail=True, methods=["post"], url_path="share")
    def share(self, request, pk=None):
        post = self.get_object()
        Post.objects.filter(pk=post.pk).update(share_count=F("share_count") + 1)
        return Response({"share_count": post.share_count + 1})

    @action(detail=False, methods=["get"], url_path="saved")
    def saved(self, request):
        queryset = self.get_queryset().filter(saves__user=request.user).order_by("-saves__created_at")
        return Response(self.get_serializer(queryset, many=True).data)


def notify_comment(comment):
    """The organization hears about comments on its posts; people hear about replies to theirs."""
    from notifications.services import notify_users

    post = comment.post
    organization = post.organization
    writer = organization.name if comment.user_id == organization.user_id else (comment.user.get_full_name() or comment.user.username)
    data = {"type": "post_comment", "post_id": post.id, "animal_id": post.animal_id, "comment_id": comment.id}
    if comment.user_id != organization.user_id:
        notify_users([organization.user_id], title="Community",
                     body=f"**{writer}** commented on your post about {post.animal.name}.", data=data)
    if comment.parent_id and comment.parent.user_id not in (comment.user_id, organization.user_id):
        notify_users([comment.parent.user_id], title="Community", body=f"**{writer}** replied to your comment.", data=data)


def _own_comment_post(comment, user):
    return comment.post.organization.user_id == user.id


@api_view(["POST", "DELETE"])
@permission_classes([IsAuthenticated])
def comment_like(request, comment_id):
    comment = get_object_or_404(PostComment, pk=comment_id)
    if request.method == "POST":
        CommentLike.objects.get_or_create(comment=comment, user=request.user)
    else:
        CommentLike.objects.filter(comment=comment, user=request.user).delete()
    return Response({"liked_by_me": request.method == "POST", "like_count": comment.likes.count()})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def comment_pin(request, comment_id):
    """The post's organization pins (or unpins) one top-level comment."""
    comment = get_object_or_404(PostComment.objects.select_related("post__organization"), pk=comment_id)
    if not _own_comment_post(comment, request.user):
        return Response({"detail": "Only the organization that posted can pin comments."}, status=status.HTTP_403_FORBIDDEN)
    if comment.parent_id:
        return Response({"detail": "Only top-level comments can be pinned."}, status=status.HTTP_400_BAD_REQUEST)
    pinned = not comment.is_pinned
    PostComment.objects.filter(post=comment.post, is_pinned=True).update(is_pinned=False)
    if pinned:
        PostComment.objects.filter(pk=comment.pk).update(is_pinned=True)
    return Response({"is_pinned": pinned})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def comment_delete(request, comment_id):
    comment = get_object_or_404(PostComment.objects.select_related("post__organization"), pk=comment_id)
    if comment.user_id != request.user.id and not _own_comment_post(comment, request.user):
        return Response({"detail": "You can only delete your own comments."}, status=status.HTTP_403_FORBIDDEN)
    comment.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


def _create_story(request):
    """A 24-hour story (multipart: category, image, headline, caption, optional animal_id).
    The animal has to be one of the organization's own."""
    organization = getattr(request.user, "organization_profile", None)
    if not IsOrganizationUser().has_permission(request, None) or not organization:
        return Response({"detail": "Only organizations can share stories."}, status=status.HTTP_403_FORBIDDEN)
    animal = None
    if request.data.get("animal_id"):
        animal = get_object_or_404(Animal, pk=request.data["animal_id"])
        if animal.organization_id != organization.id:
            return Response({"detail": "You can only share stories about your own animals."}, status=status.HTTP_403_FORBIDDEN)
    serializer = StorySerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    story = serializer.save(organization=organization, animal=animal)
    return Response(StorySerializer(story, context={"request": request}).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def story_seen(request, story_id):
    StoryView.objects.get_or_create(story=get_object_or_404(Story, pk=story_id), user=request.user)
    return Response({"seen": True})


@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def story_groups(request):
    """Active stories grouped by category, newest first within each group. Signed in, each
    story says whether you've watched it. Organizations POST here to share a new story."""
    if request.method == "POST":
        return _create_story(request)
    stories = Story.objects.active().select_related("organization", "animal", "animal__case")
    seen_ids = set()
    if request.user.is_authenticated:
        seen_ids = set(StoryView.objects.filter(user=request.user, story__in=stories).values_list("story_id", flat=True))
    serializer_context = {"request": request, "seen_ids": seen_ids}
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
                "seen": all(story.id in seen_ids for story in in_category),
                "stories": StorySerializer(in_category, many=True, context=serializer_context).data,
            }
        )
    return Response(groups)
