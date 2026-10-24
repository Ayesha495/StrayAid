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

# What each status means for the people who reported or follow the case. {animal} is "dog",
# "cat"... and {who} is "you reported" or "you're following".
CASE_STATUS_BODIES = {
    "reported": "Case {reference} is waiting for a rescue team again.",
    "assigned": "The {animal} {who} has been accepted by **{organization}**.",
    "in_progress": "**{organization}** is on the way to the {animal} {who}.",
    "rescued": "Good news: the {animal} {who} has been rescued by **{organization}**.",
    "adoption": "The {animal} {who} has recovered and is now up for adoption.",
    "closed": "Case {reference} is closed. Thank you for looking out for animals.",
}


def case_status_body(case, who):
    animal = case.species or next((label for label in case.reports.values_list("ai_animal_label", flat=True) if label), "animal")
    organization = case.organization.name if case.organization_id else "a rescue team"
    template = CASE_STATUS_BODIES.get(case.status, "Case {reference} was updated.")
    return template.format(reference=case.reference, animal=animal.lower(), who=who, organization=organization)

def case_audience(case):
    """Who hears about a case: (reporters, followers). Reporters who turned off "Keep me
    updated" on every report they made are left out; followers excludes the reporters."""
    from notifications.models import CaseFollow

    reports = list(case.reports.values_list("user_id", "notify_reporter"))
    reporter_ids = {user_id for user_id, wants_updates in reports if wants_updates}
    if case.reported_by_id not in {user_id for user_id, _ in reports}:
        reporter_ids.add(case.reported_by_id)
    follower_ids = set(CaseFollow.objects.filter(case=case).values_list("user_id", flat=True)) - reporter_ids
    return reporter_ids, follower_ids


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
    # A status change caused by editing the animal is announced once, by the animal signal.
    if getattr(instance, "_changed_by_animal", False):
        return

    from notifications.services import notify_users

    reporter_ids, follower_ids = case_audience(instance)
    data = {"type": "case_status", "case_id": instance.pk, "status": instance.status}
    notify_users(list(reporter_ids), title="Rescue Update", body=case_status_body(instance, "you reported"), data=data)
    if follower_ids:
        notify_users(list(follower_ids), title="Rescue Update", body=case_status_body(instance, "you're following"), data=data)


# ── Animal created or updated by its organization → notify reporters + followers ──

# Fields people following an animal care about, and how a change is described.
ANIMAL_UPDATE_LABELS = {
    "name": "name",
    "image": "photo",
    "health": "health",
    "vaccinated": "vaccinations",
    "medical_info": "medical notes",
    "description": "story",
    "age": "age",
    "breed": "breed",
    "gender": "gender",
    "color": "colour",
}
ANIMAL_TRACKED_FIELDS = ["status", *ANIMAL_UPDATE_LABELS]

# {name} is the animal, {organization} the organization caring for it.
ANIMAL_STATUS_BODIES = {
    "rescued": "**{name}** is safe with **{organization}**.",
    "recovering": "**{name}** is recovering with **{organization}**.",
    "adoptable": "**{name}** is ready for adoption at **{organization}**.",
    "adopted": "**{name}** has been adopted and is going to a new home. 🎉",
}
# How the animal is doing when its profile is first made.
ANIMAL_STATUS_PHRASES = {
    "rescued": "safe in their care",
    "recovering": "recovering in their care",
    "adoptable": "ready for adoption",
    "adopted": "already adopted",
}


def _animal_kind(animal):
    return (animal.species or animal.case.species or "animal").lower()


def _animal_audience(animal):
    """Case reporters and followers, plus everyone following the animal. The organization's
    own account never hears about its own changes."""
    from notifications.models import AnimalFollow

    reporter_ids, follower_ids = case_audience(animal.case)
    follower_ids |= set(AnimalFollow.objects.filter(animal=animal).values_list("user_id", flat=True))
    skip = set(getattr(animal, "_skip_notify_user_ids", ()))
    if animal.organization_id:
        skip.add(animal.organization.user_id)
    return reporter_ids - skip, follower_ids - reporter_ids - skip


