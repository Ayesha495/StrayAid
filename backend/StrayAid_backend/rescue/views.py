from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Case, Report

# Create your views here.

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def report_case(request):
    user = request.user
    description = request.data.get('description')
    latitude = request.data.get('latitude')
    longitude = request.data.get('longitude')
    image = request.FILES.get('image')

    case = Case.objects.create(
        description = description,
        latitude=latitude,
        longitude = longitude,
        reported_by = user
    )

    report = Report.objects.create(
        case=case,
        user=user,
        image=image,
        description = description,
        latitude=latitude,
        longitude = longitude,
    )

    return Response({"message": "Case reported successfully"})
