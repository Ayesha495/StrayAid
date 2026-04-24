from django.contrib import admin

from .models import Organization


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "type",
        "city",
        "is_verified",
        "is_available",
        "capacity",
        "current_active_cases",
    )
    list_filter = ("type", "is_verified", "is_available", "city")
    search_fields = ("name", "email", "phone", "city", "user__email", "user__username")
    autocomplete_fields = ("user",)
