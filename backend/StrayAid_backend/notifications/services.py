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


def notify_users(user_ids: list, title: str, body: str, data: dict | None = None):
    """Look up all push tokens for the given user IDs and fire notifications."""
    from notifications.models import PushToken

    tokens = list(
        PushToken.objects.filter(user_id__in=user_ids).values_list("token", flat=True)
    )
    send_push_notifications(tokens, title, body, data)
