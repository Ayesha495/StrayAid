from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CaseViewSet, community_stats, my_reports, report_case, trending_cases

router = DefaultRouter()
router.register("", CaseViewSet, basename="case")

urlpatterns = [
    path('report/', report_case),
    path('my-reports/', my_reports),
    # Public endpoints for the home screen; listed before the router's detail routes.
    path('trending/', trending_cases),
    path('stats/', community_stats),
    path('', include(router.urls)),
]
