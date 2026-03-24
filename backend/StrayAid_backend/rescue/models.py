from django.db import models
from accounts.models import User

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

class Report(models.Model):
    case = models.ForeignKey(Case, on_delete= models.CASCADE, related_name = "reports")
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    image = models.ImageField(upload_to="reports/")
    description =models.TextField()
    latitude = models.FloatField()
    longitude = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)