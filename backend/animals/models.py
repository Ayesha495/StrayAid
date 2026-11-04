from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from core.uploads import UniqueUploadPath, validate_image_size


class Animal(models.Model):
    # Animal status also drives the linked rescue case lifecycle.
    STATUS_RESCUED = "rescued"
    STATUS_RECOVERING = "recovering"
    STATUS_ADOPTABLE = "adoptable"
    STATUS_ADOPTED = "adopted"
    # The other ways an animal leaves a team's care: back to its owner or neighbourhood, or it dies.
    STATUS_RELEASED = "released"
    STATUS_DECEASED = "deceased"

    STATUS_CHOICES = [
        (STATUS_RESCUED, "Rescued"),
        (STATUS_RECOVERING, "Recovering"),
        (STATUS_ADOPTABLE, "Adoptable"),
        (STATUS_ADOPTED, "Adopted"),
        (STATUS_RELEASED, "Released or returned"),
        (STATUS_DECEASED, "Passed away"),
    ]

    # No longer with the team: these don't use up capacity, take applications or ask for sponsors.
    LEFT_CARE = [STATUS_ADOPTED, STATUS_RELEASED, STATUS_DECEASED]
    # Every animal that has left care moves to the team's archive: still reachable by link (old posts,
    # notifications) and kept in the team's records, but gone from the public lists.
    UNLISTED = [STATUS_ADOPTED, STATUS_RELEASED, STATUS_DECEASED]
    # A new profile starts in care. Everything after that goes through the moves below.
    STARTING_STATUSES = [STATUS_RESCUED, STATUS_RECOVERING]
    # The moves a team can make. Leaving care can be undone, because animals come back and
    # people mistype; those moves need a note saying why.
    NEXT_STATUSES = {
        STATUS_RESCUED: [STATUS_RECOVERING, STATUS_ADOPTABLE, STATUS_RELEASED, STATUS_DECEASED],
        STATUS_RECOVERING: [STATUS_ADOPTABLE, STATUS_RELEASED, STATUS_DECEASED],
        STATUS_ADOPTABLE: [STATUS_RECOVERING, STATUS_ADOPTED, STATUS_RELEASED, STATUS_DECEASED],
        STATUS_ADOPTED: [STATUS_RECOVERING, STATUS_ADOPTABLE],
        STATUS_RELEASED: [STATUS_RECOVERING],
        STATUS_DECEASED: [STATUS_RECOVERING],
    }

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
    sterilized = models.BooleanField(default=False)
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

    def readiness(self):
        """The checklist before an animal is listed for adoption. Required items are enforced;
        the others are shown to adopters as they are, so a team can still list without them."""
        return [
            {"key": "photo", "label": "Photo added", "done": bool(self.image), "required": True},
            {"key": "description", "label": "Public description written", "done": bool(self.description.strip()), "required": True},
            {
                "key": "health",
                "label": "Health recorded and treatment finished",
                "done": bool(self.health) and self.health != "under_treatment",
                "required": True,
            },
            {"key": "vaccinated", "label": "Vaccinated", "done": self.vaccinated, "required": False},
            {"key": "sterilized", "label": "Spayed or neutered", "done": self.sterilized, "required": False},
        ]


class AnimalStatusChange(models.Model):
    """One move through the animal's lifecycle, with the team's reason. Notes can name an
    adopter, so this history is only shown to the animal's own team."""

    animal = models.ForeignKey(Animal, on_delete=models.CASCADE, related_name="status_changes")
    from_status = models.CharField(max_length=20, choices=Animal.STATUS_CHOICES)
    to_status = models.CharField(max_length=20, choices=Animal.STATUS_CHOICES)
    note = models.TextField(blank=True)
    changed_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.animal.name}: {self.from_status} to {self.to_status}"


class MedicalRecord(models.Model):
    """One entry in an animal's medical history: an exam, a vaccine, a surgery and so on.
    `next_due` is when it needs doing again; repeating the same entry settles it."""

    KIND_CHOICES = [
        ("checkup", "Check-up"),
        ("vaccination", "Vaccination"),
        ("deworming", "Deworming"),
        ("sterilization", "Spay or neuter"),
        ("treatment", "Treatment"),
        ("surgery", "Surgery"),
        ("other", "Other"),
    ]

    animal = models.ForeignKey(Animal, on_delete=models.CASCADE, related_name="medical_records")
    kind = models.CharField(max_length=20, choices=KIND_CHOICES)
    title = models.CharField(max_length=150)
    date = models.DateField()
    next_due = models.DateField(null=True, blank=True)
    vet = models.CharField(max_length=150, blank=True)
    weight_kg = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(Decimal("0.01"))])
    notes = models.TextField(blank=True)
    # Shared on the public profile. Team-only entries are for things adopters don't need to read.
    is_public = models.BooleanField(default=True)
    created_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-id"]

    def __str__(self):
        return f"{self.title} for {self.animal.name} ({self.date})"


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
        # The rules live in the database too, so no code path or race can break them.
        constraints = [
            models.UniqueConstraint(fields=["animal"], condition=models.Q(status="approved"), name="one_approved_application_per_animal"),
            models.UniqueConstraint(
                fields=["animal", "applicant"],
                condition=models.Q(status__in=["pending", "approved"]),
                name="one_active_application_per_person",
            ),
        ]

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
        constraints = [models.CheckConstraint(condition=models.Q(amount_pkr__gt=0), name="sponsorship_amount_positive")]

    def __str__(self):
        return f"PKR {self.amount_pkr} for {self.animal.name} ({self.status})"
