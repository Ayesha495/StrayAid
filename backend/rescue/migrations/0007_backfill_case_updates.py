from django.db import migrations

# Same wording as rescue/signals.py, frozen here so later edits don't change old migrations.
STATUS_MESSAGES = {
    "reported": "Report received. Nearby rescue organizations have been notified.",
    "assigned": "{organization} accepted this case and is preparing the rescue.",
    "in_progress": "The rescue team is on the way to the animal.",
    "rescued": "The animal has been rescued and is safe.",
    "adoption": "The animal has recovered and is ready for adoption.",
    "closed": "This case has been closed.",
}


def backfill(apps, schema_editor):
    """Give cases created before case history existed a starting history."""
    Case = apps.get_model("rescue", "Case")
    CaseUpdate = apps.get_model("rescue", "CaseUpdate")
    for case in Case.objects.select_related("organization").filter(updates__isnull=True):
        organization = case.organization.name if case.organization_id else "A rescue organization"
        CaseUpdate.objects.create(case=case, status="reported", message=STATUS_MESSAGES["reported"], created_at=case.created_at)
        if case.status != "reported":
            CaseUpdate.objects.create(
                case=case,
                status=case.status,
                message=STATUS_MESSAGES.get(case.status, "").format(organization=organization),
                created_at=case.updated_at,
            )


class Migration(migrations.Migration):
    dependencies = [("rescue", "0006_case_updates_and_follows")]
    operations = [migrations.RunPython(backfill, migrations.RunPython.noop)]
