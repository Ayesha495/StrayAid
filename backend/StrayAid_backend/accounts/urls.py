from django.urls import path

from .password_reset import confirm_password_reset, request_password_reset
from .profile_views import my_activity, my_impact, my_profile
from .views import google_auth, me


urlpatterns = [
    path("google/", google_auth, name="google_auth"),
    path("me/", me, name="me"),
    path("me/profile/", my_profile, name="my_profile"),
    path("me/impact/", my_impact, name="my_impact"),
    path("me/activity/", my_activity, name="my_activity"),
    path("password-reset/", request_password_reset, name="password_reset"),
    path("password-reset/confirm/", confirm_password_reset, name="password_reset_confirm"),
]
