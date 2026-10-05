from django.db import models


class Animal(models.Model):
    # Animal status also drives the linked rescue case lifecycle.
    STATUS_RESCUED = "rescued"
    STATUS_RECOVERING = "recovering"
    STATUS_ADOPTABLE = "adoptable"
    STATUS_ADOPTED = "adopted"

    STATUS_CHOICES = [
        (STATUS_RESCUED, "Rescued"),
        (STATUS_RECOVERING, "Recovering"),
        (STATUS_ADOPTABLE, "Adoptable"),
        (STATUS_ADOPTED, "Adopted"),
    ]

    case = models.OneToOneField(
        "rescue.Case",
        on_delete=models.CASCADE,
        related_name="animal",
    )
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="animals",
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=255)
    species = models.CharField(max_length=100, blank=True)
    breed = models.CharField(max_length=255, blank=True)
    gender = models.CharField(max_length=50, blank=True)
    age = models.IntegerField(null=True, blank=True)
    color = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)
    medical_info = models.TextField(blank=True)
    donation_info = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_RESCUED)
    microchip_id = models.CharField(max_length=100, blank=True)
    image = models.ImageField(upload_to="animals/", null=True, blank=True)
    # Shown as tags on the profile (Stitch 13): "Healthy · Vaccinated · 2 years old · Female".
    HEALTH_CHOICES = [
        ("healthy", "Healthy"),
        ("minor_issues", "Minor issues"),
        ("under_treatment", "Under treatment"),
        ("special_needs", "Special needs"),
    ]
    health = models.CharField(max_length=20, choices=HEALTH_CHOICES, blank=True)
    vaccinated = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class AdoptionApplication(models.Model):
    """Someone asking to adopt an animal (Stitch 14 fills it in; the profile counts them)."""

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
        ("withdrawn", "Withdrawn"),
    ]
    HOME_CHOICES = [("apartment", "Apartment"), ("house", "House"), ("other", "Other")]

    animal = models.ForeignKey(Animal, on_delete=models.CASCADE, related_name="adoption_applications")
    applicant = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="adoption_applications")
    full_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=30)
    home_type = models.CharField(max_length=20, choices=HOME_CHOICES)
    has_other_pets = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.full_name} wants to adopt {self.animal.name} ({self.status})"


class Sponsorship(models.Model):
    """A pledge towards an animal's care, confirmed by the organization once the receipt
    checks out (no payment gateway: people transfer and upload the receipt, Stitch 16)."""

    STATUS_CHOICES = [("pending", "Pending"), ("confirmed", "Confirmed"), ("rejected", "Rejected")]

    animal = models.ForeignKey(Animal, on_delete=models.CASCADE, related_name="sponsorships")
    sponsor = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="sponsorships")
    amount_pkr = models.PositiveIntegerField()
    monthly = models.BooleanField(default=False)
    receipt = models.ImageField(upload_to="receipts/", null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"PKR {self.amount_pkr} for {self.animal.name} ({self.status})"
