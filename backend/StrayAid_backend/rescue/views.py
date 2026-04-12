from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import Case, Report
from .utils.case_matcher import find_nearby_case


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