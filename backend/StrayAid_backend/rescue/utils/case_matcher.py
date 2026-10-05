from datetime import timedelta

from django.db.models import Max
from django.db.models.functions import Coalesce
from django.utils import timezone

from rescue.models import Case
from .location_utils import calculate_distance


FIFTEEN_FEET_IN_METERS = 4.572
# A sighting only joins a case that has been active this recently.
RECENT_HOURS = 48


def find_nearby_case(latitude, longitude, user=None, animal=""):
    """The open case this new report is a repeat sighting of, or None for a new case.

    A report joins a case only if the case is still open (rescued/adoption/closed cases are
    finished), was reported in the last 48 hours, is within 15 feet, shows the same kind of
    animal when the detector knows, and was not already reported by the same person: their
    next report is a different animal, and repeat reports by one person must not inflate
    the AI score's "related reports" part.
    """
    cutoff = timezone.now() - timedelta(hours=RECENT_HOURS)
    open_cases = (
        Case.objects.filter(status__in=["reported", "assigned", "in_progress"])
        .annotate(last_seen=Coalesce(Max("reports__created_at"), "created_at"))
        .filter(last_seen__gte=cutoff)
        .prefetch_related("reports")
    )
    if user is not None:
        open_cases = open_cases.exclude(reports__user=user)

    for case in open_cases:
        if calculate_distance(latitude, longitude, case.latitude, case.longitude) > FIFTEEN_FEET_IN_METERS:
            continue
        labels = {report.ai_animal_label for report in case.reports.all() if report.ai_animal_label}
        if animal and labels and animal not in labels:
            continue
        return case
    return None
