"""AI confidence score for a rescue case (0-100), shown on Stitch screens 9-11.

    score = round(100 * (0.5 * photo + 0.3 * severity + 0.2 * reports) * freshness)

- photo: the detector's animal confidence (0-1), combined across every report photo as
  "chance that at least one photo shows an animal": 1 - (1 - c1)(1 - c2)... One photo is
  just its own confidence; more photos of the same animal strengthen it.
- severity: low 0.25, medium 0.5, high 0.75, critical 1
- reports: 1 report 0.33, 2 reports 0.67, 3 or more 1
- freshness: 1 for the first 6 hours after the latest report, then falls in a straight
  line to 0.5 at 72 hours, and never lower. It only counts while no organization has
  responded: once a case is accepted the clock stops. A new report restarts it, because
  it confirms the animal is still there.

Reports whose photo doesn't show an animal (detector confidence below 0.3) are refused
when submitted, to keep out false reports. `possibly_invalid` remains for older reports
saved before that check existed.

"reports" counts different people: one person reporting the same spot again doesn't
strengthen the score (and their new report starts a new case, see case_matcher.py).
"""

import threading
import time

from django.utils import timezone

SEVERITY_WEIGHTS = {"low": 0.25, "medium": 0.5, "high": 0.75, "critical": 1.0}
POSSIBLY_INVALID_BELOW = 0.3
# A new report's photo needs at least this animal confidence to be accepted.
ANIMAL_REQUIRED = POSSIBLY_INVALID_BELOW

FRESH_HOURS = 6
FLOOR_HOURS = 72
FRESHNESS_FLOOR = 0.5


def report_weight(report_count):
    if report_count >= 3:
        return 1.0
    if report_count == 2:
        return 0.67
    if report_count == 1:
        return 0.33
    return 0.0


def combined_photo_confidence(confidences):
    """Chance that at least one photo shows an animal (None if no photo was scored)."""
    scored = [min(max(value, 0.0), 1.0) for value in confidences if value is not None]
    if not scored:
        return None
    miss = 1.0
    for value in scored:
        miss *= 1.0 - value
    return 1.0 - miss


def freshness_factor(hours_unanswered):
    if hours_unanswered <= FRESH_HOURS:
        return 1.0
    slope = (1.0 - FRESHNESS_FLOOR) / (FLOOR_HOURS - FRESH_HOURS)
    return max(FRESHNESS_FLOOR, 1.0 - slope * (hours_unanswered - FRESH_HOURS))


def compute_confidence_score(detector_confidence, severity, report_count, freshness=1.0):
    detector = min(max(detector_confidence or 0.0, 0.0), 1.0)
    value = (
        0.5 * detector
        + 0.3 * SEVERITY_WEIGHTS.get(severity, SEVERITY_WEIGHTS["medium"])
        + 0.2 * report_weight(report_count)
    )
    return round(100 * value * freshness)


def is_possibly_invalid(detector_confidence):
    return (detector_confidence or 0.0) < POSSIBLY_INVALID_BELOW


def answered_at(case):
    """When an organization first responded (the case left "reported"), or None."""
    if case.status == "reported":
        return None
    first_response = case.updates.exclude(status__in=["", "reported"]).order_by("created_at").first()
    return first_response.created_at if first_response else case.updated_at


def score_breakdown(case, now=None):
    """Every input to the case score, for saving it and for explaining it on screen 11."""
    reports = list(case.reports.all())
    reporter_count = len({report.user_id for report in reports})
    photo = combined_photo_confidence([report.ai_animal_confidence for report in reports])
    latest_report = max((report.created_at for report in reports), default=case.created_at)
    responded = answered_at(case)
    # The clock runs from the latest report until an organization responds (or until now).
    end = responded or now or timezone.now()
    hours = max(0.0, (end - latest_report).total_seconds() / 3600)
    freshness = freshness_factor(hours)
    return {
        "photo": photo,
        "photo_count": sum(1 for report in reports if report.ai_animal_confidence is not None),
        "severity": SEVERITY_WEIGHTS.get(case.severity, SEVERITY_WEIGHTS["medium"]),
        "report_count": reporter_count,
        "reports": report_weight(reporter_count),
        "hours_unanswered": round(hours, 1),
        "answered": responded is not None,
        "freshness": round(freshness, 4),
        "score": None if photo is None else compute_confidence_score(photo, case.severity, reporter_count, freshness),
    }


def score_report(report):
    """Run the animal detector on a report's photo and store what it found.
    Returns False if the detector isn't available."""
    from rescue.ai.detector import detect_animal

    if not report.image:
        return False
    with report.image.open("rb") as image_file:
        result = detect_animal(image_file)
    if result is None:
        return False
    report.ai_animal_confidence = result["confidence"]
    report.ai_animal_label = result["label"]
    report.ai_box = result["box"]
    report.save(update_fields=["ai_animal_confidence", "ai_animal_label", "ai_box"])
    return True


def best_scored_report(case):
    """The case's report with the strongest animal detection (None if none were scored)."""
    scored = [report for report in case.reports.all() if report.ai_animal_confidence is not None]
    return max(scored, key=lambda report: report.ai_animal_confidence, default=None)


def score_new_report(report):
    """Score a just-saved report. Once the model is loaded this is instant and done in the
    request; while the server is still loading it, the report is scored in the background
    so the reporter isn't kept waiting. Returns True if the score is already up to date."""
    from django.conf import settings

    from rescue.ai.detector import is_ready

    if is_ready() or not getattr(settings, "AI_SCORE_IN_BACKGROUND", True):
        score_report(report)
        refresh_case_score(report.case)
        return True

    threading.Thread(target=_score_in_background, args=(report.pk,), daemon=True).start()
    return False


def _score_in_background(report_id):
    from django.db import connection

    from rescue.models import Report

    try:
        report = Report.objects.select_related("case").get(pk=report_id)
        score_report(report)
        refresh_case_score(report.case)
    finally:
        connection.close()


def refresh_case_score(case, now=None):
    """Recalculate and save the case score. Unscored cases keep a null score.
    Returns True if anything changed."""
    breakdown = score_breakdown(case, now)
    score = breakdown["score"]
    invalid = breakdown["photo"] is not None and is_possibly_invalid(breakdown["photo"])
    if case.confidence_score == score and case.possibly_invalid == invalid:
        return False
    case.confidence_score = score
    case.possibly_invalid = invalid
    case.save(update_fields=["confidence_score", "possibly_invalid"])
    return True


def refresh_unanswered_scores(now=None):
    """Re-save the scores of cases still waiting for an organization, since those fall
    over time. Answered cases are frozen, so they never need this."""
    from rescue.models import Case

    changed = 0
    for case in Case.objects.filter(status="reported", confidence_score__isnull=False).prefetch_related("reports"):
        changed += refresh_case_score(case, now)
    return changed


# Lists that sort by score call this; it does the refresh at most every few minutes per
# server process, so no scheduled job is needed.
REFRESH_EVERY_SECONDS = 600
_last_refresh = 0.0
_refresh_lock = threading.Lock()


def refresh_unanswered_scores_if_due():
    global _last_refresh
    if time.monotonic() - _last_refresh < REFRESH_EVERY_SECONDS:
        return
    with _refresh_lock:
        if time.monotonic() - _last_refresh < REFRESH_EVERY_SECONDS:
            return
        _last_refresh = time.monotonic()
    refresh_unanswered_scores()
