from django.db import models
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

class Report(models.Model):
    # Multiple public reports can roll up into the same case.
    case = models.ForeignKey(Case, on_delete= models.CASCADE, related_name = "reports")
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    image = models.ImageField(upload_to="reports/")
    description =models.TextField()
    latitude = models.FloatField()
    longitude = models.FloatField()
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default="medium")
    # Highest animal-class confidence from the image detector (0-1).
    ai_animal_confidence = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Report #{self.pk} for case {self.case_id}"
