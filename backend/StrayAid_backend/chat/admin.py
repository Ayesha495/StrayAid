from django.contrib import admin

from .models import Conversation, Message


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    fields = ("sender", "body", "image", "created_at")


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ("member", "organization", "case", "animal", "last_message_at")
    search_fields = ("member__email", "organization__name")
    inlines = [MessageInline]
