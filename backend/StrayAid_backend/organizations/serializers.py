from rest_framework import serializers

from .models import Organization


class OrganizationSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_username = serializers.CharField(source="user.username", read_only=True)
    phone_number = serializers.CharField(source="phone", required=False, allow_blank=True)
    contact_email = serializers.EmailField(source="email", required=False, allow_blank=True)

    class Meta:
        model = Organization
        fields = [
            "id",
            "user",
            "user_email",
            "user_username",
            "name",
            "description",
            "image",
            "latitude",
            "longitude",
            "address",
            "city",
            "capacity",
            "phone_number",
            "contact_email",
            "radius",
            "bank_account_title",
            "bank_account_number",
        ]
        read_only_fields = ["id", "user", "user_email", "user_username"]
