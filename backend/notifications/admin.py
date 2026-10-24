from django.contrib import admin
from .models import AnimalFollow, Notification, OrganizationFollow, PushToken


@admin.register(PushToken)
class PushTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "token", "created_at")
    search_fields = ("user__email", "token")


@admin.register(AnimalFollow)
class AnimalFollowAdmin(admin.ModelAdmin):
    list_display = ("user", "animal", "created_at")
    search_fields = ("user__email", "animal__name")


@admin.register(OrganizationFollow)
class OrganizationFollowAdmin(admin.ModelAdmin):
    list_display = ("user", "organization", "created_at")
    search_fields = ("user__email", "organization__name")


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("user", "kind", "body", "read_at", "created_at")
    list_filter = ("kind",)
    search_fields = ("user__email", "body")
