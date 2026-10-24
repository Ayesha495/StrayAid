from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from organizations.models import Organization
from rescue.models import Case, Report
from rescue.tests import MediaEnabledAPITestCase, make_test_image

from .models import Notification
from .services import notify_users

User = get_user_model()


class NotificationScreenTests(APITestCase):
    """The Notifications screen (Stitch 20)."""

    def setUp(self):
        self.user = User.objects.create_user(email="u@example.com", username="u", password="x")
        self.client.force_authenticate(user=self.user)

    def test_pushes_are_stored_and_listed_newest_first(self):
        notify_users([self.user.id], "Community", "New post from **Hope Animal Shelter**.", {"type": "new_post", "post_id": 1})
        notify_users([self.user.id], "Adoption", "Approved!", {"type": "adoption_decision"})
        rows = self.client.get("/api/notifications/").data
        self.assertEqual([(row["kind"], row["unread"]) for row in rows], [("adoption", True), ("community", True)])
        self.assertEqual(rows[1]["body"], "New post from **Hope Animal Shelter**.")

    def test_reading_one_all_and_clearing(self):
        for index in range(3):
            notify_users([self.user.id], "Chat", f"Message {index}", {"type": "chat_message"})
        first = Notification.objects.filter(user=self.user).last()
        self.client.post(f"/api/notifications/{first.id}/read/")
        self.assertEqual(len(self.client.get("/api/notifications/?unread=1").data), 2)
        self.assertEqual(self.client.post("/api/notifications/read-all/").data, {"marked": 2})
        self.assertEqual(self.client.get("/api/notifications/unread-counts/").data["notifications"], 0)
        self.assertEqual(self.client.post("/api/notifications/clear-read/").data, {"deleted": 3})

    def test_other_peoples_notifications_are_private(self):
        other = User.objects.create_user(email="o@example.com", username="o", password="x")
        notify_users([other.id], "Chat", "Hi", {"type": "chat_message"})
        note = Notification.objects.get()
        self.assertEqual(self.client.get("/api/notifications/").data, [])
        self.client.post(f"/api/notifications/{note.id}/read/")
        note.refresh_from_db()
        self.assertIsNone(note.read_at)

    def test_needs_an_account(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get("/api/notifications/").status_code, status.HTTP_401_UNAUTHORIZED)


