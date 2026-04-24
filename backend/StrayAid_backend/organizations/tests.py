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
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.user.refresh_from_db()
        organization = Organization.objects.get(user=self.user)
        self.assertEqual(self.user.role, "organization")
        self.assertEqual(organization.email, self.user.email)

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
