from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("organizations", "0004_organization_image_cleanup_wallet_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="organization",
            name="bank_name",
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
