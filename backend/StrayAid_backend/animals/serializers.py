from django.db.models import Sum
from rest_framework import serializers

from .models import AdoptionApplication, Animal, Sponsorship
from organizations.serializers import OrganizationSerializer


class AnimalSerializer(serializers.ModelSerializer):
    organization = OrganizationSerializer(read_only=True)
    organization_id = serializers.IntegerField(write_only=True, required=False)
    case_id = serializers.IntegerField(source="case.id", read_only=True)
    adoption_info = serializers.SerializerMethodField()
    donation_info = serializers.SerializerMethodField()
    # Profile page extras (Stitch 13).
    photos = serializers.SerializerMethodField()
    sponsor_count = serializers.SerializerMethodField()
    application_count = serializers.SerializerMethodField()
    ai_verified = serializers.SerializerMethodField()
    my_application = serializers.SerializerMethodField()
    # Sponsor screen (Stitch 16).
    sponsor_initials = serializers.SerializerMethodField()
    raised_pkr = serializers.SerializerMethodField()
    my_sponsorship = serializers.SerializerMethodField()
    # Where it was found, for search results.
    area = serializers.CharField(source="case.area", read_only=True)

    class Meta:
        model = Animal
        fields = [
            "id",
            "case",
            "case_id",
            "organization",
            "organization_id",
            "name",
            "species",
            "breed",
            "gender",
            "age",
            "color",
            "microchip_id",
            "description",
            "medical_info",
            "donation_info",
            "adoption_info",
            "status",
            "image",
            "health",
            "vaccinated",
            "photos",
            "sponsor_count",
            "application_count",
            "ai_verified",
            "my_application",
            "sponsor_goal",
            "funding_goal_pkr",
            "raised_pkr",
            "sponsor_initials",
            "my_sponsorship",
            "area",
            "created_at",
        ]
        read_only_fields = ["id", "organization", "case_id", "created_at"]

    def get_photos(self, obj):
        """The animal's own photo, then photos from its organization's posts about it."""
        request = self.context.get("request")
        files = [obj.image] + [post.image for post in obj.posts.all()]
        urls = []
        for file in files:
            if file:
                url = request.build_absolute_uri(file.url) if request else file.url
                if url not in urls:
                    urls.append(url)
        return urls[:6]

    def get_sponsor_count(self, obj):
        # People with a confirmed pledge; pending ones aren't counted until the receipt checks out.
        return obj.sponsorships.filter(status="confirmed").values("sponsor").distinct().count()

    def get_raised_pkr(self, obj):
        # Money from confirmed pledges; pending receipts don't count until the organization checks them.
        return obj.sponsorships.filter(status="confirmed").aggregate(total=Sum("amount_pkr"))["total"] or 0

    def get_application_count(self, obj):
        return obj.adoption_applications.exclude(status="withdrawn").count()

    def get_ai_verified(self, obj):
        # The rescue that brought the animal in was confirmed by the AI photo check.
        case = obj.case
        return bool(case and case.confidence_score is not None and case.confidence_score >= 70 and not case.possibly_invalid)

    def get_my_application(self, obj):
        """The signed-in viewer's own active application for this animal, if any."""
        user = getattr(self.context.get("request"), "user", None)
        if not user or not user.is_authenticated:
            return None
        application = (
            obj.adoption_applications.filter(applicant=user, status__in=AdoptionApplication.ACTIVE_STATUSES)
            .order_by("-created_at")
            .first()
        )
        return {"id": application.id, "status": application.status} if application else None

    def get_sponsor_initials(self, obj):
        """Initials of up to three confirmed sponsors, for the little avatar stack."""
        initials = []
        for sponsorship in obj.sponsorships.filter(status="confirmed").select_related("sponsor").order_by("-created_at"):
            person = sponsorship.sponsor
            letters = ((person.first_name[:1] + person.last_name[:1]) or person.username[:2]).upper()
            if letters not in initials:
                initials.append(letters)
            if len(initials) == 3:
                break
        return initials

    def get_my_sponsorship(self, obj):
        """The viewer's latest pledge that hasn't been turned down."""
        user = getattr(self.context.get("request"), "user", None)
        if not user or not user.is_authenticated:
            return None
        pledge = obj.sponsorships.filter(sponsor=user).exclude(status="rejected").order_by("-created_at").first()
        if not pledge:
            return None
        return {"id": pledge.id, "status": pledge.status, "amount_pkr": pledge.amount_pkr, "monthly": pledge.monthly}

    def get_adoption_info(self, obj):
        organization = obj.organization
        if not organization:
            return None

        return {
            "message": f"To adopt {obj.name}, contact {organization.name} via",
            "phone": organization.phone,
            "email": organization.email or organization.user.email,
        }

    def get_donation_info(self, obj):
        organization = obj.organization
        if not organization:
            return None

        if not any([organization.bank_name, organization.bank_account_title, organization.bank_account_number]):
            return None

        return {
            "bank": organization.bank_name,
            "account_name": organization.bank_account_title,
            "account_number": organization.bank_account_number,
        }



