from django.urls import path

from .views import google_auth, me


urlpatterns = [
    path("google/", google_auth, name="google_auth"),
    path("me/", me, name="me"),
]
