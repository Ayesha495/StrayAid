from rescue.models import Case
from .location_utils import calculate_distance
def find_nearby_case(latitude, longitude):

    open_cases = Case.objects.exclude(status="closed")

    for case in open_cases:
        distance = calculate_distance(
            latitude,
            longitude,
            case.latitude,
            case.longitude,
        )

        if distance < 10:
            return case