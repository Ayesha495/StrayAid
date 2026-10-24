from django.db import models

from core.uploads import UniqueUploadPath, validate_image_size


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
    image = models.ImageField(upload_to=UniqueUploadPath("animals"), validators=[validate_image_size], null=True, blank=True)
    # Shown as tags on the profile (Stitch 13): "Healthy · Vaccinated · 2 years old · Female".
    HEALTH_CHOICES = [
        ("healthy", "Healthy"),
        ("minor_issues", "Minor issues"),
        ("under_treatment", "Under treatment"),
        ("special_needs", "Special needs"),
    ]
    health = models.CharField(max_length=20, choices=HEALTH_CHOICES, blank=True)
    vaccinated = models.BooleanField(default=False)
    # How many sponsors the organization is looking for ("Pledged support 18 / 50", Stitch 16).
    sponsor_goal = models.PositiveSmallIntegerField(default=20)
    # What the animal's care costs (treatment, food, shelter), in PKR. Confirmed sponsorships
    # count towards it. 0 means the organization hasn't set a goal yet.
    funding_goal_pkr = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class AdoptionApplication(models.Model):
    """Someone asking to adopt an animal: the 4-step form on Stitch 14 (applicant, home and
    lifestyle, why adopt, review). The organization reviews it; the profile counts them."""

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
        ("withdrawn", "Withdrawn"),
    ]
    HOME_CHOICES = [("apartment", "Apartment"), ("house", "House"), ("other", "Other")]
    OWNERSHIP_CHOICES = [("own", "Own"), ("rent", "Rent")]
    EXPERIENCE_CHOICES = [
        ("first_time", "First pet"),
        ("some", "Had pets before"),
        ("experienced", "Very experienced"),
    ]

    # A person can have only one of these per animal at a time.
    ACTIVE_STATUSES = ["pending", "approved"]

    animal = models.ForeignKey(Animal, on_delete=models.CASCADE, related_name="adoption_applications")
    applicant = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="adoption_applications")
    full_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=30)
    home_type = models.CharField(max_length=20, choices=HOME_CHOICES)
    has_other_pets = models.BooleanField(default=False)
    # Step 2: home and lifestyle.
    city = models.CharField(max_length=100, blank=True)
    ownership = models.CharField(max_length=10, choices=OWNERSHIP_CHOICES, blank=True)
    landlord_allows_pets = models.BooleanField(null=True, blank=True)
    household_size = models.PositiveSmallIntegerField(null=True, blank=True)
    has_children = models.BooleanField(default=False)
    hours_alone = models.PositiveSmallIntegerField(null=True, blank=True)
    experience = models.CharField(max_length=20, choices=EXPERIENCE_CHOICES, blank=True)
    # Step 3: why adopt and promises.
    reason = models.TextField(blank=True)
    care_plan = models.TextField(blank=True)
    agrees_home_visit = models.BooleanField(default=False)
    agrees_return_policy = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)
    # When it was approved, rejected or withdrawn.
    decided_at = models.DateTimeField(null=True, blank=True)

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
    receipt = models.ImageField(upload_to=UniqueUploadPath("receipts"), validators=[validate_image_size], null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"PKR {self.amount_pkr} for {self.animal.name} ({self.status})"
