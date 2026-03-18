from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model
from django.db.models import Q

UserModel = get_user_model()

class UsernameOrEmailBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        # Use username OR email from any parameter
        login_value = username or kwargs.get("email")
        if login_value is None or password is None:
            return None

        try:
            user = UserModel.objects.get(Q(username=login_value) | Q(email=login_value))
        except UserModel.DoesNotExist:
            return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user

        return None