from rest_framework import serializers

from .models import Conversation, Message
from .services import ACTIVE_WINDOW, display_name, organization_last_active

OPEN_CASE_STATUSES = ["reported", "assigned", "in_progress"]


def _media_url(request, file):
    if not file:
        return None
    return request.build_absolute_uri(file.url) if request else file.url


def _initials(name):
    parts = [part for part in name.replace("&", " ").split() if part[0].isalpha()]
    return "".join(part[0] for part in parts[:2]).upper() or "?"


class ConversationSerializer(serializers.ModelSerializer):
    """An inbox row (Stitch 18). Who it shows depends on the viewer: people see the
    organization, the organization sees the person who wrote to them."""

    title = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()
    initials = serializers.SerializerMethodField()
    verified = serializers.SerializerMethodField()
    is_organization = serializers.SerializerMethodField()
    tag = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    active = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            "id", "topic", "title", "avatar", "initials", "verified", "is_organization", "tag",
            "last_message", "unread_count", "active", "last_message_at",
        ]

    def _viewer(self):
        return self.context["request"].user

    def _org_side(self, obj):
        return obj.is_organization_side(self._viewer())

    def get_title(self, obj):
        return display_name(obj.member) if self._org_side(obj) else obj.organization.name

    def get_avatar(self, obj):
        file = obj.member.avatar if self._org_side(obj) else obj.organization.image
        return _media_url(self.context.get("request"), file)

    def get_initials(self, obj):
        return _initials(self.get_title(obj))

    def get_verified(self, obj):
        return not self._org_side(obj) and obj.organization.is_verified

    def get_is_organization(self, obj):
        return not self._org_side(obj)

    def get_tag(self, obj):
        if obj.case_id:
            return {"label": f"Case #{obj.case.reference}", "tone": "amber" if obj.case.status in OPEN_CASE_STATUSES else "grey"}
        if obj.animal_id:
            animal = obj.animal
            kind = " Adoption" if animal.status in ("adoptable", "adopted") else ""
            return {"label": f"{animal.name} • {animal.species or 'Animal'}{kind}", "tone": "green"}
        return None

    def get_last_message(self, obj):
        message = obj.messages.order_by("-created_at", "-id").first()
        if not message:
            return None
        return {
            "body": message.body,
            "has_image": bool(message.image),
            "from_me": message.sender_id == self._viewer().id,
            "created_at": message.created_at,
        }

    def get_unread_count(self, obj):
        return obj.unread_for(self._viewer())

    def get_active(self, obj):
        if self._org_side(obj):
            return False
        from django.utils import timezone

        last = organization_last_active(obj.organization)
        return bool(last and timezone.now() - last <= ACTIVE_WINDOW)


class ConversationDetailSerializer(ConversationSerializer):
    """The chat thread header (Stitch 19): who you're talking to, how to call them and
    the case or animal the chat is about."""

    phone = serializers.SerializerMethodField()
    last_active = serializers.SerializerMethodField()
    case = serializers.SerializerMethodField()
    animal = serializers.SerializerMethodField()
    organization_id = serializers.IntegerField(read_only=True)

    class Meta(ConversationSerializer.Meta):
        fields = ConversationSerializer.Meta.fields + ["phone", "last_active", "case", "animal", "organization_id"]

    def get_phone(self, obj):
        return "" if self._org_side(obj) else obj.organization.phone

    def get_last_active(self, obj):
        return None if self._org_side(obj) else organization_last_active(obj.organization)

    def get_case(self, obj):
        case = obj.case
        if not case:
            return None
        latest = case.updates.order_by("-created_at", "-id").first()
        return {
            "id": case.id,
            "reference": case.reference,
            "status": case.status,
            "status_label": case.get_status_display(),
            "title": case.title or f"{(case.species or 'Animal').capitalize()} in need",
            "area": case.area,
            "severity": case.severity,
            "live": case.status in ("assigned", "in_progress"),
            "latest_update": {"message": latest.message, "created_at": latest.created_at} if latest else None,
        }

    def get_animal(self, obj):
        animal = obj.animal
        if not animal:
            return None
        application = animal.adoption_applications.filter(applicant=obj.member).order_by("-created_at").first()
        return {
            "id": animal.id,
            "name": animal.name,
            "species": animal.species,
            "status": animal.status,
            "status_label": animal.get_status_display(),
            "image": _media_url(self.context.get("request"), animal.image),
            "application_status": application.status if application else None,
        }


class MessageSerializer(serializers.ModelSerializer):
    from_me = serializers.SerializerMethodField()
    from_organization = serializers.SerializerMethodField()
    sender_name = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ["id", "body", "image", "created_at", "from_me", "from_organization", "sender_name"]

    def get_from_me(self, obj):
        return obj.sender_id == self.context["request"].user.id

    def get_from_organization(self, obj):
        return obj.sender_id != obj.conversation.member_id

    def get_sender_name(self, obj):
        conversation = obj.conversation
        return conversation.organization.name if obj.sender_id != conversation.member_id else display_name(obj.sender)

    def get_image(self, obj):
        return _media_url(self.context.get("request"), obj.image)


class NewMessageSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=2000, required=False, allow_blank=True, trim_whitespace=True)
    image = serializers.ImageField(required=False, allow_null=True)

    def validate(self, attrs):
        if not attrs.get("body") and not attrs.get("image"):
            raise serializers.ValidationError({"body": "Write a message or attach a photo."})
        return attrs
