from django.contrib.auth.models import AbstractUser
from django.db import models

from core.uploads import UniqueUploadPath, validate_image_size

class User(AbstractUser):
    # Email is the primary login identifier across web and mobile clients.
    email = models.EmailField(unique= True)
    ROLE_CHOICES = (
        ('public', 'Public User'),
        ('organization', 'Organization'),
        ('admin', 'Admin'),
    )

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='public')
    # Optional profile photo, set at sign-up (Stitch screen 6) or later in settings.
    avatar = models.ImageField(upload_to=UniqueUploadPath("avatars"), validators=[validate_image_size], null=True, blank=True)
    # Profile (Stitch profile screen): where they're based and an emergency contact number.
    area = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    # "Emergency Field Readiness": happy to be called to check a case on site.
    field_ready = models.BooleanField(default=False)
    # "Urgent Radius Alerts": critical reports within ALERT_RADIUS_KM of this spot.
    radius_alerts = models.BooleanField(default=False)
    alert_latitude = models.FloatField(null=True, blank=True)
    alert_longitude = models.FloatField(null=True, blank=True)

    # When they ticked "I agree to the Terms of Service and Privacy Policy" at sign-up.
    accepted_terms_at = models.DateTimeField(null=True, blank=True)

    ALERT_RADIUS_KM = 5

    # Keep Django auth compatible while using email for authentication.
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]


class PasswordResetCode(models.Model):
    # A short-lived 6-digit code emailed to someone who forgot their password.
    # Only a hash is stored, and a code dies after a few wrong guesses.
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="password_reset_codes")
    code_hash = models.CharField(max_length=128)
    created_at = models.DateTimeField(auto_now_add=True)
    failed_attempts = models.PositiveSmallIntegerField(default=0)
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
