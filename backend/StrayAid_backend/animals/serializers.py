from rest_framework import serializers

from .models import Animal
from organizations.serializers import OrganizationSerializer


class AnimalSerializer(serializers.ModelSerializer):
    organization = OrganizationSerializer(read_only=True)
    organization_id = serializers.IntegerField(write_only=True, required=False)
    case_id = serializers.IntegerField(source="case.id", read_only=True)
    adoption_info = serializers.SerializerMethodField()
    donation_info = serializers.SerializerMethodField()

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
            "adoption_info",
            "status",
            "image",
            "created_at",
        ]
        read_only_fields = ["id", "organization", "case_id", "created_at"]

    def get_adoption_info(self, obj):
        organization = obj.organization
        if not organization:
            return None

        return {
            "message": f"To adopt {obj.name}, contact {organization.name} via",
            "phone": organization.phone,
            "email": organization.email or organization.user.email,
        }

    def get_donation_info(self, obj):
        organization = obj.organization
        if not organization:
            return None

        if not any([organization.bank_name, organization.bank_account_title, organization.bank_account_number]):
            return None

        return {
            "bank": organization.bank_name,
            "account_name": organization.bank_account_title,
            "account_number": organization.bank_account_number,
        }
