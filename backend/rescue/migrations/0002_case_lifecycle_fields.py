from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("rescue", "0001_initial"),
    ]

    # These lifecycle fields were folded into 0001_initial.
    # Keep this migration as a no-op so existing databases that already
    # recorded 0002 remain valid, while fresh test databases do not try
    # to add duplicate columns.
    operations = []
