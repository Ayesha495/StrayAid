from django.urls import path

from .password_reset import confirm_password_reset, request_password_reset
from .views import google_auth, me


urlpatterns = [
    path("google/", google_auth, name="google_auth"),
    path("me/", me, name="me"),
    path("password-reset/", request_password_reset, name="password_reset"),
    path("password-reset/confirm/", confirm_password_reset, name="password_reset_confirm"),
]
