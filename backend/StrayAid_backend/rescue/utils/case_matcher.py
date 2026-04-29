from rescue.models import Case
from .location_utils import calculate_distance


FIFTEEN_FEET_IN_METERS = 4.572


def find_nearby_case(latitude, longitude):
    # Only unresolved intake-stage cases should absorb new public reports.
    # Rescued/adoption/closed cases represent completed workflows and should not
    # swallow fresh incidents happening at the same spot later.
    open_cases = Case.objects.filter(status__in=["reported", "assigned", "in_progress"])

    for case in open_cases:
        distance = calculate_distance(
            latitude,
            longitude,
            case.latitude,
            case.longitude,
        )

        if distance <= FIFTEEN_FEET_IN_METERS:
            return case
