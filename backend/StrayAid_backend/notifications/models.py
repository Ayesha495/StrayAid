from django.db import models
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
