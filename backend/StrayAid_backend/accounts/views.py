from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from djoser.views import UserViewSet
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
import requests
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from core.throttles import AuthRateThrottle

from .deletion import delete_account
from .serializers import build_unique_username


User = get_user_model()

GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


class LoginView(TokenObtainPairView):
    throttle_classes = [AuthRateThrottle]


class SignUpView(UserViewSet):
    def get_throttles(self):
        if self.action == "create":
            return [AuthRateThrottle()]
        return super().get_throttles()


def _sync_user_role(user):
    # Keep the stored role aligned with whether an organization profile exists.
    if hasattr(user, "organization_profile") and user.role != "organization":
        user.role = "organization"
        user.save(update_fields=["role"])
    return user


def _serialize_user(user, request=None):
    user = _sync_user_role(user)
    avatar = user.avatar.url if user.avatar else None
    if avatar and request is not None:
        avatar = request.build_absolute_uri(avatar)
    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
        "avatar": avatar,
    }


def _get_or_create_google_user(email, first_name="", last_name="", accepted_terms=False):
    user = User.objects.filter(email__iexact=email).first()
    if user:
        updated_fields = []
        if first_name and user.first_name != first_name:
            user.first_name = first_name
            updated_fields.append("first_name")
        if last_name and user.last_name != last_name:
            user.last_name = last_name
            updated_fields.append("last_name")
        if updated_fields:
            user.save(update_fields=updated_fields)
        return user

    return User.objects.create_user(
        email=email.lower(),
        username=build_unique_username(email),
        first_name=first_name or "",
        last_name=last_name or "",
        password=None,
        accepted_terms_at=timezone.now() if accepted_terms else None,
    )


def _check_audience(audience):
    if audience not in settings.GOOGLE_OAUTH_CLIENT_IDS:
        raise ValueError("Unrecognized Google client")


def _verify_google_id_token(token):
    # Accept tokens from any of StrayAid's client apps (web, Android, iOS).
    token_info = google_id_token.verify_oauth2_token(token, google_requests.Request(), audience=None)
    _check_audience(token_info.get("aud"))
    return token_info


def _verify_google_access_token(access_token):
    token_reply = requests.get(GOOGLE_TOKENINFO_URL, params={"access_token": access_token}, timeout=10)
    token_reply.raise_for_status()
    token_info = token_reply.json()
    _check_audience(token_info.get("aud") or token_info.get("azp"))

    profile_reply = requests.get(GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"}, timeout=10)
    profile_reply.raise_for_status()
    profile = profile_reply.json()
    return {
        "email": token_info.get("email") or profile.get("email"),
        "email_verified": str(token_info.get("email_verified", "")).lower() == "true",
        "given_name": profile.get("given_name", ""),
        "family_name": profile.get("family_name", ""),
    }


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([AuthRateThrottle])
def google_auth(request):
    # Web sends an ID token; mobile sends an access token.
    google_id = request.data.get("id_token")
    google_access_token = request.data.get("access_token")

    if not google_id and not google_access_token:
        return Response({"detail": "Either id_token or access_token is required."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        payload = _verify_google_id_token(google_id) if google_id else _verify_google_access_token(google_access_token)
    except Exception:
        return Response({"detail": "Google token verification failed."}, status=status.HTTP_400_BAD_REQUEST)

    email = payload.get("email")
    if not email:
        return Response({"detail": "Google account email is required."}, status=status.HTTP_400_BAD_REQUEST)

    if payload.get("email_verified") is False:
        return Response({"detail": "Google email is not verified."}, status=status.HTTP_400_BAD_REQUEST)

    user = _get_or_create_google_user(
        email=email,
        first_name=payload.get("given_name", ""),
        last_name=payload.get("family_name", ""),
        accepted_terms=str(request.data.get("accept_terms", "")).lower() in ("true", "1"),
    )
    if not user.is_active:
        return Response({"detail": "This account has been deleted."}, status=status.HTTP_403_FORBIDDEN)

    refresh = RefreshToken.for_user(user)
    return Response(
        {"access": str(refresh.access_token), "refresh": str(refresh), "user": _serialize_user(user, request)},
        status=status.HTTP_200_OK,
    )


@api_view(["GET", "DELETE"])
@permission_classes([IsAuthenticated])
def me(request):
    if request.method == "GET":
        return Response(_serialize_user(request.user, request), status=status.HTTP_200_OK)

    if request.data.get("confirm") != "DELETE":
        return Response({"detail": "Type DELETE to confirm."}, status=status.HTTP_400_BAD_REQUEST)
    user = request.user
    if user.has_usable_password() and not user.check_password(request.data.get("password") or ""):
        return Response({"detail": "That password isn't right."}, status=status.HTTP_400_BAD_REQUEST)
    delete_account(user)
    return Response(status=status.HTTP_204_NO_CONTENT)
