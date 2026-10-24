from django.db import transaction
from django.utils import timezone

DELETED_NAME = "Deleted user"


@transaction.atomic
def delete_account(user):
    """Delete someone's account as the privacy policy promises: their personal details and
    personal activity go, while reports, sponsorship records and organization posts stay so
    rescues already under way aren't interrupted."""
    from animals.models import AdoptionApplication
    from notifications.models import AnimalFollow, CaseFollow, Notification, OrganizationFollow, PushToken
    from organizations.models import Organization
    from posts.models import CommentLike, PostLike, SavedPost, StoryView

    for model in (PushToken, AnimalFollow, CaseFollow, OrganizationFollow, Notification, PostLike, CommentLike, SavedPost, StoryView):
        model.objects.filter(user=user).delete()
    user.password_reset_codes.all().delete()

    applications = AdoptionApplication.objects.filter(applicant=user)
    applications.filter(status="pending").update(status="withdrawn", decided_at=timezone.now())
    applications.update(full_name=DELETED_NAME, phone="", city="", reason="", care_plan="")

    Organization.objects.filter(user=user).update(is_available=False)

    if user.avatar:
        user.avatar.delete(save=False)
    first_name, _, last_name = DELETED_NAME.partition(" ")
    user.email = f"deleted-{user.pk}@deleted.invalid"
    user.username = f"deleted-{user.pk}"
    user.first_name, user.last_name = first_name, last_name
    user.phone = ""
    user.area = ""
    user.field_ready = False
    user.radius_alerts = False
    user.alert_latitude = None
    user.alert_longitude = None
    user.is_active = False
    user.set_unusable_password()
    user.save()
