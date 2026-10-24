from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

from core.uploads import UniqueUploadPath, validate_image_size

STORY_LIFETIME = timedelta(hours=24)


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
    image = models.ImageField(upload_to=UniqueUploadPath("posts"), validators=[validate_image_size], null=True, blank=True)
    # How many times people shared it from the app ("14 shares", Stitch 22).
    share_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class PostLike(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="likes")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="post_likes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["post", "user"], name="unique_post_like")]

    def __str__(self):
        return f"{self.user} likes {self.post}"


class PostComment(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="comments")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="post_comments")
    # Replies hang off a top-level comment, one level deep (Stitch 23).
    parent = models.ForeignKey("self", on_delete=models.CASCADE, null=True, blank=True, related_name="replies")
    body = models.TextField(max_length=1000)
    # The organization can pin one comment to the top of its post.
    is_pinned = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Comment #{self.pk} on {self.post}"


class CommentLike(models.Model):
    comment = models.ForeignKey(PostComment, on_delete=models.CASCADE, related_name="likes")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="comment_likes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["comment", "user"], name="unique_comment_like")]


class SavedPost(models.Model):
    """A post bookmarked from the post page (Stitch 22); listed under Activity > Saved."""

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="saves")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="saved_posts")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["post", "user"], name="unique_saved_post")]


class StoryQuerySet(models.QuerySet):
    def active(self):
        # Stories disappear 24 hours after posting; no cleanup job is needed.
        return self.filter(created_at__gte=timezone.now() - STORY_LIFETIME)


class Story(models.Model):
    # Short-lived organization updates, grouped by category on the home screen.
    CATEGORY_CHOICES = [
        ("rescue_update", "Rescue Updates"),
        ("happy_ending", "Happy Endings"),
        ("adoption", "Adoption"),
        ("behind_the_scenes", "Behind the Rescue"),
        ("sanctuary", "Sanctuary"),
    ]

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="stories",
    )
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    image = models.ImageField(upload_to=UniqueUploadPath("stories"), validators=[validate_image_size])
    # The story viewer (Stitch 21) shows a headline over the caption, and the animal's
    # sponsorship progress when the story is about one animal.
    headline = models.CharField(max_length=160, blank=True)
    caption = models.CharField(max_length=280, blank=True)
    animal = models.ForeignKey("animals.Animal", on_delete=models.SET_NULL, null=True, blank=True, related_name="stories")
    created_at = models.DateTimeField(default=timezone.now)
    objects = StoryQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "stories"

    def __str__(self):
        return f"{self.get_category_display()} story by {self.organization}"


class StoryView(models.Model):
    """Stories someone has watched, so their circle on Home stops looking new."""

    story = models.ForeignKey(Story, on_delete=models.CASCADE, related_name="views")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="story_views")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["story", "user"], name="unique_story_view")]
