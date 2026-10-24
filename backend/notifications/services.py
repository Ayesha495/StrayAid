import json
import logging
import urllib.request

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/push/v2/send"


def send_push_notifications(tokens: list[str], title: str, body: str, data: dict | None = None):
    """Send push notifications to a list of Expo push tokens."""
    if not tokens:
        return

    messages = [
        {
            "to": token,
            "title": title,
            "body": body,
            "data": data or {},
            "sound": "default",
        }
        for token in tokens
    ]

    payload = json.dumps(messages).encode("utf-8")
    req = urllib.request.Request(
        EXPO_PUSH_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Accept-Encoding": "gzip, deflate",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            logger.debug("Expo push result: %s", result)
    except Exception as exc:
        logger.warning("Failed to send push notification: %s", exc)


# Which Notifications-screen category each push type belongs to (Stitch 20).
KIND_FOR_TYPE = {
    "case_status": "rescue",
    "animal_status": "rescue",
    "animal_update": "rescue",
    "case_note": "rescue",
    "chat_message": "chat",
    "adoption_application": "adoption",
    "adoption_decision": "adoption",
    "adoption_withdrawn": "adoption",
    "sponsorship": "sponsorship",
    "shelter_donation": "sponsorship",
    "new_post": "community",
    "post_comment": "community",
    "critical_case": "alert",
}


def notify_users(user_ids: list, title: str, body: str, data: dict | None = None, kind: str | None = None, group_key: str = ""):
    """Save a notification for each user (their Notifications screen) and push it to their
    phones. **bold** markers in the body are kept for the app and stripped from the push.
    With a group_key, a still-unread notification with that key is refreshed instead of
    adding another (one entry per chat, not one per message)."""
    from django.utils import timezone

    from notifications.models import Notification, PushToken

    data = data or {}
    user_ids = list(dict.fromkeys(user_id for user_id in user_ids if user_id))
    if not user_ids:
        return
    kind = kind or KIND_FOR_TYPE.get(data.get("type"), "community")
    now = timezone.now()
    for user_id in user_ids:
        existing = None
        if group_key:
            existing = Notification.objects.filter(user_id=user_id, group_key=group_key, read_at__isnull=True).first()
        if existing:
            existing.title, existing.body, existing.data, existing.created_at = title, body[:300], data, now
            existing.save(update_fields=["title", "body", "data", "created_at"])
        else:
            Notification.objects.create(
                user_id=user_id, kind=kind, title=title, body=body[:300], data=data, group_key=group_key, created_at=now
            )

    tokens = list(
        PushToken.objects.filter(user_id__in=user_ids).values_list("token", flat=True)
    )
    send_push_notifications(tokens, title, body.replace("**", ""), data)
