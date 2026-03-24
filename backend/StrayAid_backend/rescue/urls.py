from django.urls import path, include
from .views import report_case

urlpatterns = [
    path('report/', report_case)
]