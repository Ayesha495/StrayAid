from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("animals", "0003_animal_donation_info"),
    ]

    operations = [
        migrations.AlterField(
            model_name="animal",
            name="status",
            field=models.CharField(
                choices=[
                    ("rescued", "Rescued"),
                    ("recovering", "Recovering"),
                    ("adoptable", "Adoptable"),
                    ("adopted", "Adopted"),
                ],
                default="rescued",
                max_length=20,
            ),
        ),
    ]
