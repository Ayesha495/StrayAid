from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("animals", "0005_animal_microchip_id"),
        ("organizations", "0006_organization_payment_notes_organization_tax_id"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PushToken",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("token", models.CharField(max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="push_tokens", to=settings.AUTH_USER_MODEL)),
            ],
            options={"unique_together": {("user", "token")}},
        ),
        migrations.CreateModel(
            name="AnimalFollow",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="animal_follows", to=settings.AUTH_USER_MODEL)),
                ("animal", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="followers", to="animals.animal")),
            ],
            options={"unique_together": {("user", "animal")}},
        ),
        migrations.CreateModel(
            name="OrganizationFollow",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="organization_follows", to=settings.AUTH_USER_MODEL)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="followers", to="organizations.organization")),
            ],
            options={"unique_together": {("user", "organization")}},
        ),
    ]
