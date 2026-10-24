from django.contrib import admin

from .models import CommentLike, Post, PostComment, PostLike, SavedPost, Story, StoryView


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ("title", "organization", "animal", "created_at")
    list_filter = ("organization", "created_at")
    search_fields = ("title", "content", "animal__name", "organization__name")
    autocomplete_fields = ("animal", "organization")


@admin.register(PostComment)
class PostCommentAdmin(admin.ModelAdmin):
    # Moderation happens here while there is no admin role in the apps.
    list_display = ("id", "post", "user", "parent", "is_pinned", "created_at")
    search_fields = ("body", "user__email", "post__title")
    autocomplete_fields = ("post", "user")


@admin.register(PostLike)
class PostLikeAdmin(admin.ModelAdmin):
    list_display = ("id", "post", "user", "created_at")
    autocomplete_fields = ("post", "user")


@admin.register(Story)
class StoryAdmin(admin.ModelAdmin):
    list_display = ("id", "organization", "category", "created_at")
    list_filter = ("category", "organization")
    autocomplete_fields = ("organization",)


admin.site.register(CommentLike)
admin.site.register(SavedPost)
admin.site.register(StoryView)
