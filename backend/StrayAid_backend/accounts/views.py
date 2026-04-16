from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
import requests


User = get_user_model()


def _sync_user_role(user):
    has_organization_profile = hasattr(user, "organization_profile")
    if has_organization_profile and user.role != "organization":
        user.role = "organization"
        user.save(update_fields=["role"])
    return user


def _serialize_user(user):
    user = _sync_user_role(user)
    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
    }


def _build_unique_username(email):
    base_username = (email.split("@")[0] if email else "google_user").strip() or "google_user"
    candidate = base_username
    suffix = 1

    while User.objects.filter(username=candidate).exists():
        candidate = f"{base_username}{suffix}"
        suffix += 1

    return candidate


def _get_or_create_google_user(email, first_name="", last_name=""):
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
        email=email,
        username=_build_unique_username(email),
        first_name=first_name or "",
        last_name=last_name or "",
        password=User.objects.make_random_password(),
    )


def _verify_google_id_token(token):
    token_info = google_id_token.verify_oauth2_token(
        token,
        google_requests.Request(),
        audience=None,
    )
    audience = token_info.get("aud")
    if audience not in settings.GOOGLE_OAUTH_CLIENT_IDS:
        raise ValueError("Unrecognized Google client")
    return token_info


def _fetch_google_userinfo(access_token):
    response = requests.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    )
    response.raise_for_status()
    return response.json()


@api_view(["POST"])
@permission_classes([AllowAny])
def google_auth(request):
    google_id = request.data.get("id_token")
    google_access_token = request.data.get("access_token")

    if not google_id and not google_access_token:
        return Response(
            {"detail": "Either id_token or access_token is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        if google_id:
            payload = _verify_google_id_token(google_id)
        else:
            payload = _fetch_google_userinfo(google_access_token)
    except Exception:
        return Response(
            {"detail": "Google token verification failed."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    email = payload.get("email")
    if not email:
        return Response(
            {"detail": "Google account email is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if payload.get("email_verified") is False:
        return Response(
            {"detail": "Google email is not verified."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = _get_or_create_google_user(
        email=email,
        first_name=payload.get("given_name", ""),
        last_name=payload.get("family_name", ""),
    )

    refresh = RefreshToken.for_user(user)

    return Response(
        {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": _serialize_user(user),
        },
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(_serialize_user(request.user), status=status.HTTP_200_OK)
