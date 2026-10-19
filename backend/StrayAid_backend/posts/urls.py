from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import PostViewSet, comment_delete, comment_like, comment_pin, story_groups, story_seen

router = DefaultRouter()
router.register("", PostViewSet, basename="post")

urlpatterns = [
    # Listed before the router so "stories" is not read as a post id.
    path("stories/", story_groups, name="story-groups"),
    path("stories/<int:story_id>/seen/", story_seen, name="story-seen"),
    path("comments/<int:comment_id>/", comment_delete, name="comment-delete"),
    path("comments/<int:comment_id>/like/", comment_like, name="comment-like"),
    path("comments/<int:comment_id>/pin/", comment_pin, name="comment-pin"),
    path("", include(router.urls)),
]