class AdoptionApplicationSerializer(serializers.ModelSerializer):
    """The adoption form (Stitch 14). Required answers mirror the app's checks."""

    animal_name = serializers.CharField(source="animal.name", read_only=True)

    class Meta:
        model = AdoptionApplication
        fields = [
            "id", "animal", "animal_name", "status", "created_at",
            "full_name", "phone", "home_type", "has_other_pets",
            "city", "ownership", "landlord_allows_pets", "household_size", "has_children", "hours_alone", "experience",
            "reason", "care_plan", "agrees_home_visit", "agrees_return_policy",
        ]
        read_only_fields = ["id", "animal", "animal_name", "status", "created_at"]
        extra_kwargs = {
            "city": {"required": True, "allow_blank": False},
            "ownership": {"required": True, "allow_blank": False},
            "household_size": {"required": True, "allow_null": False, "min_value": 1, "max_value": 30},
            "hours_alone": {"required": True, "allow_null": False, "max_value": 24},
            "experience": {"required": True, "allow_blank": False},
            "reason": {"required": True, "allow_blank": False},
        }

    def validate_full_name(self, value):
        value = " ".join(value.split())
        if len(value) < 3:
            raise serializers.ValidationError("Enter your full name.")
        return value

    def validate_phone(self, value):
        digits = "".join(character for character in value if character.isdigit())
        if not 10 <= len(digits) <= 15:
            raise serializers.ValidationError("Enter a valid phone number, e.g. +92 300 1234567.")
        return value.strip()

    def validate_reason(self, value):
        if len(value.strip()) < 20:
            raise serializers.ValidationError("Tell the organization a little more (at least 20 characters).")
        return value.strip()

    def validate(self, attrs):
        if attrs.get("ownership") == "rent" and attrs.get("landlord_allows_pets") is None:
            raise serializers.ValidationError({"landlord_allows_pets": "Say whether your landlord allows pets."})
        if attrs.get("ownership") == "own":
            attrs["landlord_allows_pets"] = None
        if not attrs.get("agrees_home_visit") or not attrs.get("agrees_return_policy"):
            raise serializers.ValidationError({"agreements": "Please accept both promises to apply."})
        return attrs


def _animal_summary(animal, request):
    image = animal.image
    organization = animal.organization
    return {
        "id": animal.id,
        "name": animal.name,
        "species": animal.species,
        "status": animal.status,
        "image": (request.build_absolute_uri(image.url) if request else image.url) if image else None,
        "organization": {"id": organization.id, "name": organization.name, "city": organization.city} if organization else None,
    }


class MyApplicationSerializer(AdoptionApplicationSerializer):
    """An application on "My Applications" (Stitch 15), with the animal it's for."""

    animal = serializers.SerializerMethodField()

    class Meta(AdoptionApplicationSerializer.Meta):
        fields = AdoptionApplicationSerializer.Meta.fields + ["decided_at"]
        read_only_fields = fields

    def get_animal(self, obj):
        return _animal_summary(obj.animal, self.context.get("request"))


class SponsorshipSerializer(serializers.ModelSerializer):
    animal = serializers.SerializerMethodField()
    receipt = serializers.SerializerMethodField()
    # Who pledged, so the organization knows whose receipt it is checking.
    sponsor_name = serializers.SerializerMethodField()

    class Meta:
        model = Sponsorship
        fields = ["id", "animal", "sponsor_name", "amount_pkr", "monthly", "receipt", "status", "created_at"]
        read_only_fields = fields

    def get_animal(self, obj):
        return _animal_summary(obj.animal, self.context.get("request"))

    def get_sponsor_name(self, obj):
        return obj.sponsor.get_full_name() or obj.sponsor.username

    def get_receipt(self, obj):
        request = self.context.get("request")
        if not obj.receipt:
            return None
        return request.build_absolute_uri(obj.receipt.url) if request else obj.receipt.url


class NewSponsorshipSerializer(serializers.Serializer):
    """Pledge form (Stitch 16): an amount, monthly or one-off, and the transfer receipt."""

    amount_pkr = serializers.IntegerField(
        min_value=100, max_value=500000,
        error_messages={"min_value": "The smallest pledge is PKR 100.", "max_value": "For more than PKR 500,000, please contact the organization."},
    )
    monthly = serializers.BooleanField(default=False)
    receipt = serializers.ImageField(error_messages={"required": "Attach a photo or screenshot of your transfer receipt."})
