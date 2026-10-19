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
    # What the shelter hopes to raise each month for medical supplies (organization profile).
    supply_goal_pkr = models.PositiveIntegerField(default=100000)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class ShelterDonation(models.Model):
    """A gift to the shelter as a whole (the organization profile's "Sponsor Shelter Medical
    Supplies"), confirmed by the organization once the transfer receipt checks out."""

    STATUS_CHOICES = [("pending", "Pending"), ("confirmed", "Confirmed"), ("rejected", "Rejected")]

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="donations")
    donor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="shelter_donations")
    amount_pkr = models.PositiveIntegerField()
    receipt = models.ImageField(upload_to="receipts/", null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"PKR {self.amount_pkr} for {self.organization.name} ({self.status})"
