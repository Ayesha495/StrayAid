from rest_framework import serializers

from .models import Animal
from organizations.serializers import OrganizationSerializer


class AnimalSerializer(serializers.ModelSerializer):
    organization = OrganizationSerializer(read_only=True)
    organization_id = serializers.IntegerField(write_only=True, required=False)
    case_id = serializers.IntegerField(source="case.id", read_only=True)

    class Meta:
        model = Animal
        fields = [
            "id",
            "case",
            "case_id",
            "organization",
            "organization_id",
            "name",
            "breed",
            "description",
            "medical_info",
            "donation_info",
            "status",
            "image",
            "created_at",
        ]
        read_only_fields = ["id", "organization", "case_id", "created_at"]
