"""AI confidence score for a rescue case (0-100).

score = round(100 * (0.5 * detector + 0.3 * severity + 0.2 * reports))

- detector: highest animal-class confidence from the image detector (0-1)
- severity: low 0.25, medium 0.5, high 0.75, critical 1
- reports: 1 report 0.33, 2 reports 0.67, 3 or more 1
"""

SEVERITY_WEIGHTS = {"low": 0.25, "medium": 0.5, "high": 0.75, "critical": 1.0}
POSSIBLY_INVALID_BELOW = 0.3


def report_weight(report_count):
    if report_count >= 3:
        return 1.0
    if report_count == 2:
        return 0.67
    if report_count == 1:
        return 0.33
    return 0.0


def compute_confidence_score(detector_confidence, severity, report_count):
    detector = min(max(detector_confidence or 0.0, 0.0), 1.0)
    value = (
        0.5 * detector
        + 0.3 * SEVERITY_WEIGHTS.get(severity, SEVERITY_WEIGHTS["medium"])
        + 0.2 * report_weight(report_count)
    )
    return round(100 * value)


def is_possibly_invalid(detector_confidence):
    return (detector_confidence or 0.0) < POSSIBLY_INVALID_BELOW
