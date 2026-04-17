from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CaseViewSet, my_reports, report_case

router = DefaultRouter()
router.register("", CaseViewSet, basename="case")

urlpatterns = [
    path('report/', report_case),
    path('my-reports/', my_reports),
    path('', include(router.urls)),
]
