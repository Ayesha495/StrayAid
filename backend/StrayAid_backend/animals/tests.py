import shutil
import tempfile

from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from organizations.models import Organization
from rescue.models import Case

from .models import Animal


User = get_user_model()


class MediaEnabledAPITestCase(APITestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # Store uploaded test media in a temporary directory.
        cls._temp_media = tempfile.mkdtemp()
        cls._override = override_settings(MEDIA_ROOT=cls._temp_media)
        cls._override.enable()

    @classmethod
    def tearDownClass(cls):
        cls._override.disable()
        shutil.rmtree(cls._temp_media, ignore_errors=True)
        super().tearDownClass()


class AnimalApiTests(MediaEnabledAPITestCase):
    def setUp(self):
        # Two organizations make ownership checks easy to exercise.
        self.org_user = User.objects.create_user(
            email="org@example.com",
            username="org",
            password="secret123",
            role="organization",
        )
        self.other_user = User.objects.create_user(
            email="other@example.com",
            username="other",
            password="secret123",
            role="organization",
        )
        self.organization = Organization.objects.create(
            user=self.org_user,
            name="Safe Paws",
            email=self.org_user.email,
            phone="03123456789",
            bank_name="Meezan Bank",
            bank_account_title="Safe Paws Rescue",
            bank_account_number="1234567890",
        )
        self.other_organization = Organization.objects.create(
            user=self.other_user,
            name="Second Chance",
            email=self.other_user.email,
        )
        self.case = Case.objects.create(
            description="Need rescue",
            latitude=31.5,
            longitude=74.3,
            reported_by=self.org_user,
            organization=self.organization,
            assigned_to=self.org_user,
            status="assigned",
        )
        self.other_case = Case.objects.create(
            description="Other org case",
            latitude=31.6,
            longitude=74.4,
            reported_by=self.other_user,
            organization=self.other_organization,
            assigned_to=self.other_user,
            status="assigned",
        )

    def test_organization_can_create_animal_for_own_case_and_case_moves_to_adoption(self):
        self.client.force_authenticate(user=self.org_user)

        response = self.client.post(
            "/api/animals/",
            {
                "case": self.case.id,
                "name": "Milo",
                "status": Animal.STATUS_ADOPTABLE,
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.case.refresh_from_db()
        self.assertEqual(self.case.status, "adoption")
        self.assertEqual(Animal.objects.get().organization, self.organization)

    def test_organization_cannot_create_animal_for_another_organizations_case(self):
        self.client.force_authenticate(user=self.org_user)

        response = self.client.post(
            "/api/animals/",
            {
                "case": self.other_case.id,
                "name": "Blocked",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("case", response.data)

    def test_public_feed_can_filter_animals_by_organization(self):
        animal = Animal.objects.create(case=self.case, organization=self.organization, name="Milo")
        Animal.objects.create(case=self.other_case, organization=self.other_organization, name="Luna")

        response = self.client.get(f"/api/animals/public/?organization_id={self.organization.id}")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], animal.id)

    def test_public_filter_returns_empty_list_for_unknown_organization(self):
        Animal.objects.create(case=self.case, organization=self.organization, name="Milo")

        response = self.client.get("/api/animals/public/?organization_id=9999")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    def test_public_feed_can_filter_animals_by_status(self):
        adoptable = Animal.objects.create(
            case=self.case,
            organization=self.organization,
            name="Milo",
            status=Animal.STATUS_ADOPTABLE,
        )
        Animal.objects.create(
            case=self.other_case,
            organization=self.other_organization,
            name="Luna",
            status=Animal.STATUS_RECOVERING,
        )

        response = self.client.get(f"/api/animals/public/?status={Animal.STATUS_ADOPTABLE}")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], adoptable.id)

    def test_public_can_retrieve_single_animal(self):
        animal = Animal.objects.create(case=self.case, organization=self.organization, name="Milo")

        response = self.client.get(f"/api/animals/{animal.id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], animal.id)
        self.assertEqual(response.data["name"], "Milo")
        self.assertEqual(response.data["adoption_info"]["phone"], "03123456789")
        self.assertEqual(response.data["adoption_info"]["email"], self.org_user.email)
        self.assertEqual(response.data["donation_info"]["bank"], "Meezan Bank")
        self.assertEqual(response.data["donation_info"]["account_name"], "Safe Paws Rescue")
        self.assertEqual(response.data["donation_info"]["account_number"], "1234567890")

    def test_organization_cannot_create_animal_when_capacity_is_full(self):
        self.organization.capacity = 1
        self.organization.save(update_fields=["capacity"])
        Animal.objects.create(case=self.case, organization=self.organization, name="Milo")
        second_case = Case.objects.create(
            description="Second own case",
            latitude=31.51,
            longitude=74.31,
            reported_by=self.org_user,
            organization=self.organization,
            assigned_to=self.org_user,
            status="rescued",
        )
        self.client.force_authenticate(user=self.org_user)

        response = self.client.post(
            "/api/animals/",
            {
                "case": second_case.id,
                "name": "Luna",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("capacity", response.data)

    def test_organization_can_update_own_animal(self):
        animal = Animal.objects.create(case=self.case, organization=self.organization, name="Milo")
        self.client.force_authenticate(user=self.org_user)

        response = self.client.patch(
            f"/api/animals/{animal.id}/",
            {"status": Animal.STATUS_ADOPTED, "medical_info": "Recovered"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        animal.refresh_from_db()
        self.case.refresh_from_db()
        self.assertEqual(animal.status, Animal.STATUS_ADOPTED)
        self.assertEqual(self.case.status, "closed")
        self.assertIsNotNone(self.case.resolved_at)

    def test_organization_listing_returns_only_own_animals(self):
        own_animal = Animal.objects.create(case=self.case, organization=self.organization, name="Milo")
        Animal.objects.create(case=self.other_case, organization=self.other_organization, name="Luna")
        self.client.force_authenticate(user=self.org_user)

        response = self.client.get("/api/animals/organization/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], own_animal.id)


class AnimalProfileTests(MediaEnabledAPITestCase):
    """The public animal profile (Stitch 13): health tags, photos and community counts."""

    def setUp(self):
        from .models import AdoptionApplication, Sponsorship

        org_user = User.objects.create_user(email="o@example.com", username="o", password="x", role="organization")
        self.organization = Organization.objects.create(user=org_user, name="Safe Paws", city="Islamabad")
        reporter = User.objects.create_user(email="r@example.com", username="r", password="x")
        self.people = [User.objects.create_user(email=f"p{i}@example.com", username=f"p{i}", password="x") for i in range(3)]
        case = Case.objects.create(description="Cat", latitude=33.7, longitude=73.0, reported_by=reporter,
                                   organization=self.organization, confidence_score=88)
        self.animal = Animal.objects.create(case=case, organization=self.organization, name="Luna", species="Cat",
                                            status=Animal.STATUS_ADOPTABLE, health="healthy", vaccinated=True)
        AdoptionApplication.objects.create(animal=self.animal, applicant=self.people[0], full_name="A", phone="1", home_type="house")
        AdoptionApplication.objects.create(animal=self.animal, applicant=self.people[1], full_name="B", phone="2",
                                           home_type="apartment", status="withdrawn")
        Sponsorship.objects.create(animal=self.animal, sponsor=self.people[0], amount_pkr=500, status="confirmed")
        Sponsorship.objects.create(animal=self.animal, sponsor=self.people[0], amount_pkr=1000, status="confirmed")
        Sponsorship.objects.create(animal=self.animal, sponsor=self.people[2], amount_pkr=500, status="pending")

    def test_guest_sees_profile_with_health_and_counts(self):
        data = self.client.get(f"/api/animals/{self.animal.id}/").data

        self.assertEqual((data["health"], data["vaccinated"]), ("healthy", True))
        self.assertEqual(data["application_count"], 1)  # withdrawn ones don't count
        self.assertEqual(data["sponsor_count"], 1)  # people with a confirmed pledge, counted once
        self.assertTrue(data["ai_verified"])

    def test_funding_counts_only_confirmed_money_towards_the_goal(self):
        self.animal.funding_goal_pkr = 15000
        self.animal.save(update_fields=["funding_goal_pkr"])
        data = self.client.get(f"/api/animals/{self.animal.id}/").data
        # 500 + 1000 confirmed; the pending 500 waits for its receipt to be checked.
        self.assertEqual((data["funding_goal_pkr"], data["raised_pkr"]), (15000, 1500))
        self.assertEqual(data["photos"], [])

    def test_unverified_rescue_has_no_shield(self):
        self.animal.case.possibly_invalid = True
        self.animal.case.save()

        self.assertFalse(self.client.get(f"/api/animals/{self.animal.id}/").data["ai_verified"])


class AdoptionApplyTests(MediaEnabledAPITestCase):
    """Sending an adoption application (Stitch 14)."""

    def setUp(self):
        from unittest.mock import patch

        org_user = User.objects.create_user(email="o@example.com", username="o", password="x", role="organization")
        self.organization = Organization.objects.create(user=org_user, name="Safe Paws", city="Islamabad")
        reporter = User.objects.create_user(email="r@example.com", username="r", password="x")
        self.adopter = User.objects.create_user(email="a@example.com", username="a", password="x")
        case = Case.objects.create(description="Cat", latitude=33.7, longitude=73.0, reported_by=reporter, organization=self.organization)
        self.animal = Animal.objects.create(case=case, organization=self.organization, name="Luna", species="Cat",
                                            status=Animal.STATUS_ADOPTABLE)
        self.form = {
            "full_name": "  Hira   Malik ", "phone": "+92 300 1234567", "home_type": "apartment", "has_other_pets": False,
            "city": "Islamabad", "ownership": "rent", "landlord_allows_pets": True, "household_size": 3,
            "has_children": True, "hours_alone": 4, "experience": "some",
            "reason": "We have a quiet flat and lots of time to care for Luna.", "care_plan": "",
            "agrees_home_visit": True, "agrees_return_policy": True,
        }
        self.notify = patch("notifications.services.notify_users")
        self.notified = self.notify.start()
        self.addCleanup(self.notify.stop)

    def url(self):
        return f"/api/animals/{self.animal.id}/apply/"

    def test_application_is_saved_and_the_organization_is_told(self):
        self.client.force_authenticate(user=self.adopter)

        response = self.client.post(self.url(), self.form, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        application = self.animal.adoption_applications.get()
        self.assertEqual((application.full_name, application.status, application.applicant), ("Hira Malik", "pending", self.adopter))
        self.assertEqual(self.notified.call_args.args[0], [self.organization.user_id])
        my = self.client.get(f"/api/animals/{self.animal.id}/").data["my_application"]
        self.assertEqual(my, {"id": application.id, "status": "pending"})

    def test_one_active_application_per_person(self):
        self.client.force_authenticate(user=self.adopter)
        self.client.post(self.url(), self.form, format="json")

        again = self.client.post(self.url(), self.form, format="json")

        self.assertEqual(again.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.animal.adoption_applications.count(), 1)

    def test_only_adoptable_animals_and_signed_in_people(self):
        self.assertEqual(self.client.post(self.url(), self.form, format="json").status_code, status.HTTP_401_UNAUTHORIZED)
        self.animal.status = Animal.STATUS_RECOVERING
        self.animal.save()
        self.client.force_authenticate(user=self.adopter)

        self.assertEqual(self.client.post(self.url(), self.form, format="json").status_code, status.HTTP_400_BAD_REQUEST)

    def test_required_answers_and_promises(self):
        self.client.force_authenticate(user=self.adopter)
        bad = {**self.form, "phone": "123", "reason": "Cute", "landlord_allows_pets": None, "agrees_return_policy": False}

        response = self.client.post(self.url(), bad, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        for field in ("phone", "reason"):
            self.assertIn(field, response.data)
        self.assertEqual(self.animal.adoption_applications.count(), 0)

    def test_organization_cannot_adopt_its_own_animal(self):
        self.client.force_authenticate(user=self.organization.user)

        self.assertEqual(self.client.post(self.url(), self.form, format="json").status_code, status.HTTP_400_BAD_REQUEST)


def make_png(name="receipt.png"):
    """A real (tiny) image, for fields that check the upload is a picture."""
    import io

    from django.core.files.uploadedfile import SimpleUploadedFile
    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", (8, 8), "green").save(buffer, format="PNG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/png")


class MyApplicationsTests(MediaEnabledAPITestCase):
    """My Applications (Stitch 15): listing, withdrawing, and the organization's decision."""

    def setUp(self):
        org_user = User.objects.create_user(email="o@example.com", username="o", password="x", role="organization")
        self.org_user = org_user
        self.organization = Organization.objects.create(user=org_user, name="Safe Paws", city="Islamabad")
        reporter = User.objects.create_user(email="r@example.com", username="r", password="x")
        self.adopter = User.objects.create_user(email="a@example.com", username="a", password="x", first_name="Hira")
        case = Case.objects.create(description="Cat", latitude=33.7, longitude=73.0, reported_by=reporter, organization=self.organization)
        self.animal = Animal.objects.create(case=case, organization=self.organization, name="Luna", species="Cat",
                                            status=Animal.STATUS_ADOPTABLE)
        from .models import AdoptionApplication

        self.application = AdoptionApplication.objects.create(
            animal=self.animal, applicant=self.adopter, full_name="Hira Malik", phone="+92 300 1234567", home_type="house"
        )

    def test_people_see_only_their_own_applications_with_the_animal(self):
        stranger = User.objects.create_user(email="s@example.com", username="s", password="x")
        self.client.force_authenticate(user=stranger)
        self.assertEqual(self.client.get("/api/animals/applications/").data, [])

        self.client.force_authenticate(user=self.adopter)
        rows = self.client.get("/api/animals/applications/").data
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["animal"]["name"], "Luna")
        self.assertEqual(rows[0]["animal"]["organization"]["name"], "Safe Paws")
        self.assertEqual(self.client.get("/api/animals/applications/?status=approved").data, [])
        # The animal list still works next to the new routes.
        self.assertEqual(self.client.get("/api/animals/public/").status_code, status.HTTP_200_OK)

    def test_withdrawing_closes_it_and_lets_you_apply_again(self):
        self.client.force_authenticate(user=self.adopter)
        response = self.client.post(f"/api/animals/applications/{self.application.id}/withdraw/")
        self.assertEqual(response.data["status"], "withdrawn")
        self.assertIsNotNone(response.data["decided_at"])
        self.assertIsNone(self.client.get(f"/api/animals/{self.animal.id}/").data["my_application"])
        again = self.client.post(f"/api/animals/applications/{self.application.id}/withdraw/")
        self.assertEqual(again.status_code, status.HTTP_400_BAD_REQUEST)

    def test_the_organization_decides_and_the_applicant_is_told(self):
        from notifications.models import Notification

        self.client.force_authenticate(user=self.adopter)
        forbidden = self.client.post(f"/api/animals/applications/{self.application.id}/decide/", {"status": "approved"})
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.org_user)
        self.assertEqual(len(self.client.get("/api/animals/applications/").data), 1)
        response = self.client.post(f"/api/animals/applications/{self.application.id}/decide/", {"status": "approved"})
        self.assertEqual(response.data["status"], "approved")
        note = Notification.objects.get(user=self.adopter)
        self.assertEqual((note.kind, note.data["application_id"]), ("adoption", self.application.id))
        self.assertIn("**Luna**", note.body)


class SponsorTests(MediaEnabledAPITestCase):
    """Pledging support with a transfer receipt (Stitch 16)."""

    def setUp(self):
        self.org_user = User.objects.create_user(email="o@example.com", username="o", password="x", role="organization")
        self.organization = Organization.objects.create(
            user=self.org_user, name="Safe Paws", city="Islamabad", bank_name="HBL", bank_account_title="Safe Paws",
            bank_account_number="0202-0000000202",
        )
        reporter = User.objects.create_user(email="r@example.com", username="r", password="x")
        self.sponsor = User.objects.create_user(email="s@example.com", username="s", password="x", first_name="Sara", last_name="Ahmed")
        case = Case.objects.create(description="Dog", latitude=33.7, longitude=73.0, reported_by=reporter, organization=self.organization)
        self.animal = Animal.objects.create(case=case, organization=self.organization, name="Max", species="Dog",
                                            status=Animal.STATUS_RECOVERING, sponsor_goal=50)

    def pledge(self, **extra):
        return self.client.post(f"/api/animals/{self.animal.id}/sponsor/",
                                {"amount_pkr": 1000, "monthly": "true", "receipt": make_png(), **extra}, format="multipart")

    def test_pledge_is_saved_pending_and_both_sides_are_told(self):
        from notifications.models import Notification

        self.client.force_authenticate(user=self.sponsor)
        response = self.pledge()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual((response.data["status"], response.data["amount_pkr"], response.data["monthly"]), ("pending", 1000, True))
        self.assertEqual(Notification.objects.filter(kind="sponsorship").count(), 2)
        self.assertTrue(Notification.objects.filter(user=self.org_user, body__contains="PKR 1,000 a month").exists())

        profile = self.client.get(f"/api/animals/{self.animal.id}/").data
        self.assertEqual(profile["my_sponsorship"]["status"], "pending")
        self.assertEqual((profile["sponsor_goal"], profile["sponsor_count"]), (50, 0))
        # One pledge waits for its receipt check before the next.
        self.assertEqual(self.pledge().status_code, status.HTTP_400_BAD_REQUEST)

    def test_confirmed_pledges_count_as_sponsors(self):
        self.client.force_authenticate(user=self.sponsor)
        pledge_id = self.pledge().data["id"]
        self.client.force_authenticate(user=self.org_user)
        response = self.client.post(f"/api/animals/sponsorships/{pledge_id}/review/", {"status": "confirmed"})
        self.assertEqual(response.data["status"], "confirmed")
        profile = self.client.get(f"/api/animals/{self.animal.id}/").data
        self.assertEqual((profile["sponsor_count"], profile["sponsor_initials"]), (1, ["SA"]))

    def test_receipt_amount_and_animal_are_checked(self):
        self.client.force_authenticate(user=self.sponsor)
        no_receipt = self.client.post(f"/api/animals/{self.animal.id}/sponsor/", {"amount_pkr": 1000}, format="multipart")
        self.assertIn("receipt", no_receipt.data)
        self.assertIn("amount_pkr", self.pledge(amount_pkr=50).data)

        self.animal.status = Animal.STATUS_ADOPTED
        self.animal.save()
        self.assertEqual(self.pledge().status_code, status.HTTP_400_BAD_REQUEST)
