from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("organizations", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="organization",
            name="radius",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="organization",
            name="is_available",
            field=models.BooleanField(default=True),
        ),
    ]
