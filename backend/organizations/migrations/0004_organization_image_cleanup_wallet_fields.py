from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("organizations", "0003_organization_profile_expansion"),
    ]

    operations = [
        migrations.AddField(
            model_name="organization",
            name="image",
            field=models.ImageField(blank=True, null=True, upload_to="organizations/"),
        ),
        migrations.RemoveField(
            model_name="organization",
            name="easypaisa_number",
        ),
        migrations.RemoveField(
            model_name="organization",
            name="jazzcash_number",
        ),
    ]
