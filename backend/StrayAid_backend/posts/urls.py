from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import PostViewSet, story_groups

router = DefaultRouter()
router.register("", PostViewSet, basename="post")

urlpatterns = [
    # Listed before the router so "stories" is not read as a post id.
    path("stories/", story_groups, name="story-groups"),
    path("", include(router.urls)),
]
