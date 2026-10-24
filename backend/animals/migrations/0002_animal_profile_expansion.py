import django.db.models.deletion
from django.db import migrations, models


def copy_case_organization(apps, schema_editor):
    Animal = apps.get_model("animals", "Animal")

    for animal in Animal.objects.select_related("case").all():
        animal.organization_id = getattr(animal.case, "organization_id", None)
        animal.save(update_fields=["organization"])


class Migration(migrations.Migration):

    dependencies = [
        ("animals", "0001_initial"),
        ("organizations", "0003_organization_profile_expansion"),
        ("rescue", "0003_case_organization"),
    ]

    operations = [
        migrations.AddField(
            model_name="animal",
            name="medical_info",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="animal",
            name="organization",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="animals", to="organizations.organization"),
        ),
        migrations.RunPython(copy_case_organization, migrations.RunPython.noop),
    ]
