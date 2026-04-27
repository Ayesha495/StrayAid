from django.contrib.auth import get_user_model
from rest_framework import serializers
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
