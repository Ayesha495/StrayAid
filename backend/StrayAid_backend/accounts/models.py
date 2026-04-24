from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    # Email is the primary login identifier across web and mobile clients.
    email = models.EmailField(unique= True)
    ROLE_CHOICES = (
        ('public', 'Public User'),
        ('organization', 'Organization'),
        ('admin', 'Admin'),
    )

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='public')

    # Keep Django auth compatible while using email for authentication.
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]
