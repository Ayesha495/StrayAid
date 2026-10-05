from django.apps import apps
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver


def _get_case():
    return apps.get_model("rescue", "Case")


def _get_animal():
    return apps.get_model("animals", "Animal")


def _get_post():
    return apps.get_model("posts", "Post")


# ── Case status change → notify reporters ────────────────────────────────────

def _pre_save_case(sender, instance, **kwargs):
    if instance.pk:
        try:
            instance._old_status = sender.objects.get(pk=instance.pk).status
        except sender.DoesNotExist:
            instance._old_status = None
    else:
        instance._old_status = None


def _post_save_case(sender, instance, created, **kwargs):
    if created or getattr(instance, "_old_status", None) == instance.status:
        return

    from notifications.services import notify_users

    label = dict(sender.STATUS_CHOICES).get(instance.status, instance.status)
    # Reporters who turned off "Keep me updated" on every report they made are skipped.
    reports = list(instance.reports.values_list("user_id", "notify_reporter"))
    reporter_ids = {user_id for user_id, wants_updates in reports if wants_updates}
    if instance.reported_by_id not in {user_id for user_id, _ in reports}:
        reporter_ids.add(instance.reported_by_id)
    # People who follow the case without having reported it.
    from notifications.models import CaseFollow

    reporter_ids.update(CaseFollow.objects.filter(case=instance).values_list("user_id", flat=True))

    notify_users(
        list(reporter_ids),
        title="Rescue Update",
        body=f"Case {instance.reference} is now: {label}",
        data={"type": "case_status", "case_id": instance.pk, "status": instance.status},
    )


# ── Animal status change → notify followers + original reporter ───────────────

def _pre_save_animal(sender, instance, **kwargs):
    if instance.pk:
        try:
            instance._old_status = sender.objects.get(pk=instance.pk).status
        except sender.DoesNotExist:
            instance._old_status = None
    else:
        instance._old_status = None


def _post_save_animal(sender, instance, created, **kwargs):
    if created or getattr(instance, "_old_status", None) == instance.status:
        return

    from notifications.models import AnimalFollow
    from notifications.services import notify_users

    label = dict(sender.STATUS_CHOICES).get(instance.status, instance.status)
    follower_ids = set(AnimalFollow.objects.filter(animal=instance).values_list("user_id", flat=True))
    try:
        follower_ids.add(instance.case.reported_by_id)
    except Exception:
        pass

    notify_users(
        list(follower_ids),
        title=f"{instance.name} Update",
        body=f"{instance.name} is now: {label}",
        data={"type": "animal_status", "animal_id": instance.pk, "status": instance.status},
    )


# ── New post → notify animal followers + org followers ───────────────────────

def _post_save_post(sender, instance, created, **kwargs):
    if not created:
        return

    from notifications.models import AnimalFollow, OrganizationFollow
    from notifications.services import notify_users

    user_ids = set(AnimalFollow.objects.filter(animal=instance.animal).values_list("user_id", flat=True))
    user_ids.update(
        OrganizationFollow.objects.filter(organization=instance.organization).values_list("user_id", flat=True)
    )

    notify_users(
        list(user_ids),
        title=f"New update: {instance.animal.name}",
        body=instance.title,
        data={"type": "new_post", "post_id": instance.pk, "animal_id": instance.animal_id},
    )


def connect_signals():
    """Connect all signal handlers. Called from NotificationsConfig.ready()."""
    Case = _get_case()
    Animal = _get_animal()
    Post = _get_post()

    pre_save.connect(_pre_save_case, sender=Case, dispatch_uid="notifications.pre_save_case")
    post_save.connect(_post_save_case, sender=Case, dispatch_uid="notifications.post_save_case")
    pre_save.connect(_pre_save_animal, sender=Animal, dispatch_uid="notifications.pre_save_animal")
    post_save.connect(_post_save_animal, sender=Animal, dispatch_uid="notifications.post_save_animal")
    post_save.connect(_post_save_post, sender=Post, dispatch_uid="notifications.post_save_post")
