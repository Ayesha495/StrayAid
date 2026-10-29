from rest_framework import serializers

from .models import Organization


class OrganizationSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_username = serializers.CharField(source="user.username", read_only=True)
    phone_number = serializers.CharField(source="phone", required=False, allow_blank=True)
    contact_email = serializers.EmailField(source="email", required=False, allow_blank=True)

    class Meta:
        model = Organization
        fields = [
            "id",
            "user",
            "user_email",
            "user_username",
            "name",
            "description",
            "image",
            "latitude",
            "longitude",
            "address",
            "city",
            "capacity",
            "phone_number",
            "contact_email",
            "radius",
            "bank_name",
            "bank_account_title",
            "bank_account_number",
            "tax_id",
            "payment_notes",
            "supply_goal_pkr",
            "is_verified",
        ]
        read_only_fields = ["id", "user", "user_email", "user_username", "is_verified"]

    # The account behind a team (its login email, username and user id) is only for the team
    # itself. Everyone else, including other teams, gets the public profile: it is embedded in
    # every public animal, post and case, so it must not carry login details.
    PRIVATE_FIELDS = ("user", "user_email", "user_username")

    def to_representation(self, instance):
        data = super().to_representation(instance)
        viewer = getattr(self.context.get("request"), "user", None)
        if not (viewer and viewer.is_authenticated and viewer.id == instance.user_id):
            for field in self.PRIVATE_FIELDS:
                data.pop(field, None)
        return data
