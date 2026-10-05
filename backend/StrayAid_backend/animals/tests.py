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
        self.assertEqual(data["photos"], [])

    def test_unverified_rescue_has_no_shield(self):
        self.animal.case.possibly_invalid = True
        self.animal.case.save()

        self.assertFalse(self.client.get(f"/api/animals/{self.animal.id}/").data["ai_verified"])
