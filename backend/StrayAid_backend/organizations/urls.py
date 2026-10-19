from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import OrganizationViewSet, donations, review_donation

router = DefaultRouter()
router.register("", OrganizationViewSet, basename="organization")

urlpatterns = [
    path("donations/", donations, name="donations"),
    path("donations/<int:donation_id>/review/", review_donation, name="review-donation"),
    path("", include(router.urls)),
]
