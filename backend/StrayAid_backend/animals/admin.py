from django.contrib import admin

from .models import Animal


@admin.register(Animal)
class AnimalAdmin(admin.ModelAdmin):
    list_display = ("name", "species", "status", "organization", "case", "updated_at")
    list_filter = ("status", "species", "organization")
    search_fields = ("name", "breed", "description", "organization__name")
    autocomplete_fields = ("case", "organization")
