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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name
