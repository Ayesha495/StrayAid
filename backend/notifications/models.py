from django.db import models
from django.utils import timezone
from accounts.models import User


class PushToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="push_tokens")
    token = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "token")

    def __str__(self):
        return f"{self.user.email} - {self.token[:30]}..."


class AnimalFollow(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="animal_follows")
    animal = models.ForeignKey("animals.Animal", on_delete=models.CASCADE, related_name="followers")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "animal")

    def __str__(self):
        return f"{self.user.email} follows {self.animal.name}"


class OrganizationFollow(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="organization_follows")
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="followers")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "organization")

    def __str__(self):
        return f"{self.user.email} follows {self.organization.name}"


class CaseFollow(models.Model):
    """Someone who isn't a reporter but tapped "Keep me updated" on a case (Stitch 10)."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="case_follows")
    case = models.ForeignKey("rescue.Case", on_delete=models.CASCADE, related_name="followers")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "case")

    def __str__(self):
        return f"{self.user.email} follows case #{self.case_id}"


class Notification(models.Model):
    """One entry on the Notifications screen (Stitch 20). Every push is also stored here, so
    people can catch up on what they missed. Text between ** ** in the body is shown bold."""

    KIND_CHOICES = [
        ("rescue", "Rescue Update"),
        ("chat", "Chat"),
        ("adoption", "Adoption"),
        ("sponsorship", "Sponsorship"),
        ("community", "Community"),
        ("alert", "Rescue Alert"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    kind = models.CharField(max_length=20, choices=KIND_CHOICES)
    title = models.CharField(max_length=120)
    body = models.CharField(max_length=300)
    # What tapping it opens, e.g. {"type": "case_status", "case_id": 4}.
    data = models.JSONField(default=dict, blank=True)
    # Notifications with the same key (e.g. one chat) collapse into one unread entry.
    group_key = models.CharField(max_length=60, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["user", "-created_at"])]

    def __str__(self):
        return f"{self.get_kind_display()} for {self.user.email}: {self.body[:40]}"
