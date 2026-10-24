"""Profile and Activity screens: your impact, your timeline and your profile settings."""

from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .impact import impact_for, report_cases

TONE_FOR_CASE = {
    "reported": "amber",
    "assigned": "blue",
    "in_progress": "blue",
    "rescued": "green",
    "adoption": "green",
    "closed": "grey",
}
APPLICATION_LABELS = {
    "pending": ("Review pending", "amber"),
    "approved": ("Approved", "green"),
    "rejected": ("Not approved", "red"),
    "withdrawn": ("Withdrawn", "grey"),
}
ANIMAL_LABELS = {
    "rescued": ("Rescued", "green"),
    "recovering": ("In treatment", "blue"),
    "adoptable": ("Ready for adoption", "green"),
    "adopted": ("Adopted", "grey"),
}


def _url(request, file):
    return request.build_absolute_uri(file.url) if file else None


def _case_image(request, case):
    report = case.reports.exclude(image="").order_by("created_at").first()
    return _url(request, report.image) if report else None


def _item(kind, key, date, title, subtitle, status_label, tone, image, link, tag="", extra="", search=""):
    return {
        "id": f"{kind}-{key}",
        "kind": kind,
        "date": date,
        "title": title,
        "subtitle": subtitle,
        "status": {"label": status_label, "tone": tone},
        "tag": tag,
        "extra": extra,
        "image": image,
        "link": link,
        "search": " ".join(part for part in [title, subtitle, tag, search] if part).lower(),
    }


def activity_items(user, request):
    """One timeline of everything someone did or follows (Stitch 24), newest first."""
    from animals.models import AdoptionApplication, Sponsorship
    from notifications.models import AnimalFollow, CaseFollow
    from posts.models import SavedPost

    items = []
    for case in report_cases(user).select_related("organization").prefetch_related("reports"):
        species = case.species or "animal"
        first = min((report.created_at for report in case.reports.all() if report.user_id == user.id), default=case.created_at)
        organization = case.organization.name if case.organization_id else "Waiting for a rescue team"
        items.append(_item(
            "report", case.id, first, f"Reported a {species.lower()}", case.area or "Location shared",
            case.get_status_display(), TONE_FOR_CASE.get(case.status, "grey"), _case_image(request, case),
            {"type": "case", "id": case.id}, tag=f"#{case.reference}", extra=organization,
        ))
        animal = getattr(case, "animal", None)
        if animal and animal.status == "adopted":
            items.append(_item(
                "rehomed", animal.id, animal.updated_at, "Rescued & adopted",
                " • ".join(part for part in [animal.name, case.area] if part), "Successfully rehomed", "green",
                _url(request, animal.image), {"type": "animal", "id": animal.id},
            ))

    for follow in CaseFollow.objects.filter(user=user).select_related("case", "case__organization"):
        case = follow.case
        organization = case.organization.name if case.organization_id else ""
        score = f"{case.confidence_score}% AI match" if case.confidence_score is not None else ""
        items.append(_item(
            "followed_case", case.id, follow.created_at, "Following a rescue",
            " • ".join(part for part in [case.area, organization] if part), case.get_status_display(),
            TONE_FOR_CASE.get(case.status, "grey"), _case_image(request, case), {"type": "case", "id": case.id},
            tag=f"#{case.reference}", extra=score,
        ))

    for follow in AnimalFollow.objects.filter(user=user).select_related("animal", "animal__organization"):
        animal = follow.animal
        label, tone = ANIMAL_LABELS.get(animal.status, (animal.get_status_display(), "grey"))
        organization = animal.organization.name if animal.organization_id else ""
        items.append(_item(
            "followed_animal", animal.id, follow.created_at, f"Following {animal.name}",
            " • ".join(part for part in [animal.species, organization] if part), label, tone,
            _url(request, animal.image), {"type": "animal", "id": animal.id},
        ))

    for application in AdoptionApplication.objects.filter(applicant=user).select_related("animal"):
        animal = application.animal
        label, tone = APPLICATION_LABELS.get(application.status, (application.status, "grey"))
        age = f"{animal.age} {'yr' if animal.age == 1 else 'yrs'}" if animal.age is not None else ""
        items.append(_item(
            "application", application.id, application.created_at, "Adoption application",
            " • ".join(part for part in [animal.name, animal.breed or animal.species, age] if part), label, tone,
            _url(request, animal.image), {"type": "application", "id": application.id},
        ))

    now = timezone.now()
    for pledge in Sponsorship.objects.filter(sponsor=user).select_related("animal", "animal__organization"):
        animal = pledge.animal
        amount = f"PKR {pledge.amount_pkr:,}{' / mo' if pledge.monthly else ''}"
        if pledge.status == "confirmed":
            label, tone = ("Active donor" if pledge.monthly else "Confirmed"), "green"
        elif pledge.status == "pending":
            label, tone = "Receipt being checked", "amber"
        else:
            label, tone = "Not confirmed", "red"
        extra = ""
        if pledge.monthly and pledge.status == "confirmed":
            # Monthly pledges renew every 30 days from the first transfer.
            days = 30 - ((now - pledge.created_at).days % 30)
            extra = f"Renews in {days} {'day' if days == 1 else 'days'}"
        items.append(_item(
            "sponsorship", pledge.id, pledge.created_at, "Monthly sponsorship" if pledge.monthly else "One-time gift",
            " • ".join([animal.name, amount]), label, tone, _url(request, animal.image),
            {"type": "sponsor", "id": animal.id}, extra=extra,
        ))

    for saved in SavedPost.objects.filter(user=user).select_related("post", "post__organization", "post__animal"):
        post = saved.post
        items.append(_item(
            "saved", post.id, saved.created_at, f"Saved post about {post.animal.name}", post.organization.name,
            "Saved", "blue", _url(request, post.image), {"type": "post", "id": post.id, "animal_id": post.animal_id},
            search=post.content,
        ))

    items.sort(key=lambda item: item["date"], reverse=True)
    return items


