from django.db import models
from accounts.models import User

class CaseQuerySet(models.QuerySet):
    def open_cases(self):
        return self.exclude(status="closed")


# Create your models here.
class Case(models.Model):
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
    objects = CaseQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Case #{self.pk} - {self.status}"

class Report(models.Model):
    case = models.ForeignKey(Case, on_delete= models.CASCADE, related_name = "reports")
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    image = models.ImageField(upload_to="reports/")
    description =models.TextField()
    latitude = models.FloatField()
    longitude = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Report #{self.pk} for case {self.case_id}"
