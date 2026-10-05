from django.contrib.auth.models import AbstractUser
from django.db import models

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
    avatar = models.ImageField(upload_to="avatars/", null=True, blank=True)

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
