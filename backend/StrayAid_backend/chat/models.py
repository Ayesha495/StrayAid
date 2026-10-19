from django.conf import settings
from django.db import models
from django.utils import timezone


class Conversation(models.Model):
    """A chat between a member of the public and a rescue organization (Stitch 18 and 19).
    It can be about one rescue case or one animal (an adoption or sponsorship question), or
    neither (a general question for the shelter). There is one conversation per topic."""

    member = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="conversations")
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="conversations")
    case = models.ForeignKey("rescue.Case", on_delete=models.SET_NULL, null=True, blank=True, related_name="conversations")
    animal = models.ForeignKey("animals.Animal", on_delete=models.SET_NULL, null=True, blank=True, related_name="conversations")
    created_at = models.DateTimeField(default=timezone.now)
    last_message_at = models.DateTimeField(default=timezone.now, db_index=True)
    # Each side's last visit; messages from the other side after it count as unread.
    member_read_at = models.DateTimeField(null=True, blank=True)
    organization_read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-last_message_at", "-id"]

    def __str__(self):
        return f"{self.member.email} and {self.organization.name}"

    @property
    def topic(self):
        if self.case_id:
            return "rescue"
        if self.animal_id:
            return "adoption"
        return "shelter"

    def is_organization_side(self, user):
        return self.organization.user_id == user.id

    def unread_for(self, user):
        organization_side = self.is_organization_side(user)
        read_at = self.organization_read_at if organization_side else self.member_read_at
        incoming = self.messages.filter(sender_id=self.member_id) if organization_side else self.messages.exclude(sender_id=self.member_id)
        return incoming.filter(created_at__gt=read_at).count() if read_at else incoming.count()

    def mark_read(self, user):
        field = "organization_read_at" if self.is_organization_side(user) else "member_read_at"
        setattr(self, field, timezone.now())
        self.save(update_fields=[field])


class Message(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="chat_messages")
    body = models.TextField(max_length=2000, blank=True)
    image = models.ImageField(upload_to="chat/", null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"Message #{self.pk} in conversation {self.conversation_id}"
