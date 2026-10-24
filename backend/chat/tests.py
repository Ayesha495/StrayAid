from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from animals.models import AdoptionApplication, Animal
from animals.tests import MediaEnabledAPITestCase, make_png
from notifications.models import Notification
from organizations.models import Organization
from rescue.models import Case

from .models import Conversation, Message
from .services import average_response_minutes

User = get_user_model()


class ChatTests(MediaEnabledAPITestCase):
    """Messages inbox and thread (Stitch 18 and 19)."""

    def setUp(self):
        self.org_user = User.objects.create_user(email="o@example.com", username="o", password="x", role="organization")
        self.organization = Organization.objects.create(user=self.org_user, name="Paws & Care Rescue", phone="+92 300 0000101",
                                                        is_verified=True)
        self.member = User.objects.create_user(email="m@example.com", username="m", password="x", first_name="Sara", last_name="Ahmed")
        self.case = Case.objects.create(description="Dog", latitude=33.7, longitude=73.0, reported_by=self.member,
                                        organization=self.organization, status="assigned", area="G-11")

    def start(self, **data):
        self.client.force_authenticate(user=self.member)
        return self.client.post("/api/chat/conversations/start/", data, format="json")

    def test_starting_about_a_case_reuses_the_same_chat(self):
        first = self.start(case_id=self.case.id, message="Is he okay?")
        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)
        self.assertEqual(first.data["title"], "Paws & Care Rescue")
        self.assertEqual(first.data["case"]["reference"], self.case.reference)
        self.assertTrue(first.data["case"]["live"])
        self.assertEqual(first.data["phone"], "+92 300 0000101")
        again = self.start(case_id=self.case.id)
        self.assertEqual((again.status_code, again.data["id"]), (status.HTTP_200_OK, first.data["id"]))
        self.assertEqual(Message.objects.count(), 1)

    def test_a_case_without_a_rescue_team_has_no_one_to_message(self):
        self.case.organization = None
        self.case.save()
        self.assertEqual(self.start(case_id=self.case.id).status_code, status.HTTP_400_BAD_REQUEST)

    def test_organizations_cannot_start_general_chats_but_can_reply(self):
        conversation_id = self.start(organization_id=self.organization.id).data["id"]
        self.client.force_authenticate(user=self.org_user)
        self.assertEqual(
            self.client.post("/api/chat/conversations/start/", {"organization_id": self.organization.id}).status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        reply = self.client.post(f"/api/chat/conversations/{conversation_id}/messages/", {"body": "Hello Sara!"})
        self.assertEqual(reply.status_code, status.HTTP_201_CREATED)
        self.assertTrue(reply.data["from_me"])
        # The organization's inbox shows the person, not itself.
        self.assertEqual(self.client.get("/api/chat/conversations/").data["results"][0]["title"], "Sara Ahmed")

    def org_start(self, **data):
        self.client.force_authenticate(user=self.org_user)
        return self.client.post("/api/chat/conversations/start/", data, format="json")

    def test_organizations_can_message_reporters_of_their_cases(self):
        response = self.org_start(case_id=self.case.id, message="Can you send another photo?")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        conversation = Conversation.objects.get(pk=response.data["id"])
        self.assertEqual((conversation.member, conversation.case), (self.member, self.case))
        self.assertEqual(conversation.messages.get().sender, self.org_user)
        self.assertTrue(Notification.objects.filter(user=self.member).exists())
        # The reporter opening the same case chat lands in the same conversation.
        self.assertEqual(self.start(case_id=self.case.id).data["id"], conversation.id)

        # Someone who didn't report it can't be picked, and other teams' cases are off limits.
        stranger = User.objects.create_user(email="s@example.com", username="s", password="x")
        self.assertEqual(self.org_start(case_id=self.case.id, member_id=stranger.id).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.org_start(case_id=self.case.id, member_id="abc").status_code, status.HTTP_400_BAD_REQUEST)
        self.case.organization = None
        self.case.save()
        self.assertEqual(self.org_start(case_id=self.case.id).status_code, status.HTTP_403_FORBIDDEN)

    def test_organizations_can_message_adoption_applicants(self):
        luna = Animal.objects.create(case=self.case, organization=self.organization, name="Luna", species="Cat")
        application = AdoptionApplication.objects.create(
            animal=luna, applicant=self.member, full_name="Sara Ahmed", phone="1", home_type="house"
        )
        response = self.org_start(application_id=application.id)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        conversation = Conversation.objects.get(pk=response.data["id"])
        self.assertEqual((conversation.member, conversation.animal, conversation.topic), (self.member, luna, "adoption"))

        other_user = User.objects.create_user(email="o2@example.com", username="o2", password="x", role="organization")
        Organization.objects.create(user=other_user, name="Other Shelter")
        self.client.force_authenticate(user=other_user)
        refused = self.client.post("/api/chat/conversations/start/", {"application_id": application.id}, format="json")
        self.assertEqual(refused.status_code, status.HTTP_403_FORBIDDEN)

    def test_unread_counts_notifications_and_reading(self):
        conversation_id = self.start(organization_id=self.organization.id, message="Hi").data["id"]
        # Windows clocks tick every ~16 ms, so move the member's read mark back to keep the
        # replies strictly after it.
        Conversation.objects.filter(pk=conversation_id).update(member_read_at=timezone.now() - timedelta(seconds=1))
        self.client.force_authenticate(user=self.org_user)
        self.client.post(f"/api/chat/conversations/{conversation_id}/messages/", {"body": "We'll be there soon."})
        self.client.post(f"/api/chat/conversations/{conversation_id}/messages/", {"image": make_png("photo.png")}, format="multipart")

        self.client.force_authenticate(user=self.member)
        row = self.client.get("/api/chat/conversations/").data["results"][0]
        self.assertEqual(row["unread_count"], 2)
        self.assertTrue(row["last_message"]["has_image"])
        self.assertTrue(row["active"])
        self.assertEqual(self.client.get("/api/notifications/unread-counts/").data, {"notifications": 1, "messages": 2})
        # Two messages, one notification for the chat.
        self.assertEqual(Notification.objects.filter(user=self.member, kind="chat").count(), 1)

        thread = self.client.get(f"/api/chat/conversations/{conversation_id}/messages/").data
        self.assertEqual([m["from_organization"] for m in thread], [False, True, True])
        self.assertEqual(self.client.get("/api/chat/conversations/").data["results"][0]["unread_count"], 0)
        newer = self.client.get(f"/api/chat/conversations/{conversation_id}/messages/?after={thread[1]['id']}").data
        self.assertEqual(len(newer), 1)

    def test_empty_messages_are_refused_and_strangers_cannot_read(self):
        conversation_id = self.start(organization_id=self.organization.id).data["id"]
        empty = self.client.post(f"/api/chat/conversations/{conversation_id}/messages/", {"body": "   "})
        self.assertEqual(empty.status_code, status.HTTP_400_BAD_REQUEST)
        stranger = User.objects.create_user(email="x@example.com", username="x", password="x")
        self.client.force_authenticate(user=stranger)
        self.assertEqual(self.client.get(f"/api/chat/conversations/{conversation_id}/messages/").status_code, 404)

    def test_filters_and_search(self):
        org_user = User.objects.create_user(email="o2@example.com", username="o2", password="x", role="organization")
        shelter = Organization.objects.create(user=org_user, name="Hope Animal Shelter")
        animal_case = Case.objects.create(description="Cat", latitude=33.7, longitude=73.0, reported_by=self.member, organization=shelter)
        luna = Animal.objects.create(case=animal_case, organization=shelter, name="Luna", species="Cat", status=Animal.STATUS_ADOPTABLE)
        self.start(case_id=self.case.id)
        self.start(animal_id=luna.id, message="Is Luna good with kids?")
        self.start(organization_id=shelter.id)

        def titles(query):
            return [row["tag"]["label"] if row["tag"] else row["title"] for row in self.client.get(f"/api/chat/conversations/?{query}").data["results"]]

        self.assertEqual(titles("filter=rescues"), [f"Case #{self.case.reference}"])
        self.assertEqual(titles("filter=adoptions"), ["Luna • Cat Adoption"])
        self.assertEqual(titles("filter=shelters"), ["Hope Animal Shelter"])
        self.assertEqual(titles("q=kids"), ["Luna • Cat Adoption"])
        self.assertEqual(self.client.get("/api/chat/conversations/").data["total"], 3)

    def test_average_response_time(self):
        conversation = Conversation.objects.create(member=self.member, organization=self.organization)
        now = timezone.now()
        for minutes_ago, sender in [(60, self.member), (52, self.org_user), (40, self.member), (34, self.member),
                                    (30, self.org_user), (20, self.member), (12, self.org_user)]:
            Message.objects.create(conversation=conversation, sender=sender, body="x", created_at=now - timedelta(minutes=minutes_ago))
        # Waits of 8, 10 (from the first unanswered message) and 8 minutes.
        self.assertEqual(average_response_minutes(), 9)


class OrganizationsToMessageTests(APITestCase):
    def test_lists_organizations_but_not_your_own(self):
        org_user = User.objects.create_user(email="o@example.com", username="o", password="x", role="organization")
        Organization.objects.create(user=org_user, name="Paws & Care Rescue")
        other = User.objects.create_user(email="o2@example.com", username="o2", password="x", role="organization")
        Organization.objects.create(user=other, name="Hope Animal Shelter")
        self.client.force_authenticate(user=org_user)
        self.assertEqual([row["name"] for row in self.client.get("/api/chat/organizations/").data], ["Hope Animal Shelter"])
