from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import AnimalFollow, Notification, OrganizationFollow, PushToken
from .serializers import NotificationSerializer, PushTokenSerializer


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def register_push_token(request):
    """Store or refresh an Expo push token for the current user."""
    serializer = PushTokenSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response({"detail": "Push token registered."}, status=status.HTTP_200_OK)


@api_view(["POST", "DELETE"])
@permission_classes([IsAuthenticated])
def toggle_animal_follow(request, animal_id):
    """Follow (POST) or unfollow (DELETE) an animal."""
    if request.method == "POST":
        follow, created = AnimalFollow.objects.get_or_create(
            user=request.user, animal_id=animal_id
        )
        return Response(
            {"detail": "Now following." if created else "Already following.", "following": True},
            status=status.HTTP_200_OK,
        )
    AnimalFollow.objects.filter(user=request.user, animal_id=animal_id).delete()
    return Response({"detail": "Unfollowed.", "following": False}, status=status.HTTP_200_OK)


@api_view(["POST", "DELETE"])
@permission_classes([IsAuthenticated])
def toggle_organization_follow(request, organization_id):
    """Follow (POST) or unfollow (DELETE) an organization."""
    if request.method == "POST":
        follow, created = OrganizationFollow.objects.get_or_create(
            user=request.user, organization_id=organization_id
        )
        return Response(
            {"detail": "Now following." if created else "Already following.", "following": True},
            status=status.HTTP_200_OK,
        )
    OrganizationFollow.objects.filter(user=request.user, organization_id=organization_id).delete()
    return Response({"detail": "Unfollowed.", "following": False}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_follows(request):
    """Return all animals and organizations the current user follows."""
    animal_ids = list(
        AnimalFollow.objects.filter(user=request.user).values_list("animal_id", flat=True)
    )
    org_ids = list(
        OrganizationFollow.objects.filter(user=request.user).values_list("organization_id", flat=True)
    )
    return Response({"followed_animals": animal_ids, "followed_organizations": org_ids})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def follow_status(request):
    """Check follow status for a specific animal or organization."""
    animal_id = request.query_params.get("animal_id")
    org_id = request.query_params.get("organization_id")

    result = {}
    if animal_id:
        result["following_animal"] = AnimalFollow.objects.filter(
            user=request.user, animal_id=animal_id
        ).exists()
    if org_id:
        result["following_organization"] = OrganizationFollow.objects.filter(
            user=request.user, organization_id=org_id
        ).exists()
    return Response(result)


# ── Notifications screen (Stitch 20) ─────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def notification_list(request):
    """The latest notifications, newest first; ?unread=1 for unread ones only."""
    queryset = Notification.objects.filter(user=request.user)
    if request.query_params.get("unread") in ("1", "true"):
        queryset = queryset.filter(read_at__isnull=True)
    return Response(NotificationSerializer(queryset[:100], many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def unread_counts(request):
    """Red dots on the home header: unread notifications and unread chat messages."""
    from chat.services import unread_message_count

    return Response({
        "notifications": Notification.objects.filter(user=request.user, read_at__isnull=True).count(),
        "messages": unread_message_count(request.user),
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_notification_read(request, notification_id):
    Notification.objects.filter(user=request.user, pk=notification_id, read_at__isnull=True).update(read_at=timezone.now())
    return Response({"unread": False})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_all_notifications_read(request):
    updated = Notification.objects.filter(user=request.user, read_at__isnull=True).update(read_at=timezone.now())
    return Response({"marked": updated})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def clear_read_notifications(request):
    deleted, _ = Notification.objects.filter(user=request.user, read_at__isnull=False).delete()
    return Response({"deleted": deleted})
