from django.contrib import admin

from .models import Post


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ("title", "organization", "animal", "created_at")
    list_filter = ("organization", "created_at")
    search_fields = ("title", "content", "animal__name", "organization__name")
    autocomplete_fields = ("animal", "organization")
