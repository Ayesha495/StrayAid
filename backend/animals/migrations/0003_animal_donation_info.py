from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("animals", "0002_animal_profile_expansion"),
    ]

    operations = [
        migrations.AddField(
            model_name="animal",
            name="donation_info",
            field=models.TextField(blank=True),
        ),
    ]
