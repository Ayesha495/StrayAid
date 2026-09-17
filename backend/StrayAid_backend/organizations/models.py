from django.conf import settings
from django.db import models


class Organization(models.Model):
    # This profile extends a regular user account with rescue-specific data.
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="organization_profile",
    )
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=100, default="rescue")
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    address = models.CharField(max_length=255, blank=True)
    is_verified = models.BooleanField(default=False)
    capacity = models.IntegerField(default=0)
    current_active_cases = models.IntegerField(default=0)
    city = models.CharField(max_length=100, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    radius = models.FloatField(null=True, blank=True)
    is_available = models.BooleanField(default=True)
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to="organizations/", null=True, blank=True)
    bank_name = models.CharField(max_length=255, blank=True)
    bank_account_title = models.CharField(max_length=255, blank=True)
    bank_account_number = models.CharField(max_length=100, blank=True)
    tax_id = models.CharField(max_length=100, blank=True)
    payment_notes = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name