class CaseNotificationTests(MediaEnabledAPITestCase):
    def setUp(self):
        super().setUp()
        self.org_user = User.objects.create_user(email="org@example.com", username="org", password="x", role="organization")
        self.organization = Organization.objects.create(
            user=self.org_user, name="Paws & Care Rescue", latitude=33.70, longitude=73.05, radius=10
        )
        self.reporter = User.objects.create_user(email="r@example.com", username="r", password="x")

    def test_status_changes_are_worded_for_reporters(self):
        case = Case.objects.create(description="Dog", latitude=33.7, longitude=73.05, reported_by=self.reporter, species="dog")
        Report.objects.create(case=case, user=self.reporter, image=make_test_image(), description="d", latitude=33.7, longitude=73.05)
        case.organization = self.organization
        case.status = "assigned"
        case.save()
        note = Notification.objects.get(user=self.reporter)
        self.assertEqual((note.kind, note.title), ("rescue", "Rescue Update"))
        self.assertEqual(note.body, "The dog you reported has been accepted by **Paws & Care Rescue**.")

    def test_critical_reports_alert_nearby_organizations(self):
        far_user = User.objects.create_user(email="far@example.com", username="far", password="x", role="organization")
        Organization.objects.create(user=far_user, name="Lahore Rescue", latitude=31.5, longitude=74.3, radius=10)
        self.client.force_authenticate(user=self.reporter)
        response = self.client.post(
            "/api/cases/report/",
            {"description": "Hit by a car", "latitude": "33.7010", "longitude": "73.0510", "area": "G-11, Islamabad",
             "severity": "critical", "image": make_test_image()},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        alert = Notification.objects.get(kind="alert")
        self.assertEqual(alert.user, self.org_user)
        self.assertEqual(alert.body, "Critical case reported near **G-11**. Tap to review details.")
        self.assertEqual(alert.data, {"type": "critical_case", "case_id": response.data["case_id"]})


class AnimalUpdateNotificationTests(MediaEnabledAPITestCase):
    """Whatever the organization changes about a rescued animal reaches the people who
    reported or follow it, once, and never the organization itself."""

    def setUp(self):
        super().setUp()
        from notifications.models import CaseFollow

        self.org_user = User.objects.create_user(email="org@example.com", username="org", password="x", role="organization")
        self.organization = Organization.objects.create(
            user=self.org_user, name="Paws & Care Rescue", latitude=33.70, longitude=73.05, radius=10
        )
        self.reporter = User.objects.create_user(email="r@example.com", username="r", password="x")
        self.quiet = User.objects.create_user(email="q@example.com", username="q", password="x")
        self.follower = User.objects.create_user(email="f@example.com", username="f", password="x")
        self.case = Case.objects.create(
            description="Dog", latitude=33.7, longitude=73.05, reported_by=self.reporter, species="dog",
            organization=self.organization, status="in_progress",
        )
        Report.objects.create(case=self.case, user=self.reporter, image=make_test_image(), description="d",
                              latitude=33.7, longitude=73.05)
        Report.objects.create(case=self.case, user=self.quiet, image=make_test_image(), description="d",
                              latitude=33.7, longitude=73.05, notify_reporter=False)
        CaseFollow.objects.create(user=self.follower, case=self.case)
        Notification.objects.all().delete()
        self.client.force_authenticate(user=self.org_user)

    def create_animal(self, **fields):
        response = self.client.post("/api/animals/", {"case": self.case.id, "name": "Bruno", "species": "Dog", **fields})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return response.data["id"]

    def notes(self, user):
        return list(Notification.objects.filter(user=user).order_by("created_at", "id"))

    def test_new_profile_is_announced_once_and_followed_automatically(self):
        from notifications.models import AnimalFollow

        animal_id = self.create_animal()
        [note] = self.notes(self.reporter)
        self.assertEqual(note.title, "Meet Bruno")
        self.assertEqual(note.body, "**Paws & Care Rescue** rescued the dog you reported. Meet **Bruno**, safe in their care.")
        self.assertEqual(note.data["animal_id"], animal_id)
        self.assertIn("you're following", self.notes(self.follower)[0].body)
        self.assertEqual(self.notes(self.quiet), [])
        self.assertEqual(self.notes(self.org_user), [])
        followers = set(AnimalFollow.objects.filter(animal_id=animal_id).values_list("user_id", flat=True))
        self.assertEqual(followers, {self.reporter.id, self.follower.id})

    def test_profile_edits_and_status_changes_reach_the_reporter(self):
        animal_id = self.create_animal()
        Notification.objects.all().delete()

        self.client.patch(f"/api/animals/{animal_id}/", {"health": "under_treatment", "medical_info": "Stitches on the leg."})
        [note] = self.notes(self.reporter)
        self.assertEqual(note.body, "**Paws & Care Rescue** updated **Bruno**'s health (now under treatment) and medical notes.")
        self.assertEqual(note.data["type"], "animal_update")

        # A second edit refreshes the same unread entry.
        self.client.patch(f"/api/animals/{animal_id}/", {"vaccinated": True})
        [note] = self.notes(self.reporter)
        self.assertEqual(note.body, "**Paws & Care Rescue** updated **Bruno**'s vaccinations (now vaccinated).")

        # Saving without changes says nothing.
        self.client.patch(f"/api/animals/{animal_id}/", {"vaccinated": True})
        self.assertEqual(len(self.notes(self.reporter)), 1)

        # A status change is one notification, not one for the animal and one for the case.
        Notification.objects.all().delete()
        self.client.patch(f"/api/animals/{animal_id}/", {"status": "adoptable"})
        [note] = self.notes(self.reporter)
        self.assertEqual(note.body, "**Bruno** is ready for adoption at **Paws & Care Rescue**.")
        self.case.refresh_from_db()
        self.assertEqual(self.case.status, "adoption")
        self.assertEqual(self.notes(self.quiet), [])
        self.assertEqual(self.notes(self.org_user), [])

    def test_approving_an_adoption_adopts_the_animal(self):
        from animals.models import AdoptionApplication, Animal

        animal_id = self.create_animal(status="adoptable")
        adopter = User.objects.create_user(email="a@example.com", username="a", password="x")
        other = User.objects.create_user(email="o@example.com", username="o", password="x")
        details = {"full_name": "Applicant", "phone": "0300", "home_type": "house"}
        chosen = AdoptionApplication.objects.create(animal_id=animal_id, applicant=adopter, **details)
        passed_over = AdoptionApplication.objects.create(animal_id=animal_id, applicant=other, **details)
        Notification.objects.all().delete()

        response = self.client.post(f"/api/animals/applications/{chosen.id}/decide/", {"status": "approved"})
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        self.assertEqual(Animal.objects.get(pk=animal_id).status, "adopted")
        self.case.refresh_from_db()
        self.assertEqual(self.case.status, "closed")
        passed_over.refresh_from_db()
        self.assertEqual(passed_over.status, "rejected")
        self.assertIn("found a home with another family", self.notes(other)[0].body)
        [adopter_note] = self.notes(adopter)
        self.assertEqual(adopter_note.data["type"], "adoption_decision")
        [reporter_note] = self.notes(self.reporter)
        self.assertEqual(reporter_note.body, "**Bruno** has been adopted and is going to a new home. 🎉")

    def test_case_notes_and_posts_reach_the_reporter(self):
        from posts.models import Post

        response = self.client.post(f"/api/cases/{self.case.id}/add-update/", {"message": "Bruno ate well today."})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        [note] = self.notes(self.reporter)
        self.assertEqual(note.body, f"**Paws & Care Rescue** posted an update on case {self.case.reference}: Bruno ate well today.")
        self.assertEqual(note.data["case_id"], self.case.id)
        self.assertEqual(self.notes(self.quiet), [])
        self.assertEqual(self.notes(self.org_user), [])

        from animals.models import Animal

        animal = Animal.objects.create(case=self.case, organization=self.organization, name="Bruno")
        Notification.objects.all().delete()
        Post.objects.create(animal=animal, organization=self.organization, title="Walk", content="First walk!")
        self.assertEqual(self.notes(self.reporter)[0].data["type"], "new_post")
        self.assertEqual(self.notes(self.org_user), [])


class FollowAndPushTokenTests(APITestCase):
    def setUp(self):
        from animals.models import Animal

        self.user = User.objects.create_user(email="u@example.com", username="u", password="x")
        org_user = User.objects.create_user(email="o@example.com", username="o", password="x", role="organization")
        self.organization = Organization.objects.create(user=org_user, name="Paws & Care Rescue")
        case = Case.objects.create(description="Dog", latitude=33.7, longitude=73.0, reported_by=org_user)
        self.animal = Animal.objects.create(case=case, organization=self.organization, name="Luna")
        self.client.force_authenticate(user=self.user)

    def test_push_token_is_stored_once(self):
        from .models import PushToken

        for _ in range(2):
            response = self.client.post("/api/notifications/register-token/", {"token": "ExponentPushToken[a]"}, format="json")
            self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(PushToken.objects.filter(user=self.user).count(), 1)

    def test_push_token_is_required(self):
        response = self.client.post("/api/notifications/register-token/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_follow_and_unfollow_an_animal(self):
        url = f"/api/notifications/follow/animal/{self.animal.id}/"
        self.assertEqual(self.client.post(url).data["detail"], "Now following.")
        self.assertEqual(self.client.post(url).data["detail"], "Already following.")
        status_url = f"/api/notifications/follow-status/?animal_id={self.animal.id}"
        self.assertTrue(self.client.get(status_url).data["following_animal"])
        self.assertFalse(self.client.delete(url).data["following"])
        self.assertFalse(self.client.get(status_url).data["following_animal"])

    def test_follow_and_unfollow_an_organization(self):
        url = f"/api/notifications/follow/organization/{self.organization.id}/"
        self.assertTrue(self.client.post(url).data["following"])
        follows = self.client.get("/api/notifications/my-follows/").data
        self.assertEqual(follows["followed_organizations"], [self.organization.id])
        status_url = f"/api/notifications/follow-status/?organization_id={self.organization.id}"
        self.assertTrue(self.client.get(status_url).data["following_organization"])
        self.client.delete(url)
        self.assertEqual(self.client.get("/api/notifications/my-follows/").data["followed_organizations"], [])

    def test_following_something_that_does_not_exist_is_a_404(self):
        self.assertEqual(self.client.post("/api/notifications/follow/animal/9999/").status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.post("/api/notifications/follow/organization/9999/").status_code, status.HTTP_404_NOT_FOUND)

    def test_follow_status_without_ids_is_empty(self):
        self.assertEqual(self.client.get("/api/notifications/follow-status/").data, {})

    def test_follows_need_an_account(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.post(f"/api/notifications/follow/animal/{self.animal.id}/").status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.get("/api/notifications/my-follows/").status_code, status.HTTP_401_UNAUTHORIZED)


class ExpoPushTests(APITestCase):
    def test_messages_are_sent_to_expo_in_one_request(self):
        import json
        from unittest.mock import MagicMock, patch

        from .services import EXPO_PUSH_URL, send_push_notifications

        reply = MagicMock()
        reply.__enter__.return_value.read.return_value = b'{"data": []}'
        with patch("notifications.services.urllib.request.urlopen", return_value=reply) as urlopen:
            send_push_notifications(["ExponentPushToken[a]", "ExponentPushToken[b]"], "Title", "Body", {"type": "x"})
        request = urlopen.call_args[0][0]
        self.assertEqual(request.full_url, EXPO_PUSH_URL)
        sent = json.loads(request.data)
        self.assertEqual([message["to"] for message in sent], ["ExponentPushToken[a]", "ExponentPushToken[b]"])
        self.assertEqual(sent[0]["data"], {"type": "x"})

    def test_no_tokens_means_no_request(self):
        from unittest.mock import patch

        from .services import send_push_notifications

        with patch("notifications.services.urllib.request.urlopen") as urlopen:
            send_push_notifications([], "Title", "Body")
        urlopen.assert_not_called()

    def test_expo_being_down_does_not_break_the_request(self):
        from unittest.mock import patch

        from .services import send_push_notifications

        with patch("notifications.services.urllib.request.urlopen", side_effect=OSError("down")):
            send_push_notifications(["ExponentPushToken[a]"], "Title", "Body")

    def test_bold_markers_are_stripped_from_the_push_but_kept_in_the_inbox(self):
        from unittest.mock import patch

        user = User.objects.create_user(email="u@example.com", username="u", password="x")
        with patch("notifications.services.send_push_notifications") as send:
            notify_users([user.id], "Community", "New post from **Hope**.", {"type": "new_post"})
        self.assertEqual(send.call_args[0][2], "New post from Hope.")
        self.assertEqual(Notification.objects.get().body, "New post from **Hope**.")

    def test_unread_chat_notifications_are_grouped(self):
        from unittest.mock import patch

        user = User.objects.create_user(email="u@example.com", username="u", password="x")
        with patch("notifications.services.send_push_notifications"):
            notify_users([user.id], "Chat", "First", {"type": "chat_message"}, group_key="chat-1")
            notify_users([user.id], "Chat", "Second", {"type": "chat_message"}, group_key="chat-1")
        self.assertEqual(Notification.objects.get().body, "Second")
