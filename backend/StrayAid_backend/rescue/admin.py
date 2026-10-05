from django.contrib import admin

from .models import AIFeedback, Case, CaseUpdate, Report


class ReportInline(admin.TabularInline):
    model = Report
    extra = 0
    autocomplete_fields = ("user",)


@admin.register(Case)
class CaseAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "status", "severity", "confidence_score", "organization", "created_at")
    list_filter = ("status", "severity", "organization", "created_at")
    search_fields = ("description", "reported_by__email", "organization__name", "assigned_to__email")
    autocomplete_fields = ("reported_by", "organization", "assigned_to")
    inlines = [ReportInline]


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ("id", "case", "user", "created_at")
    list_filter = ("created_at",)
    search_fields = ("description", "user__email", "case__description")
    autocomplete_fields = ("case", "user")


@admin.register(CaseUpdate)
class CaseUpdateAdmin(admin.ModelAdmin):
    list_display = ("case", "status", "author", "created_at")
    list_filter = ("status",)
    search_fields = ("message",)


@admin.register(AIFeedback)
class AIFeedbackAdmin(admin.ModelAdmin):
    list_display = ("case", "user", "reason", "created_at")
    list_filter = ("reason",)
