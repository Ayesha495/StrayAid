from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ConversationViewSet, organizations_to_message

router = DefaultRouter()
router.register("conversations", ConversationViewSet, basename="conversation")

urlpatterns = [
    path("organizations/", organizations_to_message, name="chat-organizations"),
    path("", include(router.urls)),
]
