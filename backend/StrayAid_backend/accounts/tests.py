from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from unittest.mock import patch

from organizations.models import Organization


User = get_user_model()


class AccountApiTests(APITestCase):
    def test_jwt_login_accepts_email_with_case_and_whitespace(self):
        User.objects.create_user(
            email="public@example.com",
            username="publicuser",
            password="secret123",
            role="public",
        )

        response = self.client.post(
            "/auth/jwt/create/",
            {"email": "  PUBLIC@example.com  ", "password": "secret123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_jwt_login_accepts_username_identifier(self):
        User.objects.create_user(
            email="public@example.com",
            username="publicuser",
            password="secret123",
            role="public",
        )

        response = self.client.post(
            "/auth/jwt/create/",
            {"username": "publicuser", "password": "secret123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_me_endpoint_returns_authenticated_user_profile(self):
        user = User.objects.create_user(
            email="public@example.com",
            username="publicuser",
            password="secret123",
            first_name="Public",
            last_name="User",
            role="public",
        )
        self.client.force_authenticate(user=user)

        response = self.client.get("/auth/me/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], user.email)
        self.assertEqual(response.data["username"], user.username)
        self.assertEqual(response.data["first_name"], "Public")
        self.assertEqual(response.data["role"], "public")

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

    @patch("accounts.views._verify_google_id_token")
    def test_google_auth_returns_tokens_for_valid_id_token(self, mock_verify_google_id_token):
        mock_verify_google_id_token.return_value = {
            "email": "google@example.com",
            "email_verified": True,
            "given_name": "Google",
            "family_name": "User",
        }

        response = self.client.post("/auth/google/", {"id_token": "valid-token"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["user"]["email"], "google@example.com")
        self.assertTrue(User.objects.filter(email="google@example.com").exists())

    def test_google_auth_rejects_request_without_any_token(self):
        response = self.client.post("/auth/google/", {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "Either id_token or access_token is required.")

    @patch("accounts.views._verify_google_id_token")
    def test_google_auth_rejects_payload_without_email(self, mock_verify_google_id_token):
        mock_verify_google_id_token.return_value = {"email_verified": True}

        response = self.client.post("/auth/google/", {"id_token": "valid-token"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "Google account email is required.")

    @patch("accounts.views._verify_google_id_token")
    def test_google_auth_rejects_unverified_google_email(self, mock_verify_google_id_token):
        mock_verify_google_id_token.return_value = {
            "email": "google@example.com",
            "email_verified": False,
        }

        response = self.client.post("/auth/google/", {"id_token": "valid-token"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "Google email is not verified.")

    @patch("accounts.views._verify_google_id_token")
    def test_google_auth_creates_unique_username_for_new_user(self, mock_verify_google_id_token):
        User.objects.create_user(
            email="existing@example.com",
            username="google",
            password="secret123",
            role="public",
        )
        mock_verify_google_id_token.return_value = {
            "email": "google@example.com",
            "email_verified": True,
            "given_name": "Google",
            "family_name": "User",
        }

        response = self.client.post("/auth/google/", {"id_token": "valid-token"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user"]["username"], "google1")
