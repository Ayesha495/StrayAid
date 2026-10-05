import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import PasswordResetCode


User = get_user_model()

CODE_LIFETIME = timedelta(minutes=15)
RESEND_COOLDOWN = timedelta(seconds=60)
MAX_FAILED_ATTEMPTS = 5

# Same reply whether or not the email has an account, so the endpoint can't be used
# to find out who is registered.
REQUEST_REPLY = "If an account exists for that email, we've sent a 6-digit code to it."
INVALID_CODE = "That code is wrong or has expired. Request a new one and try again."


def _active_user(email):
    return User.objects.filter(email__iexact=email, is_active=True).first()


def _latest_open_code(user):
    return (
        user.password_reset_codes.filter(used_at__isnull=True, created_at__gte=timezone.now() - CODE_LIFETIME)
        .order_by("-created_at")
        .first()
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def request_password_reset(request):
    email = (request.data.get("email") or "").strip()
    if not email:
        return Response({"detail": "Enter your email address."}, status=status.HTTP_400_BAD_REQUEST)

    user = _active_user(email)
    if user:
        latest = _latest_open_code(user)
        if not latest or timezone.now() - latest.created_at >= RESEND_COOLDOWN:
            code = f"{secrets.randbelow(1_000_000):06d}"
            # A new code replaces any older one that hasn't been used.
            user.password_reset_codes.filter(used_at__isnull=True).update(used_at=timezone.now())
            PasswordResetCode.objects.create(user=user, code_hash=make_password(code))
            minutes = int(CODE_LIFETIME.total_seconds() // 60)
            send_mail(
                subject="Your StrayAid password reset code",
                message=(
                    f"Hi {user.first_name or user.username},\n\n"
                    f"Your StrayAid password reset code is {code}. It expires in {minutes} minutes.\n\n"
                    "If you didn't ask to reset your password, you can ignore this email."
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
            )

    return Response({"detail": REQUEST_REPLY}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([AllowAny])
def confirm_password_reset(request):
    email = (request.data.get("email") or "").strip()
    code = (request.data.get("code") or "").strip()
    new_password = request.data.get("new_password") or ""

    if not email or not code or not new_password:
        return Response(
            {"detail": "Email, code and new password are required."}, status=status.HTTP_400_BAD_REQUEST
        )

    user = _active_user(email)
    reset = _latest_open_code(user) if user else None
    if not reset or reset.failed_attempts >= MAX_FAILED_ATTEMPTS:
        return Response({"detail": INVALID_CODE}, status=status.HTTP_400_BAD_REQUEST)

    if not check_password(code, reset.code_hash):
        reset.failed_attempts += 1
        reset.save(update_fields=["failed_attempts"])
        return Response({"detail": INVALID_CODE}, status=status.HTTP_400_BAD_REQUEST)

    try:
        validate_password(new_password, user=user)
    except ValidationError as error:
        return Response({"detail": " ".join(error.messages)}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(new_password)
    user.save(update_fields=["password"])
    reset.used_at = timezone.now()
    reset.save(update_fields=["used_at"])
    return Response({"detail": "Your password has been reset. You can sign in now."}, status=status.HTTP_200_OK)
