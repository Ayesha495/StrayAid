from rest_framework import serializers
from .models import AnimalFollow, Notification, OrganizationFollow, PushToken


class PushTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = PushToken
        fields = ["token"]

    def create(self, validated_data):
        token, _ = PushToken.objects.get_or_create(
            user=self.context["request"].user,
            token=validated_data["token"],
        )
        return token


class AnimalFollowSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnimalFollow
        fields = ["id", "animal", "created_at"]
        read_only_fields = ["id", "created_at"]


class OrganizationFollowSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrganizationFollow
        fields = ["id", "organization", "created_at"]
        read_only_fields = ["id", "created_at"]


class NotificationSerializer(serializers.ModelSerializer):
    unread = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ["id", "kind", "title", "body", "data", "unread", "created_at"]

    def get_unread(self, obj):
        return obj.read_at is None
