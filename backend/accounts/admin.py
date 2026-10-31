from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import AuditEvent, PasswordResetCode, User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ("email", "username", "role", "is_staff", "is_active")
    list_filter = ("role", "is_staff", "is_superuser", "is_active")
    search_fields = ("email", "username", "first_name", "last_name")
    ordering = ("email",)

    fieldsets = DjangoUserAdmin.fieldsets + (
        ("StrayAid", {"fields": ("role",)}),
    )
    add_fieldsets = DjangoUserAdmin.add_fieldsets + (
        ("StrayAid", {"fields": ("email", "role")}),
    )


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    """Read-only: an audit trail anyone can edit proves nothing."""

    list_display = ("created_at", "action", "actor", "object_type", "object_id", "ip_address")
    list_filter = ("action",)
    date_hierarchy = "created_at"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(PasswordResetCode)
class PasswordResetCodeAdmin(admin.ModelAdmin):
    list_display = ("user", "created_at", "failed_attempts", "used_at")
    readonly_fields = ("user", "code_hash", "created_at", "failed_attempts", "used_at")