def _describe_profile_changes(animal, changed):
    labels = []
    for field in changed:
        label = ANIMAL_UPDATE_LABELS[field]
        if field == "health" and animal.health:
            label = f"health (now {animal.get_health_display().lower()})"
        elif field == "vaccinated" and animal.vaccinated:
            label = "vaccinations (now vaccinated)"
        labels.append(label)
    listed = labels[0] if len(labels) == 1 else f"{', '.join(labels[:-1])} and {labels[-1]}"
    organization = animal.organization.name if animal.organization_id else "The rescue team"
    return f"**{organization}** updated **{animal.name}**'s {listed}."


def _pre_save_animal(sender, instance, **kwargs):
    previous = sender.objects.filter(pk=instance.pk).values(*ANIMAL_TRACKED_FIELDS).first() if instance.pk else None
    instance._old_values = previous
    instance._old_status = previous["status"] if previous else None


def _post_save_animal(sender, instance, created, **kwargs):
    from notifications.models import AnimalFollow
    from notifications.services import notify_users

    reporter_ids, follower_ids = _animal_audience(instance)
    organization = instance.organization.name if instance.organization_id else "a rescue team"

    if created:
        # Everyone keeping up with the case now follows the animal too, so its posts and
        # later updates reach them (and it shows under "Followed" in Activity).
        for user_id in reporter_ids | follower_ids:
            AnimalFollow.objects.get_or_create(user_id=user_id, animal=instance)
        phrase = ANIMAL_STATUS_PHRASES.get(instance.status, "in their care")
        data = {"type": "animal_status", "animal_id": instance.pk, "status": instance.status}
        for user_ids, who in ((reporter_ids, "you reported"), (follower_ids, "you're following")):
            if user_ids:
                notify_users(
                    list(user_ids),
                    title=f"Meet {instance.name}",
                    body=f"**{organization}** rescued the {_animal_kind(instance)} {who}. Meet **{instance.name}**, {phrase}.",
                    data=data,
                )
        return

    previous = getattr(instance, "_old_values", None) or {}
    current = {field: getattr(instance, field) for field in ANIMAL_TRACKED_FIELDS}
    current["image"] = instance.image.name or None
    previous = {**previous, "image": previous.get("image") or None} if previous else {}
    changed = [field for field in ANIMAL_TRACKED_FIELDS if field in previous and previous[field] != current[field]]
    if not changed:
        return
    user_ids = list(reporter_ids | follower_ids)

    if "status" in changed:
        template = ANIMAL_STATUS_BODIES.get(instance.status, "**{name}** is now {status}.")
        body = template.format(name=instance.name, organization=organization, status=instance.get_status_display().lower())
        notify_users(
            user_ids,
            title=f"{instance.name} Update",
            body=body,
            data={"type": "animal_status", "animal_id": instance.pk, "status": instance.status},
        )
        return

    # Several edits in a row refresh one unread entry instead of piling up.
    notify_users(
        user_ids,
        title=f"{instance.name} Update",
        body=_describe_profile_changes(instance, changed),
        data={"type": "animal_update", "animal_id": instance.pk, "fields": changed},
        group_key=f"animal-update-{instance.pk}",
    )


# ── New post → notify animal followers, the animal's reporters + org followers ──

def _post_save_post(sender, instance, created, **kwargs):
    if not created:
        return

    from notifications.models import AnimalFollow, OrganizationFollow
    from notifications.services import notify_users

    user_ids = set(AnimalFollow.objects.filter(animal=instance.animal).values_list("user_id", flat=True))
    reporter_ids, case_follower_ids = case_audience(instance.animal.case)
    user_ids |= reporter_ids | case_follower_ids
    user_ids.update(
        OrganizationFollow.objects.filter(organization=instance.organization).values_list("user_id", flat=True)
    )
    user_ids.discard(instance.organization.user_id)

    notify_users(
        list(user_ids),
        title="Community",
        body=f"New post from **{instance.organization.name}** about {instance.animal.name}.",
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
