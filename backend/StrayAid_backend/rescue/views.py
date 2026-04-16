from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Q
from organizations.permissions import IsOrganizationUser

from .models import Case, Report
from .serializers import CaseSerializer
from .utils.case_matcher import find_nearby_case
from .utils.location_utils import calculate_distance


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def report_case(request):

    user = request.user
    description = request.data.get('description')
    latitude = request.data.get('latitude')
    longitude = request.data.get('longitude')
    image = request.FILES.get('image')

    # -----------------------------
    # Basic validation
    # -----------------------------
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

    # -----------------------------
    # Duplicate case detection
    # -----------------------------
    existing_case = find_nearby_case(latitude, longitude)

    if existing_case:
        case = existing_case
        message = "Report attached to existing case"
    else:
        case = Case.objects.create(
            description=description,
            latitude=latitude,
            longitude=longitude,
            reported_by=user
        )
        message = "New case created and report added"

    # -----------------------------
    # Create report
    # -----------------------------
    report = Report.objects.create(
        case=case,
        user=user,
        image=image,
        description=description,
        latitude=latitude,
        longitude=longitude,
    )

    return Response(
        {
            "message": message,
            "case_id": case.id,
            "report_id": report.id
        },
        status=status.HTTP_201_CREATED
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
        return queryset.filter(Q(organization__isnull=True) | Q(organization=organization))

    @action(detail=False, methods=["get"], url_path="nearby")
    def nearby(self, request):
        organization = request.user.organization_profile
        queryset = self.get_queryset().filter(organization__isnull=True).exclude(status="closed")
        radius_km = float(request.query_params.get("radius_km", 50))
        nearby_cases = []

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

        case.organization = organization
        case.assigned_to = request.user
        case.status = "assigned"
        case.save(update_fields=["organization", "assigned_to", "status", "updated_at"])

        serializer = self.get_serializer(case, context={"request": request})
        return Response(serializer.data)

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
        if new_status in ["rescued", "closed"]:
            from django.utils import timezone

            case.resolved_at = timezone.now()
            case.save(update_fields=["status", "resolved_at", "updated_at"])
        else:
            case.save(update_fields=["status", "updated_at"])

        serializer = self.get_serializer(case, context={"request": request})
        return Response(serializer.data)
