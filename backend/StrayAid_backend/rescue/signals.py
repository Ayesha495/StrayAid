from django.db.models.signals import post_save, pre_save

# Default wording for automatic case history entries, by status.
STATUS_MESSAGES = {
    "reported": "Report received. Nearby rescue organizations have been notified.",
    "assigned": "{organization} accepted this case and is preparing the rescue.",
    "in_progress": "The rescue team is on the way to the animal.",
    "rescued": "The animal has been rescued and is safe.",
    "adoption": "The animal has recovered and is ready for adoption.",
    "closed": "This case has been closed.",
}


def status_message(case):
    organization = case.organization.name if case.organization_id else "A rescue organization"
    return STATUS_MESSAGES.get(case.status, "Status changed to {status}.").format(
        organization=organization, status=case.get_status_display()
    )


def _remember_status(sender, instance, **kwargs):
    instance._previous_status = (
        sender.objects.filter(pk=instance.pk).values_list("status", flat=True).first() if instance.pk else None
    )


def _record_status_change(sender, instance, created, **kwargs):
    from .models import CaseUpdate

    if created or instance._previous_status != instance.status:
        CaseUpdate.objects.create(case=instance, status=instance.status, message=status_message(instance))
        if not created:
            # An organization responding stops the "unanswered" clock: freeze the score now.
            from .utils.scoring import refresh_case_score

            refresh_case_score(instance)


def connect_signals(Case):
    pre_save.connect(_remember_status, sender=Case, dispatch_uid="rescue.remember_status")
    post_save.connect(_record_status_change, sender=Case, dispatch_uid="rescue.record_status_change")
