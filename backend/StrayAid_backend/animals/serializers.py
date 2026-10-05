from rest_framework import serializers

from .models import Animal
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

    def get_application_count(self, obj):
        return obj.adoption_applications.exclude(status="withdrawn").count()

    def get_ai_verified(self, obj):
        # The rescue that brought the animal in was confirmed by the AI photo check.
        case = obj.case
        return bool(case and case.confidence_score is not None and case.confidence_score >= 70 and not case.possibly_invalid)

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
