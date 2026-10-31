"""The audit trail: who did what to which record, kept for sensitive actions (adoption
decisions, money checks, bank detail changes, failed logins). It stores ids and outcomes, not
personal details, so the log itself isn't another copy of people's data."""

import logging

from django.contrib.auth.signals import user_login_failed
from django.dispatch import receiver

from core.throttles import client_ip

logger = logging.getLogger("strayaid.audit")


def record(action, request=None, target=None, actor=None, **details):
    from .models import AuditEvent

    user = actor or getattr(request, "user", None)
    event = AuditEvent.objects.create(
        action=action,
        actor=user if user is not None and user.is_authenticated else None,
        object_type=target._meta.label_lower if target is not None else "",
        object_id=target.pk if target is not None else None,
        ip_address=(client_ip(request) or None) if request is not None else None,
        details=details,
    )
    logger.info("%s actor=%s target=%s:%s", action, event.actor_id, event.object_type, event.object_id)
    return event


@receiver(user_login_failed)
def failed_login(sender, credentials, request=None, **kwargs):
    # Never the attempted email or password: people often type a password into the wrong box.
    record("auth.login_failed", request=request)
