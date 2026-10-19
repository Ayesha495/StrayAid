from datetime import timedelta

from django.db.models import Q
from django.utils import timezone

from .models import Conversation, Message

# Shown as "Active now" in a chat when the organization wrote within this window.
ACTIVE_WINDOW = timedelta(minutes=15)


def user_conversations(user):
    return Conversation.objects.filter(Q(member=user) | Q(organization__user=user))


def display_name(user):
    return user.get_full_name() or user.username or user.email.split("@")[0]


def unread_message_count(user):
    return sum(conversation.unread_for(user) for conversation in user_conversations(user).select_related("organization"))


def organization_last_active(organization):
    """When the organization last wrote in any chat."""
    last = Message.objects.filter(sender_id=organization.user_id).order_by("-created_at").values_list("created_at", flat=True).first()
    return last


def average_response_minutes(days=30, minimum_samples=3):
    """How long organizations take to answer a message, on average, over recent chats.
    Shown on the inbox as "Shelters respond in avg. N minutes"; None until there's data."""
    since = timezone.now() - timedelta(days=days)
    waits = []
    conversations = Conversation.objects.filter(last_message_at__gte=since).select_related("organization")
    for conversation in conversations:
        waiting_since = None
        for sender_id, created_at in conversation.messages.filter(created_at__gte=since).values_list("sender_id", "created_at"):
            if sender_id == conversation.member_id:
                waiting_since = waiting_since or created_at
            elif waiting_since:
                waits.append((created_at - waiting_since).total_seconds() / 60)
                waiting_since = None
    if len(waits) < minimum_samples:
        return None
    return max(1, round(sum(waits) / len(waits)))


def send_message(conversation, sender, body="", image=None):
    """Store a message, bump the chat to the top of both inboxes and tell the other side."""
    from notifications.services import notify_users

    message = Message.objects.create(conversation=conversation, sender=sender, body=body, image=image)
    conversation.last_message_at = message.created_at
    # Writing a message means you've seen everything before it.
    if conversation.is_organization_side(sender):
        conversation.organization_read_at = message.created_at
        recipient_id, sender_label = conversation.member_id, conversation.organization.name
    else:
        conversation.member_read_at = message.created_at
        recipient_id, sender_label = conversation.organization.user_id, display_name(sender)
    conversation.save(update_fields=["last_message_at", "organization_read_at", "member_read_at"])

    notify_users(
        [recipient_id],
        title="Chat",
        body=f"New message from **{sender_label}**.",
        data={"type": "chat_message", "conversation_id": conversation.id},
        group_key=f"chat:{conversation.id}",
    )
    return message
