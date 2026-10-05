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
    # Nested reports let client apps render a case detail view in one request.
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
        if not organization or organization.latitude is None or organization.longitude is None:
            return None

        # Distance is computed relative to the signed-in organization when available.
        distance_m = calculate_distance(
            organization.latitude,
            organization.longitude,
            obj.latitude,
            obj.longitude,
        )
        return round(distance_m / 1000, 2)


# Public wording for each case status, as shown to guests and reporters.
PUBLIC_STATUS_LABELS = {
    "reported": "Awaiting Responder",
    "assigned": "Responder Assigned",
    "in_progress": "Rescue In Progress",
    "rescued": "Rescued",
    "adoption": "Up for Adoption",
    "closed": "Closed",
}


class TrendingCaseSerializer(serializers.ModelSerializer):
    # Public card data only: no reporter identity or organization internals.
    title = serializers.SerializerMethodField()
    status_label = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()
    report_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Case
        fields = [
            "id",
            "title",
            "species",
            "area",
            "severity",
            "confidence_score",
            "possibly_invalid",
            "status",
            "status_label",
            "latitude",
            "longitude",
            "image",
            "report_count",
            "created_at",
        ]

    def get_title(self, obj):
        if obj.title:
            return obj.title
        species = (obj.species or "Animal").title()
        return f"{species} — {obj.area}" if obj.area else species

    def get_status_label(self, obj):
        return PUBLIC_STATUS_LABELS.get(obj.status, obj.get_status_display())

    def get_image(self, obj):
        # The newest report photo stands for the case.
        report = next(iter(obj.reports.all()), None)
        if not report or not report.image:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(report.image.url) if request else report.image.url
