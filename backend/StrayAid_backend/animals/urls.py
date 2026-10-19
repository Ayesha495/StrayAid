from django.urls import include, path
from rest_framework.routers import DefaultRouter, SimpleRouter

from .views import AnimalViewSet, ApplicationViewSet, SponsorshipViewSet

# Listed first so "applications" and "sponsorships" aren't read as animal ids.
people = SimpleRouter()
people.register("applications", ApplicationViewSet, basename="application")
people.register("sponsorships", SponsorshipViewSet, basename="sponsorship")

router = DefaultRouter()
router.register("", AnimalViewSet, basename="animal")

urlpatterns = [
    path("", include(people.urls)),
    path("", include(router.urls)),
]
