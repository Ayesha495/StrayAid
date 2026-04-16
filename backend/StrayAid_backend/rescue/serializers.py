from rest_framework import serializers

from organizations.serializers import OrganizationSerializer

from .models import Case, Report
from .utils.location_utils import calculate_distance

class ReportSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = Report
        fields = '__all__'

class CaseSerializer(serializers.ModelSerializer):
    reports = ReportSerializer(many = True, read_only = True)
    organization = OrganizationSerializer(read_only=True)
    distance_km = serializers.SerializerMethodField()

    class Meta:
        model = Case
        fields = '__all__'
        read_only_fields = ["organization", "assigned_to", "resolved_at", "updated_at"]

    def get_distance_km(self, obj):
        request = self.context.get("request")
        organization = getattr(getattr(request, "user", None), "organization_profile", None)
        if not organization:
            return None

        distance_m = calculate_distance(
            organization.latitude,
            organization.longitude,
            obj.latitude,
            obj.longitude,
        )
        return round(distance_m / 1000, 2)
