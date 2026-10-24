from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend

UserModel = get_user_model()


class UsernameOrEmailBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        login_value = (username or kwargs.get("email") or "").strip()
        if not login_value or password is None:
            return None

        user = (
            UserModel.objects.filter(email__iexact=login_value).first()
            or UserModel.objects.filter(username__iexact=login_value).first()
        )
        if user is None:
            # Same work as a real check, so response times don't reveal which accounts exist.
            UserModel().set_password(password)
            return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
