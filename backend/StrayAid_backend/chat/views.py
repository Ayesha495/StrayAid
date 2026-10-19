from django.contrib.auth import get_user_model
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from animals.models import AdoptionApplication, Animal
from organizations.models import Organization
from rescue.models import Case

from .models import Conversation
from .serializers import (
    OPEN_CASE_STATUSES,
    ConversationDetailSerializer,
    ConversationSerializer,
    MessageSerializer,
    NewMessageSerializer,
)
from .services import average_response_minutes, send_message, user_conversations

User = get_user_model()

# Inbox filter chips (Stitch 18).
FILTERS = {
    "shelters": Q(case__isnull=True, animal__isnull=True),
    "rescues": Q(case__status__in=OPEN_CASE_STATUSES),
    "adoptions": Q(animal__isnull=False),
}


class ConversationViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ConversationSerializer

    def get_queryset(self):
        return user_conversations(self.request.user).select_related(
            "member", "organization", "organization__user", "case", "animal"
        )

    def list(self, request):
        """The inbox: ?filter=shelters|rescues|adoptions and ?q= search."""
        queryset = self.get_queryset()
        total = queryset.count()
        chosen = FILTERS.get(request.query_params.get("filter", ""))
        if chosen is not None:
            queryset = queryset.filter(chosen)
        query = (request.query_params.get("q") or "").strip()
        if query:
            queryset = queryset.filter(
                Q(organization__name__icontains=query)
                | Q(member__first_name__icontains=query)
                | Q(member__last_name__icontains=query)
                | Q(member__username__icontains=query)
                | Q(messages__body__icontains=query)
            ).distinct()
        return Response({
            "results": ConversationSerializer(queryset, many=True, context={"request": request}).data,
            "total": total,
            "response_minutes": average_response_minutes(),
        })

    def retrieve(self, request, pk=None):
        conversation = get_object_or_404(self.get_queryset(), pk=pk)
        return Response(ConversationDetailSerializer(conversation, context={"request": request}).data)

    @action(detail=False, methods=["post"], url_path="start")
    def start(self, request):
        """Open (or reopen) the chat with an organization, optionally about a case or an
        animal. The organization comes from the case or animal when one is given.
        Organizations can start one too, to reach someone who reported a case they took on
        or who applied to adopt one of their animals."""
        organization = getattr(request.user, "organization_profile", None)
        if organization:
            return self._start_as_organization(request, organization)
        case = animal = None
        if request.data.get("case_id"):
            case = get_object_or_404(Case, pk=request.data["case_id"])
            if not case.organization_id:
                return Response(
                    {"detail": "No rescue team has taken this case yet, so there's no one to message."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            organization = case.organization
        elif request.data.get("animal_id"):
            animal = get_object_or_404(Animal.objects.select_related("organization"), pk=request.data["animal_id"])
            if not animal.organization_id:
                return Response({"detail": "This animal isn't with an organization."}, status=status.HTTP_400_BAD_REQUEST)
            organization = animal.organization
        else:
            organization = get_object_or_404(Organization, pk=request.data.get("organization_id"))

        return self._open(request, member=request.user, organization=organization, case=case, animal=animal)

    def _start_as_organization(self, request, organization):
        """An organization asks a reporter of its case (?member_id= picks one when several
        people reported it; the first reporter otherwise) or an adoption applicant for more."""
        if request.data.get("case_id"):
            case = get_object_or_404(Case, pk=request.data["case_id"])
            if case.organization_id != organization.id:
                return Response(
                    {"detail": "You can only message reporters of cases your team has taken on."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            reporter_ids = {case.reported_by_id, *case.reports.values_list("user_id", flat=True)}
            member_id = str(request.data.get("member_id") or case.reported_by_id)
            if not member_id.isdigit() or int(member_id) not in reporter_ids:
                return Response({"detail": "That person didn't report this case."}, status=status.HTTP_400_BAD_REQUEST)
            return self._open(request, member=User.objects.get(pk=int(member_id)), organization=organization, case=case)
        if request.data.get("application_id"):
            application = get_object_or_404(
                AdoptionApplication.objects.select_related("animal", "applicant"), pk=request.data["application_id"]
            )
            if application.animal.organization_id != organization.id:
                return Response(
                    {"detail": "You can only message people who applied for your animals."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            return self._open(request, member=application.applicant, organization=organization, animal=application.animal)
        return Response(
            {"detail": "Organizations start chats about a case or an adoption application."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    def _open(self, request, member, organization, case=None, animal=None):
        conversation, created = Conversation.objects.get_or_create(
            member=member, organization=organization, case=case, animal=animal
        )
        first = (request.data.get("message") or "").strip()
        if first:
            send_message(conversation, request.user, body=first[:2000])
        return Response(
            ConversationDetailSerializer(conversation, context={"request": request}).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get", "post"], url_path="messages")
    def messages(self, request, pk=None):
        """GET the thread (?after=<id> for new ones only; reading marks it read), POST to send
        a message with a body and/or a photo."""
        conversation = get_object_or_404(self.get_queryset(), pk=pk)
        if request.method == "POST":
            serializer = NewMessageSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            message = send_message(
                conversation,
                request.user,
                body=serializer.validated_data.get("body", ""),
                image=serializer.validated_data.get("image"),
            )
            return Response(MessageSerializer(message, context={"request": request}).data, status=status.HTTP_201_CREATED)

        messages = conversation.messages.select_related("sender")
        after = request.query_params.get("after")
        if after and after.isdigit():
            messages = messages.filter(id__gt=int(after))
        else:
            # The latest 200, oldest first.
            messages = list(messages.order_by("-created_at", "-id")[:200])[::-1]
        conversation.mark_read(request.user)
        return Response(MessageSerializer(messages, many=True, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="read")
    def read(self, request, pk=None):
        conversation = get_object_or_404(self.get_queryset(), pk=pk)
        conversation.mark_read(request.user)
        return Response({"unread_count": 0})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def organizations_to_message(request):
    """Organizations you can start a chat with (the inbox's "New message")."""
    organizations = Organization.objects.exclude(user=request.user).order_by("-is_verified", "name")
    return Response([
        {
            "id": organization.id,
            "name": organization.name,
            "city": organization.city,
            "verified": organization.is_verified,
            "image": request.build_absolute_uri(organization.image.url) if organization.image else None,
        }
        for organization in organizations
    ])
