from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve

from core.views import health

urlpatterns = [
    path(settings.ADMIN_URL, admin.site.urls),
    path("api/health/", health, name="health"),
    # Auth: StrayAid's throttled login and sign-up first, then the rest of Djoser.
    path("auth/", include("accounts.urls")),
    path("auth/", include("djoser.urls")),
    path("auth/", include("djoser.urls.jwt")),
    path("api/cases/", include("rescue.urls")),
    path("api/organizations/", include("organizations.urls")),
    path("api/animals/", include("animals.urls")),
    path("api/posts/", include("posts.urls")),
    path("api/notifications/", include("notifications.urls")),
    path("api/chat/", include("chat.urls")),
]

if settings.SERVE_MEDIA:
    media_prefix = settings.MEDIA_URL.lstrip("/")
    urlpatterns += [re_path(rf"^{media_prefix}(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT})]
