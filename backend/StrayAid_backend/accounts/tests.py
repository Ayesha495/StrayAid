from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from organizations.models import Organization


User = get_user_model()


class AccountApiTests(APITestCase):
    def test_me_endpoint_syncs_role_when_organization_profile_exists(self):
        user = User.objects.create_user(
            email="org@example.com",
            username="orguser",
            password="secret123",
            role="public",
        )
        Organization.objects.create(user=user, name="Safe Paws")
        self.client.force_authenticate(user=user)

        response = self.client.get("/auth/me/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["role"], "organization")
        user.refresh_from_db()
        self.assertEqual(user.role, "organization")

    def test_me_endpoint_requires_authentication(self):
        response = self.client.get("/auth/me/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
