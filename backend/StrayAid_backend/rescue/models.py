from django.db import models
from django.utils import timezone
from accounts.models import User

class CaseQuerySet(models.QuerySet):
    def open_cases(self):
        # Open cases are the ones still visible to rescue organizations.
        return self.exclude(status="closed")


SEVERITY_CHOICES = [
    ("low", "Low"),
    ("medium", "Medium"),
    ("high", "High"),
    ("critical", "Critical"),
]
SEVERITY_ORDER = [value for value, _ in SEVERITY_CHOICES]


class Case(models.Model):
    # Case status tracks the rescue workflow before an animal profile is complete.
    STATUS_CHOICES = [
        ('reported', 'Reported'),
        ('assigned', 'Assigned'),
        ('in_progress', 'In Progress'),
        ('rescued', 'Rescued'),
        ('closed', 'Closed'),
        ('adoption', 'Up For Adoption'),
    ]
    description = models.TextField()
    latitude = models.FloatField()
    longitude = models.FloatField()
    status = models.CharField(default="reported", max_length=50, choices=STATUS_CHOICES)
    reported_by = models.ForeignKey(User, on_delete = models.CASCADE)
    created_at = models.DateTimeField(auto_now_add = True)
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cases",
    )
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_cases",
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    # Short public headline, e.g. "Injured Dog — G-11".
    title = models.CharField(max_length=120, blank=True)
    species = models.CharField(max_length=30, blank=True)
    # Neighbourhood or sector shown publicly instead of raw coordinates.
    area = models.CharField(max_length=100, blank=True)
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default="medium")
    # 0-100 AI confidence that the report is a genuine animal in need.
    confidence_score = models.PositiveSmallIntegerField(null=True, blank=True)
    possibly_invalid = models.BooleanField(default=False)
    objects = CaseQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Case #{self.pk} - {self.status}"

    @property
    def reference(self):
        # Human-readable case number shown to reporters, e.g. "SA-2026-0042".
        year = (self.created_at or timezone.now()).year
        return f"SA-{year}-{self.pk:04d}"

class Report(models.Model):
    # Multiple public reports can roll up into the same case.
    case = models.ForeignKey(Case, on_delete= models.CASCADE, related_name = "reports")
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    image = models.ImageField(upload_to="reports/")
    description =models.TextField()
    latitude = models.FloatField()
    longitude = models.FloatField()
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default="medium")
    # "Keep me updated" on the report form: push this reporter the case's status changes.
    notify_reporter = models.BooleanField(default=True)
    # Highest animal-class confidence from the image detector (0-1); null = not scored.
    ai_animal_confidence = models.FloatField(null=True, blank=True)
    # What the detector saw ("dog", "cat", ...) and where, as [x0, y0, x1, y1] in 0-1 units.
    ai_animal_label = models.CharField(max_length=20, blank=True)
    ai_box = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Report #{self.pk} for case {self.case_id}"


class CaseUpdate(models.Model):
    """One entry in a case's history: a status change (recorded automatically) or a note
    posted by the organization handling it. Shown under "Case Updates" (Stitch 10)."""

    case = models.ForeignKey(Case, on_delete=models.CASCADE, related_name="updates")
    # The case status this entry is about; blank for a plain note.
    status = models.CharField(max_length=50, choices=Case.STATUS_CHOICES, blank=True)
    message = models.TextField()
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="case_updates")
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"Update on case #{self.case_id}: {self.status or 'note'}"


class AIFeedback(models.Model):
    """"Report incorrect AI detection" on the confidence screen (Stitch 11). Kept for the
    organization and for checking the detector; it doesn't change the score by itself."""

    REASON_CHOICES = [
        ("no_animal", "There's no animal in the photo"),
        ("wrong_animal", "It's a different animal"),
        ("wrong_score", "The score looks wrong"),
    ]

    case = models.ForeignKey(Case, on_delete=models.CASCADE, related_name="ai_feedback")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="ai_feedback")
    reason = models.CharField(max_length=20, choices=REASON_CHOICES)
    created_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("case", "user")
        ordering = ["-created_at"]

    def __str__(self):
        return f"AI feedback on case #{self.case_id}: {self.reason}"
