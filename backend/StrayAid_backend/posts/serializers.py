from rest_framework import serializers

from .models import Post, Story
from animals.serializers import AnimalSerializer
from organizations.serializers import OrganizationSerializer


class PostSerializer(serializers.ModelSerializer):
    animal = AnimalSerializer(read_only=True)
    organization = OrganizationSerializer(read_only=True)
    # Engagement counts are annotated on the queryset in PostViewSet.
    like_count = serializers.IntegerField(read_only=True, default=0)
    comment_count = serializers.IntegerField(read_only=True, default=0)
    liked_by_me = serializers.BooleanField(read_only=True, default=False)

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
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "animal", "organization", "created_at", "updated_at"]


class StoryOrganizationSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    image = serializers.ImageField()


class StorySerializer(serializers.ModelSerializer):
    organization = StoryOrganizationSerializer(read_only=True)

    class Meta:
        model = Story
        fields = ["id", "category", "image", "caption", "organization", "created_at"]
        read_only_fields = ["id", "organization", "created_at"]
