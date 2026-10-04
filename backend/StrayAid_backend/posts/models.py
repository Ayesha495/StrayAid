from django.db import models


class Post(models.Model):
    # Posts are public-facing updates tied back to a rescued animal.
    CATEGORY_MEDICAL = "medical"
    CATEGORY_ADOPTION = "adoption"
    CATEGORY_SPONSORSHIP = "sponsorship"
    CATEGORY_FOSTER = "foster"

    CATEGORY_CHOICES = [
        (CATEGORY_MEDICAL, "Medical Recovery"),
        (CATEGORY_ADOPTION, "Adoption Ready"),
        (CATEGORY_SPONSORSHIP, "Sponsorship Goal"),
        (CATEGORY_FOSTER, "Foster Found"),
    ]

    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES, blank=True)
    animal = models.ForeignKey(
        "animals.Animal",
        on_delete=models.CASCADE,
        related_name="posts",
    )
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="posts",
    )
    title = models.CharField(max_length=255)
    content = models.TextField()
    image = models.ImageField(upload_to="posts/", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title
