from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import AnimalFollow, OrganizationFollow, PushToken
from .serializers import PushTokenSerializer


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
