from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from animals.models import Animal
from rescue.models import Case

from .models import Organization


User = get_user_model()


class OrganizationApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="rescue@example.com",
            username="rescue",
            password="secret123",
            role="public",
        )

    def test_create_profile_promotes_user_and_defaults_contact_email(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            "/api/organizations/",
            {
                "name": "Safe Paws",
                "description": "City rescue network",
                "address": "Main Street",
                "phone_number": "123456789",
                "bank_name": "Meezan Bank",
                "bank_account_title": "Safe Paws Rescue",
                "bank_account_number": "1234567890",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.user.refresh_from_db()
        organization = Organization.objects.get(user=self.user)
        self.assertEqual(self.user.role, "organization")
        self.assertEqual(organization.email, self.user.email)
        self.assertEqual(organization.bank_name, "Meezan Bank")
        self.assertEqual(organization.bank_account_title, "Safe Paws Rescue")
        self.assertEqual(organization.bank_account_number, "1234567890")

    def test_create_profile_updates_existing_organization_for_legacy_account(self):
        Organization.objects.create(
            user=self.user,
            name="Safe Paws",
            email="",
            address="Old Address",
        )
        self.user.role = "organization"
        self.user.save(update_fields=["role"])
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            "/api/organizations/",
            {
                "name": "Safe Paws Updated",
                "description": "Updated org profile",
                "address": "New Address",
                "phone_number": "123456789",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        organization = Organization.objects.get(user=self.user)
        self.assertEqual(organization.name, "Safe Paws Updated")
        self.assertEqual(organization.description, "Updated org profile")
        self.assertEqual(organization.address, "New Address")
        self.assertEqual(organization.phone, "123456789")
        self.assertEqual(organization.email, self.user.email)

    def test_authenticated_organization_can_get_own_profile(self):
        self.user.role = "organization"
        self.user.save(update_fields=["role"])
        organization = Organization.objects.create(user=self.user, name="Safe Paws", email=self.user.email)
        self.client.force_authenticate(user=self.user)

        response = self.client.get("/api/organizations/me/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], organization.id)
        self.assertEqual(response.data["name"], "Safe Paws")

    def test_organization_me_returns_404_when_profile_missing(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get("/api/organizations/me/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data["detail"], "Organization profile not found.")

    def test_authenticated_organization_can_patch_own_profile(self):
        self.user.role = "organization"
        self.user.save(update_fields=["role"])
        Organization.objects.create(user=self.user, name="Safe Paws", email=self.user.email)
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            "/api/organizations/me/",
            {"city": "Lahore", "capacity": 12, "phone_number": "03123456789"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["city"], "Lahore")
        self.assertEqual(response.data["capacity"], 12)
        self.assertEqual(response.data["phone_number"], "03123456789")

    def test_dashboard_returns_summary_for_organization(self):
        self.user.role = "organization"
        self.user.save(update_fields=["role"])
        organization = Organization.objects.create(
            user=self.user,
            name="Safe Paws",
            email=self.user.email,
            latitude=31.5,
            longitude=74.3,
        )
        assigned_case = Case.objects.create(
            description="Assigned case",
            latitude=31.51,
            longitude=74.31,
            reported_by=self.user,
            organization=organization,
            assigned_to=self.user,
            status="assigned",
        )
        Case.objects.create(
            description="Nearby open case",
            latitude=31.5001,
            longitude=74.3001,
            reported_by=self.user,
            status="reported",
        )
        Animal.objects.create(case=assigned_case, organization=organization, name="Milo")
        self.client.force_authenticate(user=self.user)

        response = self.client.get("/api/organizations/dashboard/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["organization"]["name"], "Safe Paws")
        self.assertEqual(response.data["summary"]["total_cases"], 1)
        self.assertEqual(response.data["summary"]["animals_count"], 1)
        self.assertEqual(len(response.data["recent_cases"]), 1)
        self.assertEqual(len(response.data["nearby_cases"]), 1)

    def test_public_can_view_organization_and_its_animals(self):
        self.user.role = "organization"
        self.user.save(update_fields=["role"])
        organization = Organization.objects.create(user=self.user, name="Safe Paws", email=self.user.email)
        case = Case.objects.create(
            description="Rescue case",
            latitude=31.5,
            longitude=74.3,
            reported_by=self.user,
            organization=organization,
            assigned_to=self.user,
            status="rescued",
        )
        animal = Animal.objects.create(case=case, organization=organization, name="Milo")

        profile_response = self.client.get(f"/api/organizations/{organization.id}/")
        animals_response = self.client.get(f"/api/organizations/{organization.id}/animals/")

        self.assertEqual(profile_response.status_code, status.HTTP_200_OK)
        self.assertEqual(profile_response.data["name"], "Safe Paws")
        self.assertEqual(animals_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(animals_response.data), 1)
        self.assertEqual(animals_response.data[0]["id"], animal.id)

    def test_public_organization_lookup_returns_404_for_missing_profile(self):
        response = self.client.get("/api/organizations/9999/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class OrganizationProfileTests(APITestCase):
    """The public organization profile and gifts to its medical supplies."""

    def setUp(self):
        import tempfile

        from django.test import override_settings

        from animals.models import Animal, Sponsorship
        from rescue.models import Case

        media = override_settings(MEDIA_ROOT=tempfile.mkdtemp())
        media.enable()
        self.addCleanup(media.disable)
        self.org_user = User.objects.create_user(email="porg@example.com", username="porg", password="x", role="organization")
        self.organization = Organization.objects.create(
            user=self.org_user, name="Paws & Care Rescue", bank_account_number="0101", supply_goal_pkr=10000
        )
        self.donor = User.objects.create_user(email="d@example.com", username="d", password="x", first_name="Ali")
        for name, animal_status in [("Max", "adoptable"), ("Bella", "adopted")]:
            case = Case.objects.create(description=name, latitude=33.7, longitude=73.0, reported_by=self.donor, organization=self.organization)
            animal = Animal.objects.create(case=case, organization=self.organization, name=name, status=animal_status)
        Sponsorship.objects.create(animal=animal, sponsor=self.donor, amount_pkr=1500, status="confirmed")

    def receipt(self):
        import io

        from django.core.files.uploadedfile import SimpleUploadedFile
        from PIL import Image

        buffer = io.BytesIO()
        Image.new("RGB", (8, 8), "green").save(buffer, format="PNG")
        return SimpleUploadedFile("r.png", buffer.getvalue(), content_type="image/png")

    def test_profile_numbers_and_fund(self):
        data = self.client.get(f"/api/organizations/{self.organization.id}/profile/").data
        self.assertEqual((data["stats"]["rescued"], data["stats"]["adopted"], data["stats"]["in_care"]), (2, 1, 1))
        self.assertEqual((data["fund"]["raised_pkr"], data["fund"]["percent"]), (1500, 15))
        self.assertFalse(data["following"])

    def test_donating_with_a_receipt_and_confirming(self):
        self.client.force_authenticate(user=self.donor)
        response = self.client.post(f"/api/organizations/{self.organization.id}/donate/",
                                    {"amount_pkr": 1000, "receipt": self.receipt()}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertTrue(self.client.get(f"/api/organizations/{self.organization.id}/profile/").data["my_pending_donation"])
        self.assertEqual(self.client.post(f"/api/organizations/donations/{response.data['id']}/review/", {"status": "confirmed"}).status_code, 403)

        self.client.force_authenticate(user=self.org_user)
        self.client.post(f"/api/organizations/donations/{response.data['id']}/review/", {"status": "confirmed"})
        self.assertEqual(self.client.get(f"/api/organizations/{self.organization.id}/profile/").data["fund"]["raised_pkr"], 2500)

    def test_organizations_list_their_donations_and_donors_list_theirs(self):
        self.client.force_authenticate(user=self.donor)
        self.client.post(f"/api/organizations/{self.organization.id}/donate/",
                         {"amount_pkr": 1000, "receipt": self.receipt()}, format="multipart")
        mine = self.client.get("/api/organizations/donations/").data
        self.assertEqual([(row["amount_pkr"], row["status"]) for row in mine], [(1000, "pending")])

        self.client.force_authenticate(user=self.org_user)
        rows = self.client.get("/api/organizations/donations/?status=pending").data
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["donor_name"], "Ali")
        self.assertTrue(rows[0]["receipt"].startswith("http"))
        self.assertEqual(self.client.get("/api/organizations/donations/?status=confirmed").data, [])

        # Another organization doesn't see them.
        other = User.objects.create_user(email="o9@example.com", username="o9", password="x", role="organization")
        Organization.objects.create(user=other, name="Other")
        self.client.force_authenticate(user=other)
        self.assertEqual(self.client.get("/api/organizations/donations/").data, [])

    def test_sponsorships_say_who_pledged(self):
        self.client.force_authenticate(user=self.org_user)
        rows = self.client.get("/api/animals/sponsorships/").data
        self.assertEqual([(row["sponsor_name"], row["amount_pkr"]) for row in rows], [("Ali", 1500)])

    def test_donations_need_a_receipt_and_an_account(self):
        url = f"/api/organizations/{self.organization.id}/donate/"
        self.assertEqual(self.client.post(url, {"amount_pkr": 1000}).status_code, status.HTTP_401_UNAUTHORIZED)
        self.client.force_authenticate(user=self.donor)
        self.assertIn("receipt", self.client.post(url, {"amount_pkr": 1000}, format="multipart").data)


class OrganizationDirectoryTests(APITestCase):
    def test_public_cards_list_verified_first_with_phone_numbers(self):
        for index, (name, verified) in enumerate([("Zed Rescue", True), ("Alpha Shelter", False)]):
            user = User.objects.create_user(email=f"dir{index}@example.com", username=f"dir{index}", password="x", role="organization")
            Organization.objects.create(user=user, name=name, is_verified=verified, phone="+92 300 0000000", bank_account_number="1")
        rows = self.client.get("/api/organizations/directory/").data
        self.assertEqual([row["name"] for row in rows], ["Zed Rescue", "Alpha Shelter"])
        self.assertEqual(rows[0]["phone"], "+92 300 0000000")
        self.assertNotIn("bank_account_number", rows[0])
