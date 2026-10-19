from django.db.models import Sum
from rest_framework import serializers

from .models import Post, PostComment, Story
from animals.serializers import AnimalSerializer
from organizations.serializers import OrganizationSerializer


class PostSerializer(serializers.ModelSerializer):
    animal = AnimalSerializer(read_only=True)
    organization = OrganizationSerializer(read_only=True)
    # Engagement counts are annotated on the queryset in PostViewSet.
    like_count = serializers.IntegerField(read_only=True, default=0)
    comment_count = serializers.IntegerField(read_only=True, default=0)
    liked_by_me = serializers.BooleanField(read_only=True, default=False)
    saved_by_me = serializers.BooleanField(read_only=True, default=False)

    class Meta:
        model = Post
        fields = [
            "id",
            "animal",
            "organization",
            "title",
            "content",
            "category",
            "image",
            "like_count",
            "comment_count",
            "liked_by_me",
            "saved_by_me",
            "share_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "animal", "organization", "share_count", "created_at", "updated_at"]


class StoryOrganizationSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    image = serializers.ImageField()
    is_verified = serializers.BooleanField()


class StorySerializer(serializers.ModelSerializer):
    organization = StoryOrganizationSerializer(read_only=True)
    animal = serializers.SerializerMethodField()
    seen = serializers.SerializerMethodField()

    class Meta:
        model = Story
        fields = ["id", "category", "image", "headline", "caption", "organization", "animal", "seen", "created_at"]
        read_only_fields = ["id", "organization", "created_at"]

    def get_animal(self, obj):
        """The animal a story is about, with what the viewer needs: its sponsorship progress
        and how many updates the organization has shared on it ("Update #4")."""
        animal = obj.animal
        if not animal:
            return None
        return {
            "id": animal.id,
            "name": animal.name,
            "species": animal.species,
            "status": animal.status,
            "area": animal.case.area if animal.case_id else "",
            "sponsor_count": animal.sponsorships.filter(status="confirmed").values("sponsor").distinct().count(),
            "sponsor_goal": animal.sponsor_goal,
            "funding_goal_pkr": animal.funding_goal_pkr,
            "raised_pkr": animal.sponsorships.filter(status="confirmed").aggregate(total=Sum("amount_pkr"))["total"] or 0,
            "update_number": animal.posts.count() + animal.stories.filter(created_at__lte=obj.created_at).count(),
        }

    def get_seen(self, obj):
        return obj.id in self.context.get("seen_ids", ())


def _initials(name):
    parts = [part for part in name.replace("&", " ").split() if part[:1].isalpha()]
    return "".join(part[0] for part in parts[:2]).upper() or "?"


class CommentSerializer(serializers.ModelSerializer):
    """A comment on the comments sheet (Stitch 23). The view passes what the badges need:
    who wrote the post, who reported or adopted the animal and who sponsors it."""

    author = serializers.SerializerMethodField()
    like_count = serializers.SerializerMethodField()
    liked_by_me = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()
    can_pin = serializers.SerializerMethodField()

    class Meta:
        model = PostComment
        fields = ["id", "body", "created_at", "is_pinned", "author", "like_count", "liked_by_me", "replies", "can_delete", "can_pin"]

    def _viewer_id(self):
        user = getattr(self.context.get("request"), "user", None)
        return user.id if user and user.is_authenticated else None

    def get_author(self, obj):
        context = self.context
        user = obj.user
        organization = context.get("organization")
        is_organization = bool(organization and user.id == organization.user_id)
        name = organization.name if is_organization else (user.get_full_name() or user.username)
        if is_organization:
            badge = "Author"
        elif user.id in context.get("adopter_ids", ()):
            badge = "Adopter"
        elif user.id == context.get("reporter_id"):
            badge = "Reporter"
        elif user.id in context.get("donor_ids", ()):
            badge = "Donor"
        else:
            badge = ""
        request = context.get("request")
        image = organization.image if is_organization else user.avatar
        avatar = (request.build_absolute_uri(image.url) if request else image.url) if image else None
        return {"id": user.id, "name": name, "initials": _initials(name), "avatar": avatar, "badge": badge,
                "is_organization": is_organization, "verified": is_organization and organization.is_verified}

    def get_like_count(self, obj):
        return len(obj.likes.all())

    def get_liked_by_me(self, obj):
        viewer = self._viewer_id()
        return bool(viewer and any(like.user_id == viewer for like in obj.likes.all()))

    def get_replies(self, obj):
        if obj.parent_id:
            return []
        return CommentSerializer(obj.replies.all(), many=True, context=self.context).data

    def get_can_pin(self, obj):
        organization = self.context.get("organization")
        return bool(not obj.parent_id and organization and self._viewer_id() == organization.user_id)

    def get_can_delete(self, obj):
        viewer = self._viewer_id()
        organization = self.context.get("organization")
        return bool(viewer and (viewer == obj.user_id or (organization and viewer == organization.user_id)))
