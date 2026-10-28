from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Case as CaseWhen, Count, F, IntegerField, Q, Value, When
from django.utils import timezone

from animals.models import Animal
from core.uploads import validate_image_upload
from organizations.permissions import IsOrganizationUser

from .models import AIFeedback, Case, CaseUpdate, CaseVerification, Report
from .serializers import (
    CaseDetailSerializer,
    CaseSerializer,
    CaseUpdateSerializer,
    PublicReportSerializer,
    TrendingCaseSerializer,
)
from .utils.case_matcher import find_nearby_case
from .ai import detector
from .utils.scoring import (
    ANIMAL_REQUIRED,
    community_severity,
    community_summary,
    refresh_case_score,
    refresh_unanswered_scores_if_due,
)
from .utils.location_utils import calculate_distance


def organization_capacity_is_full(organization):
    return (
        organization.capacity
        and Animal.objects.filter(organization=organization).exclude(status=Animal.STATUS_ADOPTED).count() >= organization.capacity
    )


def case_is_within_organization_radius(case, organization):
    if not organization.radius or organization.latitude is None or organization.longitude is None:
        return True

    distance_m = calculate_distance(
        organization.latitude,
        organization.longitude,
        case.latitude,
        case.longitude,
    )
    return distance_m <= organization.radius * 1000


def alert_nearby_organizations(case):
    """A critical case goes to every available organization whose service area covers it,
    and to people who turned on "Urgent Radius Alerts" near the spot ("Rescue Alert" on
    the Notifications screen, Stitch 20)."""
    from accounts.models import User
    from notifications.services import notify_users
    from organizations.models import Organization

    nearby = [
        organization.user_id
        for organization in Organization.objects.filter(
            is_available=True, latitude__isnull=False, longitude__isnull=False, radius__isnull=False
        )
        if case_is_within_organization_radius(case, organization)
    ]
    nearby += [
        person.id
        for person in User.objects.filter(radius_alerts=True, alert_latitude__isnull=False, alert_longitude__isnull=False)
        .exclude(pk=case.reported_by_id)
        if calculate_distance(person.alert_latitude, person.alert_longitude, case.latitude, case.longitude)
        <= User.ALERT_RADIUS_KM * 1000
    ]
    place = case.area.split(",")[0].strip() if case.area else "your area"
    notify_users(
        nearby,
        title="Rescue Alert",
        body=f"Critical case reported near **{place}**. Tap to review details.",
        data={"type": "critical_case", "case_id": case.id},
    )


