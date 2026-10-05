from django.contrib import admin

from .models import AdoptionApplication, Animal, Sponsorship


@admin.register(Animal)
class AnimalAdmin(admin.ModelAdmin):
    list_display = ("name", "species", "status", "organization", "case", "updated_at")
    list_filter = ("status", "species", "organization")
    search_fields = ("name", "breed", "description", "organization__name")
    autocomplete_fields = ("case", "organization")


@admin.register(AdoptionApplication)
class AdoptionApplicationAdmin(admin.ModelAdmin):
    list_display = ("animal", "full_name", "applicant", "home_type", "status", "created_at")
    list_filter = ("status", "home_type")
    search_fields = ("full_name", "phone", "animal__name", "applicant__email")


@admin.register(Sponsorship)
class SponsorshipAdmin(admin.ModelAdmin):
    list_display = ("animal", "sponsor", "amount_pkr", "monthly", "status", "created_at")
    list_filter = ("status", "monthly")
    search_fields = ("animal__name", "sponsor__email")
