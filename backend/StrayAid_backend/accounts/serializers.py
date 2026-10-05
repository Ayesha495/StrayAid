from django.contrib.auth import get_user_model
from djoser.serializers import UserCreatePasswordRetypeSerializer
from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class UsernameOrEmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Allow login using either email or username on the JWT obtain endpoint."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.fields[self.username_field].required = False

        if self.username_field != "email":
            self.fields["email"] = serializers.CharField(write_only=True, required=False)

        if self.username_field != "username":
            self.fields["username"] = serializers.CharField(write_only=True, required=False)

    def validate(self, attrs):
        login_value = (
            attrs.get(self.username_field)
            or attrs.get("email")
            or attrs.get("username")
            or ""
        ).strip()

        if not login_value:
            self.fail("no_active_account")

        attrs[self.username_field] = self._resolve_login_value(login_value)
        return super().validate(attrs)

    def _resolve_login_value(self, login_value):
        if self.username_field != "email":
            return login_value

        user_model = get_user_model()
        matched_user = (
            user_model.objects.filter(email__iexact=login_value).only("email").first()
            or user_model.objects.filter(username__iexact=login_value).only("email").first()
        )

        return matched_user.email if matched_user else login_value


MAX_AVATAR_BYTES = 5 * 1024 * 1024


def build_unique_username(email):
    # Usernames stay unique internally even though people sign up with just a name and email.
    base_username = (email.split("@")[0] if email else "user").strip() or "user"
    candidate = base_username
    suffix = 1

    while get_user_model().objects.filter(username__iexact=candidate).exists():
        candidate = f"{base_username}{suffix}"
        suffix += 1

    return candidate


class StrayAidUserCreateSerializer(UserCreatePasswordRetypeSerializer):
    """Sign-up used by mobile (full name + email + photo) and web (username + email).

    The username is optional and generated from the email when missing. `full_name` is split
    into first and last name. `avatar` is an optional profile photo (multipart upload).
    """

    full_name = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=150)

    class Meta(UserCreatePasswordRetypeSerializer.Meta):
        fields = UserCreatePasswordRetypeSerializer.Meta.fields + ("full_name", "avatar")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["username"].required = False
        self.fields["avatar"].required = False
        # validate_email gives a friendlier duplicate message than the model's unique check.
        self.fields["email"].validators = [
            validator for validator in self.fields["email"].validators if not isinstance(validator, UniqueValidator)
        ]

    def validate_email(self, value):
        email = value.strip().lower()
        if get_user_model().objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return email

    def validate_avatar(self, value):
        if value and value.size > MAX_AVATAR_BYTES:
            raise serializers.ValidationError("Choose a photo smaller than 5 MB.")
        return value

    def validate(self, attrs):
        full_name = " ".join(attrs.pop("full_name", "").split())
        if full_name:
            first_name, _, last_name = full_name.partition(" ")
            attrs["first_name"] = first_name[:150]
            attrs["last_name"] = last_name[:150]
        if not attrs.get("username"):
            attrs["username"] = build_unique_username(attrs.get("email", ""))
        return super().validate(attrs)