def _photo_check_error(image):
    """Check an uploaded photo before anything is saved: it must be a real image, and the
    animal detector must see an animal in it. Returns (result, None) or (None, error response)."""
    try:
        validate_image_upload(image)
    except DjangoValidationError as error:
        return None, Response({"error": error.messages[0], "code": "invalid_image"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        result = detector.detect_animal(image)
    except detector.UnreadablePhoto:
        return None, Response(
            {
                "error": "We couldn't open this photo. Take a new photo with the camera, or choose a JPG or PNG.",
                "code": "unreadable_image",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )
    if result is None:
        return None, Response(
            {
                "error": "We can't check photos right now. Please try again in a minute.",
                "code": "detector_unavailable",
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    if result["confidence"] < ANIMAL_REQUIRED:
        return None, Response(
            {
                "error": "We couldn't find an animal in this photo. Please retake a clear photo of the animal.",
                "code": "not_an_animal",
                "confidence": result["confidence"],
            },
            status=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )
    return result, None


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def check_photo(request):
    """Check a report photo as soon as it's picked (Stitch 7), so a photo without an animal
    can be retaken before the report is filled in. Nothing is stored."""
    image = request.FILES.get("image")
    if not image:
        return Response({"error": "Image is required"}, status=status.HTTP_400_BAD_REQUEST)
    result, error = _photo_check_error(image)
    if error:
        return error
    return Response({"is_animal": True, "animal": result["label"], "confidence": result["confidence"]})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def report_case(request):

    user = request.user
    description = request.data.get('description')
    latitude = request.data.get('latitude')
    longitude = request.data.get('longitude')
    image = request.FILES.get('image')
    # Readable place name picked on the phone (e.g. "F-7, Islamabad"); shown instead of coordinates.
    area = (request.data.get('area') or '').strip()[:100]
    # Reporters don't choose a severity (older app versions still send one; it's ignored):
    # people who verify the case on the map decide how urgent it is.
    # Multipart sends booleans as text; anything but an explicit "no" keeps updates on.
    notify_reporter = str(request.data.get('keep_updated', 'true')).strip().lower() not in ('false', '0', 'no', 'off')

    # Basic validation before we try duplicate matching or file creation.
    if not latitude or not longitude:
        return Response(
            {"error": "Latitude and longitude are required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    if not image:
        return Response(
            {"error": "Image is required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        latitude = float(latitude)
        longitude = float(longitude)
    except ValueError:
        return Response(
            {"error": "Invalid latitude or longitude format"},
            status=status.HTTP_400_BAD_REQUEST
        )
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return Response({"error": "Latitude or longitude is out of range"}, status=status.HTTP_400_BAD_REQUEST)

    # Reports must show an animal: photos without one are refused, to keep out false reports.
    detection, error = _photo_check_error(image)
    if error:
        return error

    # If this is a repeat sighting of a nearby open case, attach the report to it.
    existing_case = find_nearby_case(latitude, longitude, user=user, animal=detection["label"])

    if existing_case:
        case = existing_case
        if area and not case.area:
            case.area = area
            case.save(update_fields=["area"])
        message = "Report attached to existing case"
    else:
        case = Case.objects.create(
            description=description,
            latitude=latitude,
            longitude=longitude,
            area=area,
            reported_by=user
        )
        message = "New case created and report added"

    # Every submission still gets its own report record for history.
    report = Report.objects.create(
        case=case,
        user=user,
        image=image,
        description=description,
        latitude=latitude,
        longitude=longitude,
        notify_reporter=notify_reporter,
        ai_animal_confidence=detection["confidence"],
        ai_animal_label=detection["label"],
        ai_box=detection["box"],
    )
    # AI confidence (Stitch 11), from this photo plus any earlier sightings. Reload the case
    # first: the matcher's copy has its report list cached from before this report.
    case = Case.objects.get(pk=case.pk)
    refresh_case_score(case)

    return Response(
        {
            "message": message,
            "case_id": case.id,
            "report_id": report.id,
            "keep_updated": report.notify_reporter,
            # Summary for the "Report submitted" screen.
            "case": {
                "id": case.id,
                "reference": case.reference,
                "area": case.area,
                "severity": case.severity,
                "confidence_score": case.confidence_score,
                "status": case.status,
            },
        },
        status=status.HTTP_201_CREATED
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def keep_me_updated(request, report_id):
    """Turn on status updates for one of your own reports (the success screen's button)."""
    report = Report.objects.filter(pk=report_id, user=request.user).first()
    if not report:
        return Response({"error": "Report not found"}, status=status.HTTP_404_NOT_FOUND)
    if not report.notify_reporter:
        report.notify_reporter = True
        report.save(update_fields=["notify_reporter"])
    return Response({"keep_updated": True})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_reports(request):
    queryset = (
        Case.objects.select_related(
            "reported_by",
            "assigned_to",
            "organization",
            "organization__user",
        )
        .prefetch_related("reports")
        .filter(reports__user=request.user)
        .distinct()
    )
    serializer = CaseSerializer(queryset, many=True, context={"request": request})
    return Response(serializer.data)


ACTIVE_RESCUE_STATUSES = ["reported", "assigned", "in_progress"]
SEVERITY_RANK = CaseWhen(
    When(severity="critical", then=Value(4)),
    When(severity="high", then=Value(3)),
    When(severity="medium", then=Value(2)),
    default=Value(1),
    output_field=IntegerField(),
)


@api_view(["GET"])
@permission_classes([AllowAny])
def map_cases(request):
    """Open rescue cases for the rescue map (Stitch 12), most urgent first.

    Optional ?lat=&lng=&radius_km= keeps only cases within that distance (default 25 km,
    at most 100 km). Without a position every open case is returned (up to 300)."""
    refresh_unanswered_scores_if_due()
    queryset = (
        Case.objects.filter(status__in=ACTIVE_RESCUE_STATUSES)
        .annotate(severity_rank=SEVERITY_RANK, report_count=Count("reports", distinct=True))
        .prefetch_related("reports", "verifications")
        .order_by("-severity_rank", F("confidence_score").desc(nulls_last=True), "-created_at")
    )
    cases = list(queryset[:300])
    try:
        lat = float(request.query_params["lat"])
        lng = float(request.query_params["lng"])
    except (KeyError, ValueError):
        lat = lng = None
    if lat is not None:
        try:
            radius_km = min(max(float(request.query_params.get("radius_km", 25)), 1), 100)
        except ValueError:
            radius_km = 25
        cases = [case for case in cases if calculate_distance(lat, lng, case.latitude, case.longitude) <= radius_km * 1000]
    return Response(TrendingCaseSerializer(cases, many=True, context={"request": request}).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def trending_cases(request):
    """Open rescue cases for the public home screen, most urgent first."""
    refresh_unanswered_scores_if_due()
    try:
        limit = min(max(int(request.query_params.get("limit", 3)), 1), 20)
    except ValueError:
        limit = 3
    queryset = (
        Case.objects.filter(status__in=ACTIVE_RESCUE_STATUSES)
        .annotate(severity_rank=SEVERITY_RANK, report_count=Count("reports", distinct=True))
        .prefetch_related("reports", "verifications")
        .order_by("-severity_rank", F("confidence_score").desc(nulls_last=True), "-created_at")[:limit]
    )
    serializer = TrendingCaseSerializer(queryset, many=True, context={"request": request})
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([AllowAny])
def community_stats(request):
    """Headline numbers for the home screen's community impact card."""
    today = timezone.localdate()
    return Response(
        {
            "rescued_total": Animal.objects.count(),
            "rescued_today": Animal.objects.filter(created_at__date=today).count(),
        }
    )


class CaseViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Case.objects.select_related(
        "reported_by",
        "assigned_to",
        "organization",
        "organization__user",
    ).prefetch_related("reports")
    serializer_class = CaseSerializer
    permission_classes = [IsAuthenticated, IsOrganizationUser]

    def get_queryset(self):
        organization = getattr(self.request.user, "organization_profile", None)
        queryset = super().get_queryset()
        if not organization:
            return queryset.none()
        if self.action == "accept_case":
            return queryset
        # Organizations can browse unclaimed work plus the cases already assigned to them.
        return queryset.filter(Q(organization__isnull=True) | Q(organization=organization))

    def list(self, request, *args, **kwargs):
        refresh_unanswered_scores_if_due()
        organization = request.user.organization_profile
        queryset = self.get_queryset()
        visible_cases = [
            case
            for case in queryset
            if case.organization_id == organization.id or case_is_within_organization_radius(case, organization)
        ]
        serializer = self.get_serializer(visible_cases, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="nearby")
    def nearby(self, request):
        refresh_unanswered_scores_if_due()
        organization = request.user.organization_profile
        queryset = self.get_queryset().filter(organization__isnull=True).exclude(status="closed")
        try:
            radius_km = float(request.query_params.get("radius_km", organization.radius or 50))
        except ValueError:
            return Response({"detail": "Invalid radius."}, status=status.HTTP_400_BAD_REQUEST)

        if organization.radius:
            radius_km = min(radius_km, organization.radius)

        nearby_cases = []

        # Distance is evaluated in Python because the helper is shared elsewhere too.
        for case in queryset:
            distance_m = calculate_distance(
                organization.latitude,
                organization.longitude,
                case.latitude,
                case.longitude,
            )
            if distance_m <= radius_km * 1000:
                nearby_cases.append(case)

        serializer = self.get_serializer(nearby_cases, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="my-cases")
    def my_cases(self, request):
        queryset = self.get_queryset().filter(organization=request.user.organization_profile)
        serializer = self.get_serializer(queryset, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="accept")
    def accept_case(self, request, pk=None):
        case = self.get_object()
        organization = request.user.organization_profile

        if case.organization_id and case.organization_id != organization.id:
            return Response({"detail": "This case is already assigned."}, status=status.HTTP_400_BAD_REQUEST)

        if not case_is_within_organization_radius(case, organization):
            return Response({"detail": "This case is outside your service radius."}, status=status.HTTP_400_BAD_REQUEST)

        if organization_capacity_is_full(organization):
            return Response({"detail": "Organization animal capacity has been reached."}, status=status.HTTP_400_BAD_REQUEST)

        # Accepting a case records both the owning organization and acting user.
        case.organization = organization
        case.assigned_to = request.user
        case.status = "assigned"
        case.save(update_fields=["organization", "assigned_to", "status", "updated_at"])

        serializer = self.get_serializer(case, context={"request": request})
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="add-update")
    def add_update(self, request, pk=None):
        """Organizations post a note to the case history their reporters and followers see."""
        case = self.get_object()
        if case.organization_id != request.user.organization_profile.id:
            return Response({"detail": "You can only post updates on your own cases."}, status=status.HTTP_403_FORBIDDEN)
        message = (request.data.get("message") or "").strip()
        if not message:
            return Response({"detail": "Write a message for the update."}, status=status.HTTP_400_BAD_REQUEST)
        update = CaseUpdate.objects.create(case=case, message=message[:2000], author=request.user)

        from notifications.services import notify_users
        from notifications.signals import case_audience

        reporter_ids, follower_ids = case_audience(case)
        recipients = (reporter_ids | follower_ids) - {request.user.id}
        if hasattr(case, "animal"):
            from notifications.models import AnimalFollow

            recipients |= set(AnimalFollow.objects.filter(animal=case.animal).values_list("user_id", flat=True)) - {request.user.id}
        preview = message if len(message) <= 140 else f"{message[:137]}..."
        notify_users(
            list(recipients),
            title="Rescue Update",
            body=f"**{case.organization.name}** posted an update on case {case.reference}: {preview}",
            data={"type": "case_note", "case_id": case.pk, "update_id": update.pk},
        )
        return Response(CaseUpdateSerializer(update).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["patch"], url_path="update-status")
    def update_status(self, request, pk=None):
        case = self.get_object()
        organization = request.user.organization_profile

        if case.organization_id != organization.id:
            return Response({"detail": "You can only update your own cases."}, status=status.HTTP_403_FORBIDDEN)

        new_status = request.data.get("status")
        valid_statuses = dict(Case.STATUS_CHOICES)
        if new_status not in valid_statuses:
            return Response({"detail": "Invalid status."}, status=status.HTTP_400_BAD_REQUEST)

        case.status = new_status
        # Resolved timestamps are only set when the workflow reaches an end state.
        if new_status in ["rescued", "closed"]:
            from django.utils import timezone

            case.resolved_at = timezone.now()
            case.save(update_fields=["status", "resolved_at", "updated_at"])
        else:
            case.save(update_fields=["status", "updated_at"])

        serializer = self.get_serializer(case, context={"request": request})
        return Response(serializer.data)


# ── Public case page (Stitch 10) ─────────────────────────────────────────────

def _public_case(case_id):
    return (
        Case.objects.select_related("organization")
        .prefetch_related("reports__user", "updates", "verifications")
        .filter(pk=case_id)
        .first()
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def case_detail(request, case_id):
    case = _public_case(case_id)
    if not case:
        return Response({"error": "Case not found"}, status=status.HTTP_404_NOT_FOUND)
    # Unanswered cases lose confidence over time, so bring the saved score up to date.
    refresh_case_score(case)
    return Response(CaseDetailSerializer(case, context={"request": request}).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def case_updates(request, case_id):
    case = _public_case(case_id)
    if not case:
        return Response({"error": "Case not found"}, status=status.HTTP_404_NOT_FOUND)
    updates = case.updates.select_related("author__organization_profile")
    return Response(CaseUpdateSerializer(updates, many=True).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def case_reports(request, case_id):
    case = _public_case(case_id)
    if not case:
        return Response({"error": "Case not found"}, status=status.HTTP_404_NOT_FOUND)
    return Response(PublicReportSerializer(case.reports.all(), many=True, context={"request": request}).data)


@api_view(["POST", "DELETE"])
@permission_classes([IsAuthenticated])
def case_keep_updated(request, case_id):
    """The case page's "Keep me updated" switch. Reporters turn their own reports' updates on
    or off; anyone else follows or unfollows the case."""
    from notifications.models import CaseFollow

    case = Case.objects.filter(pk=case_id).first()
    if not case:
        return Response({"error": "Case not found"}, status=status.HTTP_404_NOT_FOUND)

    keep_updated = request.method == "POST"
    own_reports = case.reports.filter(user=request.user)
    if own_reports.exists():
        own_reports.update(notify_reporter=keep_updated)
    elif keep_updated:
        CaseFollow.objects.get_or_create(user=request.user, case=case)
    else:
        CaseFollow.objects.filter(user=request.user, case=case).delete()
    return Response({"keep_updated": keep_updated})



@api_view(["POST"])
@permission_classes([IsAuthenticated])
def case_ai_feedback(request, case_id):
    """"Report incorrect AI detection" (Stitch 11). One answer per person per case."""
    case = Case.objects.filter(pk=case_id).first()
    if not case:
        return Response({"error": "Case not found"}, status=status.HTTP_404_NOT_FOUND)
    reason = request.data.get("reason")
    if reason not in dict(AIFeedback.REASON_CHOICES):
        return Response({"error": "Choose what's wrong with the detection"}, status=status.HTTP_400_BAD_REQUEST)
    AIFeedback.objects.update_or_create(case=case, user=request.user, defaults={"reason": reason})
    return Response({"reason": reason}, status=status.HTTP_201_CREATED)


# ── Community verification ("Is this animal still there?") ──────────────────

def verify_blocker(case, user):
    """Why this person can't verify the case, or None if they can."""
    if case.status not in ACTIVE_RESCUE_STATUSES:
        return "closed"
    if not user or not user.is_authenticated:
        return "sign_in"
    if any(report.user_id == user.id for report in case.reports.all()):
        return "reporter"
    return None


VERIFY_BLOCKED_MESSAGES = {
    "closed": "This case is no longer open, so it can't be verified.",
    "reporter": "You reported this case, so others need to verify it.",
}


@api_view(["POST", "DELETE"])
@permission_classes([IsAuthenticated])
def case_verify(request, case_id):
    """Confirm (or dispute) that a reported animal is really there, like confirming a road
    blockage on a map. One answer per person, which they can change or take back. The
    answer feeds the case's confidence score; urgent confirmations raise its severity."""
    from .serializers import verification_for_viewer

    case = Case.objects.prefetch_related("reports", "verifications").filter(pk=case_id).first()
    if not case:
        return Response({"error": "Case not found"}, status=status.HTTP_404_NOT_FOUND)
    blocker = verify_blocker(case, request.user)
    if blocker:
        return Response({"error": VERIFY_BLOCKED_MESSAGES[blocker], "code": blocker}, status=status.HTTP_403_FORBIDDEN)

    if request.method == "DELETE":
        CaseVerification.objects.filter(case=case, user=request.user).delete()
    else:
        response = request.data.get("response")
        if response not in dict(CaseVerification.RESPONSE_CHOICES):
            return Response(
                {"error": "Say whether you found the animal: confirmed or not_found"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        urgent = response == CaseVerification.CONFIRMED and str(request.data.get("urgent", "")).strip().lower() in (
            "true", "1", "yes", "on"
        )
        distance_m = None
        try:
            latitude, longitude = float(request.data["latitude"]), float(request.data["longitude"])
            if -90 <= latitude <= 90 and -180 <= longitude <= 180:
                distance_m = round(calculate_distance(latitude, longitude, case.latitude, case.longitude), 1)
        except (KeyError, TypeError, ValueError):
            pass
        _, created = CaseVerification.objects.update_or_create(
            case=case,
            user=request.user,
            defaults={"response": response, "urgent": urgent, "distance_m": distance_m},
        )
        if created and response == CaseVerification.CONFIRMED:
            _notify_reporters_of_confirmation(case)

    case = Case.objects.prefetch_related("reports", "verifications", "updates").get(pk=case.pk)
    summary = community_summary(case.verifications.all())
    severity = community_severity(case.severity, summary["urgent_weight"])
    if severity != case.severity:
        became_critical = severity == "critical"
        case.severity = severity
        case.save(update_fields=["severity"])
        if became_critical and case.status == "reported":
            alert_nearby_organizations(case)
    refresh_case_score(case)
    return Response(
        {
            "verification": verification_for_viewer(case, request.user),
            "confidence_score": case.confidence_score,
            "possibly_invalid": case.possibly_invalid,
            "severity": case.severity,
        }
    )


def _notify_reporters_of_confirmation(case):
    """Tell the people who reported the case that someone confirmed it. One notification
    per case, refreshed with the running count, so it doesn't pile up."""
    from notifications.services import notify_users

    count = case.verifications.filter(response=CaseVerification.CONFIRMED).count()
    people = "1 person" if count == 1 else f"{count} people"
    notify_users(
        list({report.user_id for report in case.reports.all()}),
        title="Report confirmed",
        body=f"**{people}** confirmed the animal you reported in case {case.reference} is there.",
        data={"type": "case_verified", "case_id": case.pk},
        kind="rescue",
        group_key=f"case-verified-{case.pk}",
    )
