from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CaseViewSet,
    case_ai_feedback,
    check_photo,
    case_detail,
    case_keep_updated,
    case_reports,
    case_updates,
    community_stats,
    keep_me_updated,
    map_cases,
    my_reports,
    report_case,
    trending_cases,
)

router = DefaultRouter()
router.register("", CaseViewSet, basename="case")

urlpatterns = [
    path('report/', report_case),
    path('check-photo/', check_photo),
    path('my-reports/', my_reports),
    path('reports/<int:report_id>/keep-updated/', keep_me_updated),
    # Public endpoints for the home screen; listed before the router's detail routes.
    path('trending/', trending_cases),
    path('map/', map_cases),
    path('stats/', community_stats),
    # Public case page (guests can read; keep-updated needs an account).
    path('public/<int:case_id>/', case_detail),
    path('public/<int:case_id>/updates/', case_updates),
    path('public/<int:case_id>/reports/', case_reports),
    path('public/<int:case_id>/keep-updated/', case_keep_updated),
    path('public/<int:case_id>/ai-feedback/', case_ai_feedback),
    path('', include(router.urls)),
]
