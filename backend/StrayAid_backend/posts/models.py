from django.db import models


class Post(models.Model):
    # Posts are public-facing updates tied back to a rescued animal.
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
