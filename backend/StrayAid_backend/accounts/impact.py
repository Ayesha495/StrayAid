"""A person's rescue impact: the numbers, points, level and badges on their Profile and
Activity screens. Everything is worked out from what they actually did in the app."""

import math

from django.db.models import Count, Sum

# Points for each kind of help. A report the rescue team acted on is worth more than one
# still waiting, so people are rewarded for accurate reports.
POINTS_REPORT = 20
POINTS_RESCUED = 30
POINTS_PER_100_PKR = 1
POINTS_ADOPTION = 100
POINTS_COMMENT = 2

# (points needed, title). Level numbers start at 1.
LEVELS = [(0, "Helper"), (150, "Hero"), (500, "Guardian"), (1200, "Champion"), (2500, "Legend")]

RESOLVED_STATUSES = ["rescued", "adoption", "closed"]
ACTIVE_STATUSES = ["reported", "assigned", "in_progress"]


def _level_for(points):
    index = max(i for i, (needed, _) in enumerate(LEVELS) if points >= needed)
    needed, name = LEVELS[index]
    upcoming = LEVELS[index + 1] if index + 1 < len(LEVELS) else None
    progress = 1.0 if not upcoming else (points - needed) / (upcoming[0] - needed)
    return {
        "number": index + 1,
        "name": name,
        "next_name": upcoming[1] if upcoming else None,
        "next_points": upcoming[0] if upcoming else None,
        "progress": round(progress, 3),
        # How many reports that lead to a rescue would get them there.
        "reports_to_next": math.ceil((upcoming[0] - points) / (POINTS_REPORT + POINTS_RESCUED)) if upcoming else 0,
    }


def report_cases(user):
    from rescue.models import Case

    return Case.objects.filter(reports__user=user).distinct()


def impact_for(user):
    from animals.models import AdoptionApplication, Animal, Sponsorship
    from posts.models import PostComment
    from rescue.models import Case, Report

    reports = Report.objects.filter(user=user)
    report_count = reports.count()
    cases = report_cases(user)
    case_count = cases.count()
    resolved = cases.filter(status__in=RESOLVED_STATUSES).count()
    in_care = Animal.objects.filter(case__in=cases).exclude(status=Animal.STATUS_ADOPTED).count()
    pledged = Sponsorship.objects.filter(sponsor=user, status="confirmed").aggregate(total=Sum("amount_pkr"))["total"] or 0
    adoptions = AdoptionApplication.objects.filter(applicant=user, status="approved").count()
    comments = PostComment.objects.filter(user=user).count()

    points = (
        report_count * POINTS_REPORT
        + resolved * POINTS_RESCUED
        + (pledged // 100) * POINTS_PER_100_PKR
        + adoptions * POINTS_ADOPTION
        + comments * POINTS_COMMENT
    )

    # Share of their reports the AI photo check and the rescue teams treated as genuine.
    trusted = cases.exclude(possibly_invalid=True).filter(confidence_score__gte=50).count()
    accuracy = round(100 * trusted / case_count) if case_count else None

    first_on_scene = Case.objects.filter(reported_by=user).count()
    monthly = Sponsorship.objects.filter(sponsor=user, status="confirmed", monthly=True).exists()

    # Top reporters in their city, among people who have reported at all.
    city = (user.area.split(",")[-1].strip() if user.area else "") or "Islamabad"
    ranking = list(
        Report.objects.values("user").annotate(total=Count("case", distinct=True)).order_by("-total").values_list("user", flat=True)
    )
    top_share = max(1, math.ceil(len(ranking) * 0.05)) if ranking else 0
    is_top = case_count >= 2 and user.id in ranking[:max(top_share, 1)]

    badges = [
        _badge("first_responder", "First Responder", "First on the scene", "speed", first_on_scene >= 1, first_on_scene, 1),
        _badge("eagle_eye", "Eagle Eye", "10+ reports with GPS", "pin_drop", report_count >= 10, report_count, 10),
        _badge("community_star", "Community Star", f"Top 5% in {city}", "military_tech", is_top, 1 if is_top else 0, 1),
        _badge("life_saver", "Life Saver", "5 rescued reports", "healing", resolved >= 5, resolved, 5),
        _badge("forever_friend", "Forever Friend", "Adopted a rescue", "home", adoptions >= 1, adoptions, 1),
        _badge("kind_heart", "Kind Heart", "Sponsored an animal", "favorite", pledged > 0, 1 if pledged else 0, 1),
        _badge("monthly_guardian", "Monthly Guardian", "Monthly sponsor", "event_repeat", monthly, 1 if monthly else 0, 1),
        _badge("voice", "Voice of the Street", "5 kind comments", "forum", comments >= 5, comments, 5),
    ]
    # Earned badges first.
    badges.sort(key=lambda badge: not badge["earned"])

    return {
        "reports": report_count,
        "cases": case_count,
        "rescued": resolved,
        "active_cases": cases.filter(status__in=ACTIVE_STATUSES).count(),
        "critical_cases": cases.filter(severity="critical").count(),
        "in_care": in_care,
        "pledged_pkr": pledged,
        "adoptions": adoptions,
        "comments": comments,
        "points": points,
        "level": _level_for(points),
        "accuracy": accuracy,
        "badges": badges,
        "badges_earned": sum(1 for badge in badges if badge["earned"]),
        "city": city,
    }


def _badge(key, name, rule, icon, earned, progress, goal):
    return {"key": key, "name": name, "rule": rule, "icon": icon, "earned": bool(earned), "progress": min(progress, goal), "goal": goal}
