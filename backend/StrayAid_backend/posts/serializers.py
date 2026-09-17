from rest_framework import serializers

from .models import Post
from animals.serializers import AnimalSerializer
from organizations.serializers import OrganizationSerializer


class PostSerializer(serializers.ModelSerializer):
    animal = AnimalSerializer(read_only=True)
    organization = OrganizationSerializer(read_only=True)

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
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "animal", "organization", "created_at", "updated_at"]
