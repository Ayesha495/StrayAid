import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("rescue", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="case",
            name="assigned_to",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="assigned_cases", to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name="case",
            name="resolved_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="case",
            name="updated_at",
            field=models.DateTimeField(auto_now=True),
            preserve_default=False,
        ),
    ]