# Activity filters (Stitch 24) and the kinds of entry each one shows.
FILTERS = {
    "reports": {"report", "rehomed"},
    "followed": {"followed_case", "followed_animal"},
    "applications": {"application"},
    "sponsorships": {"sponsorship"},
    "saved": {"saved"},
}


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_impact(request):
    user = request.user
    data = impact_for(user)
    data["member_since"] = user.date_joined
    data["area"] = user.area
    return Response(data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_activity(request):
    items = activity_items(request.user, request)
    counts = {key: sum(1 for item in items if item["kind"] in kinds) for key, kinds in FILTERS.items()}
    counts["all"] = len(items)
    impact = impact_for(request.user)
    return Response({
        "counts": counts,
        "items": items,
        "summary": {
            "reports": impact["reports"],
            "adoptions": impact["adoptions"],
            "pledged_pkr": impact["pledged_pkr"],
            "level": impact["level"],
            "city": impact["city"],
        },
    })


class ProfileSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    area = serializers.CharField(max_length=100, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    avatar = serializers.ImageField(required=False)
    field_ready = serializers.BooleanField(required=False)
    radius_alerts = serializers.BooleanField(required=False)
    alert_latitude = serializers.FloatField(required=False, allow_null=True, min_value=-90, max_value=90)
    alert_longitude = serializers.FloatField(required=False, allow_null=True, min_value=-180, max_value=180)

    def validate_phone(self, value):
        digits = "".join(character for character in value if character.isdigit())
        if value and not 10 <= len(digits) <= 15:
            raise serializers.ValidationError("Enter a valid phone number, e.g. +92 300 1234567.")
        return value.strip()

    def validate(self, attrs):
        user = self.context["request"].user
        turning_on = attrs.get("radius_alerts")
        latitude = attrs.get("alert_latitude", user.alert_latitude)
        if turning_on and latitude is None:
            raise serializers.ValidationError({"radius_alerts": "Share your location to get alerts near you."})
        if attrs.get("field_ready") and not (attrs.get("phone") or user.phone):
            raise serializers.ValidationError({"field_ready": "Add a phone number so rescue teams can reach you."})
        return attrs


def profile_data(user, request):
    phone = user.phone
    masked = f"{phone[:7]}••••{phone[-3:]}" if len(phone) >= 10 else phone
    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
        "avatar": _url(request, user.avatar),
        "area": user.area,
        "phone": phone,
        "phone_masked": masked,
        "field_ready": user.field_ready,
        "radius_alerts": user.radius_alerts,
        "alert_radius_km": user.ALERT_RADIUS_KM,
        "member_since": user.date_joined,
    }


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
@parser_classes([JSONParser, MultiPartParser, FormParser])
def my_profile(request):
    """GET or PATCH your profile: name, photo, area, phone and the alert settings."""
    user = request.user
    if request.method == "PATCH":
        serializer = ProfileSerializer(data=request.data, context={"request": request}, partial=True)
        serializer.is_valid(raise_exception=True)
        for field, value in serializer.validated_data.items():
            setattr(user, field, value)
        user.save()
    return Response(profile_data(user, request), status=status.HTTP_200_OK)

