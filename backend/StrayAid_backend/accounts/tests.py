import re
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


class PasswordResetTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="reporter@example.com",
            username="reporter",
            password="OldPass!2026",
            role="public",
        )

    def _request_code(self, email="reporter@example.com"):
        from django.core import mail

        response = self.client.post("/auth/password-reset/", {"email": email}, format="json")
        code = re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1) if mail.outbox else None
        return response, code

    def test_request_emails_a_six_digit_code(self):
        from django.core import mail

        response, code = self._request_code("  REPORTER@example.com ")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["reporter@example.com"])
        self.assertIsNotNone(code)

    def test_request_for_unknown_email_gives_same_reply_and_sends_nothing(self):
        from django.core import mail

        known, _ = self._request_code()
        unknown = self.client.post("/auth/password-reset/", {"email": "nobody@example.com"}, format="json")

        self.assertEqual(unknown.status_code, status.HTTP_200_OK)
        self.assertEqual(unknown.data["detail"], known.data["detail"])
        self.assertEqual(len(mail.outbox), 1)

    def test_request_is_rate_limited(self):
        from django.core import mail

        self._request_code()
        self._request_code()

        self.assertEqual(len(mail.outbox), 1)

    def test_confirm_with_right_code_changes_password_once(self):
        _, code = self._request_code()
        payload = {"email": "reporter@example.com", "code": code, "new_password": "NewPass!2026"}

        response = self.client.post("/auth/password-reset/confirm/", payload, format="json")
        replay = self.client.post("/auth/password-reset/confirm/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(replay.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewPass!2026"))

    def test_confirm_with_wrong_code_fails_and_locks_after_five_tries(self):
        _, code = self._request_code()
        wrong = "000000" if code != "000000" else "111111"

        for _ in range(5):
            self.client.post(
                "/auth/password-reset/confirm/",
                {"email": "reporter@example.com", "code": wrong, "new_password": "NewPass!2026"},
                format="json",
            )
        response = self.client.post(
            "/auth/password-reset/confirm/",
            {"email": "reporter@example.com", "code": code, "new_password": "NewPass!2026"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("OldPass!2026"))

    def test_confirm_rejects_weak_password(self):
        _, code = self._request_code()

        response = self.client.post(
            "/auth/password-reset/confirm/",
            {"email": "reporter@example.com", "code": code, "new_password": "123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("OldPass!2026"))


class SignUpTests(APITestCase):
    def _png(self):
        import io

        from django.core.files.uploadedfile import SimpleUploadedFile
        from PIL import Image

        buffer = io.BytesIO()
        Image.new("RGB", (8, 8), "#1E6B56").save(buffer, format="PNG")
        return SimpleUploadedFile("me.png", buffer.getvalue(), content_type="image/png")

    def test_mobile_sign_up_with_full_name_and_photo(self):
        response = self.client.post(
            "/auth/users/",
            {
                "full_name": "  Hira   Malik Qureshi ",
                "email": "Hira@Example.com",
                "password": "Rescue!Pass2026",
                "re_password": "Rescue!Pass2026",
                "avatar": self._png(),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        user = User.objects.get(email="hira@example.com")
        self.assertEqual((user.first_name, user.last_name), ("Hira", "Malik Qureshi"))
        self.assertEqual(user.username, "hira")
        self.assertTrue(user.avatar.name.startswith("avatars/"))
        self.assertEqual(user.role, "public")
        user.avatar.delete(save=False)

    def test_generated_username_stays_unique(self):
        User.objects.create_user(email="other@example.com", username="hira", password="x")

        response = self.client.post(
            "/auth/users/",
            {"full_name": "Hira", "email": "hira@example.com", "password": "Rescue!Pass2026", "re_password": "Rescue!Pass2026"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(User.objects.get(email="hira@example.com").username, "hira1")

    def test_web_sign_up_with_username_still_works(self):
        response = self.client.post(
            "/auth/users/",
            {"username": "webuser", "email": "web@example.com", "password": "Rescue!Pass2026", "re_password": "Rescue!Pass2026"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertTrue(User.objects.filter(username="webuser").exists())

    def test_duplicate_email_is_rejected_in_any_case(self):
        User.objects.create_user(email="hira@example.com", username="hira", password="x")

        response = self.client.post(
            "/auth/users/",
            {"full_name": "Hira", "email": "HIRA@example.com", "password": "Rescue!Pass2026", "re_password": "Rescue!Pass2026"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["email"], ["An account with this email already exists."])

    def test_mismatched_and_weak_passwords_are_rejected(self):
        mismatch = self.client.post(
            "/auth/users/",
            {"full_name": "Hira", "email": "a@example.com", "password": "Rescue!Pass2026", "re_password": "Other!Pass2026"},
            format="json",
        )
        weak = self.client.post(
            "/auth/users/",
            {"full_name": "Hira", "email": "b@example.com", "password": "12345678", "re_password": "12345678"},
            format="json",
        )

        self.assertEqual(mismatch.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(weak.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", weak.data)
        self.assertFalse(User.objects.filter(email__in=["a@example.com", "b@example.com"]).exists())

    def test_me_includes_avatar_url(self):
        user = User.objects.create_user(email="p@example.com", username="p", password="x", avatar=self._png())
        self.client.force_authenticate(user=user)

        response = self.client.get("/auth/me/")

        self.assertTrue(response.data["avatar"].startswith("http://testserver/media/avatars/"))
        user.avatar.delete(save=False)



class TokenLifetimeTests(APITestCase):
    def test_access_token_lasts_an_hour_and_can_be_refreshed(self):
        from rest_framework_simplejwt.tokens import AccessToken

        User.objects.create_user(email="p@example.com", username="p", password="secret123")
        tokens = self.client.post("/auth/jwt/create/", {"email": "p@example.com", "password": "secret123"}, format="json").data

        access = AccessToken(tokens["access"])
        self.assertEqual(access["exp"] - access["iat"], 3600)

        refreshed = self.client.post("/auth/jwt/refresh/", {"refresh": tokens["refresh"]}, format="json")
        self.assertEqual(refreshed.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refreshed.data['access']}")
        self.assertEqual(self.client.get("/auth/me/").status_code, status.HTTP_200_OK)
