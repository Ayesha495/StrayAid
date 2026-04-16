from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("organizations", "0002_alter_organization_radius"),
    ]

    operations = [
        migrations.AddField(
            model_name="organization",
            name="description",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="organization",
            name="bank_account_title",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="organization",
            name="bank_account_number",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name="organization",
            name="jazzcash_number",
            field=models.CharField(blank=True, max_length=30),
        ),
        migrations.AddField(
            model_name="organization",
            name="easypaisa_number",
            field=models.CharField(blank=True, max_length=30),
        ),
    ]
