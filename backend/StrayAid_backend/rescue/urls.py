from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CaseViewSet, report_case

router = DefaultRouter()
router.register("", CaseViewSet, basename="case")

urlpatterns = [
    path('report/', report_case)
    ,path('', include(router.urls))
]
