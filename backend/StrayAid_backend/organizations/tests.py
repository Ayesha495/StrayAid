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
