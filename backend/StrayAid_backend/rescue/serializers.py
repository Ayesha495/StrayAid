from rest_framework import serializers

from organizations.serializers import OrganizationSerializer

from .models import Case, CaseUpdate, Report
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
    reference = serializers.ReadOnlyField()
    ai_feedback_count = serializers.SerializerMethodField()

    class Meta:
        model = Case
        fields = '__all__'
        read_only_fields = ["organization", "assigned_to", "resolved_at", "updated_at"]

    def get_ai_feedback_count(self, obj):
        return obj.ai_feedback.count()

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
        # The case's photo is the one from the report that started it. Later sightings keep
        # their own photos under "Related Reports"; a case doesn't collect a gallery.
        report = min(obj.reports.all(), key=lambda item: item.created_at, default=None)
        if not report or not report.image:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(report.image.url) if request else report.image.url


def _absolute(request, file_field):
    if not file_field:
        return None
    return request.build_absolute_uri(file_field.url) if request else file_field.url


class CaseDetailSerializer(TrendingCaseSerializer):
    """Public case page (Stitch 10). Like the trending card: area instead of exact coordinates
    and no reporter identities. `keep_updated` / `is_reporter` describe the signed-in viewer."""

    reference = serializers.ReadOnlyField()
    organization = serializers.SerializerMethodField()
    animal = serializers.SerializerMethodField()
    update_count = serializers.SerializerMethodField()
    latest_update_at = serializers.SerializerMethodField()
    keep_updated = serializers.SerializerMethodField()
    is_reporter = serializers.SerializerMethodField()
    ai = serializers.SerializerMethodField()

    class Meta(TrendingCaseSerializer.Meta):
        fields = [
            field for field in TrendingCaseSerializer.Meta.fields if field not in ("latitude", "longitude")
        ] + [
            "reference",
            "description",
            "organization",
            "animal",
            "update_count",
            "latest_update_at",
            "keep_updated",
            "is_reporter",
            "ai",
        ]

    def _viewer(self):
        user = getattr(self.context.get("request"), "user", None)
        return user if user and user.is_authenticated else None

    def get_organization(self, obj):
        organization = obj.organization
        if not organization:
            return None
        return {
            "id": organization.id,
            "name": organization.name,
            "type": organization.type,
            "city": organization.city,
            "phone": organization.phone,
            "email": organization.email,
            "image": _absolute(self.context.get("request"), organization.image),
        }

    def get_animal(self, obj):
        animal = getattr(obj, "animal", None)
        return {"id": animal.id, "name": animal.name} if animal else None

    def get_update_count(self, obj):
        return obj.updates.count()

    def get_latest_update_at(self, obj):
        latest = obj.updates.first()
        return latest.created_at if latest else None

    def get_ai(self, obj):
        """How the score was made (Stitch 11), using the same formula as scoring.py."""
        from .ai.detector import MODEL_NAME
        from .utils.scoring import best_scored_report, score_breakdown

        best = best_scored_report(obj)
        parts = score_breakdown(obj)
        viewer = self._viewer()
        my_feedback = obj.ai_feedback.filter(user=viewer).values_list("reason", flat=True).first() if viewer else None
        return {
            "model": MODEL_NAME,
            "scored": best is not None,
            # The best single photo, shown as the detection thumbnail...
            "animal_confidence": best.ai_animal_confidence if best else None,
            "animal": best.ai_animal_label if best else "",
            "box": best.ai_box if best else None,
            "image": _absolute(self.context.get("request"), best.image) if best else None,
            # ...and the parts of the score (see utils/scoring.py).
            "photo_confidence": parts["photo"],
            "photo_count": parts["photo_count"],
            "severity_weight": parts["severity"],
            "report_count": parts["report_count"],
            "report_weight": parts["reports"],
            "hours_unanswered": parts["hours_unanswered"],
            "answered": parts["answered"],
            "freshness": parts["freshness"],
            "my_feedback": my_feedback,
        }

    def get_is_reporter(self, obj):
        viewer = self._viewer()
        return bool(viewer) and any(report.user_id == viewer.id for report in obj.reports.all())

    def get_keep_updated(self, obj):
        viewer = self._viewer()
        if not viewer:
            return False
        own_reports = [report for report in obj.reports.all() if report.user_id == viewer.id]
        if own_reports:
            return any(report.notify_reporter for report in own_reports)
        return obj.followers.filter(user=viewer).exists()


class CaseUpdateSerializer(serializers.ModelSerializer):
    status_label = serializers.SerializerMethodField()
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = CaseUpdate
        fields = ["id", "status", "status_label", "message", "author_name", "created_at"]

    def get_status_label(self, obj):
        return PUBLIC_STATUS_LABELS.get(obj.status, "Update") if obj.status else "Update"

    def get_author_name(self, obj):
        organization = getattr(obj.author, "organization_profile", None) if obj.author_id else None
        return organization.name if organization else None


class PublicReportSerializer(serializers.ModelSerializer):
    """A report on a public case page: first name only, never the email."""

    image = serializers.SerializerMethodField()
    reporter = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = Report
        fields = ["id", "image", "description", "severity", "created_at", "reporter", "is_mine"]

    def get_image(self, obj):
        return _absolute(self.context.get("request"), obj.image)

    def get_reporter(self, obj):
        return obj.user.first_name or "A StrayAid reporter"

    def get_is_mine(self, obj):
        user = getattr(self.context.get("request"), "user", None)
        return bool(user and user.is_authenticated and obj.user_id == user.id)
