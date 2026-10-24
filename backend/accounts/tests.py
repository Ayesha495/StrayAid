import re
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from unittest.mock import MagicMock, patch

from organizations.models import Organization
from rescue.tests import MediaEnabledAPITestCase


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
                "accept_terms": True,
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
            {"full_name": "Hira", "email": "hira@example.com", "password": "Rescue!Pass2026", "re_password": "Rescue!Pass2026", "accept_terms": True},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(User.objects.get(email="hira@example.com").username, "hira1")

    def test_web_sign_up_with_username_still_works(self):
        response = self.client.post(
            "/auth/users/",
            {"username": "webuser", "email": "web@example.com", "password": "Rescue!Pass2026", "re_password": "Rescue!Pass2026", "accept_terms": True},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertTrue(User.objects.filter(username="webuser").exists())

    def test_duplicate_email_is_rejected_in_any_case(self):
        User.objects.create_user(email="hira@example.com", username="hira", password="x")

        response = self.client.post(
            "/auth/users/",
            {"full_name": "Hira", "email": "HIRA@example.com", "password": "Rescue!Pass2026", "re_password": "Rescue!Pass2026", "accept_terms": True},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["email"], ["An account with this email already exists."])

    def test_mismatched_and_weak_passwords_are_rejected(self):
        mismatch = self.client.post(
            "/auth/users/",
            {"full_name": "Hira", "email": "a@example.com", "password": "Rescue!Pass2026", "re_password": "Other!Pass2026", "accept_terms": True},
            format="json",
        )
        weak = self.client.post(
            "/auth/users/",
            {"full_name": "Hira", "email": "b@example.com", "password": "12345678", "re_password": "12345678", "accept_terms": True},
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


class ProfileAndActivityTests(APITestCase):
    """Profile, impact and Activity (Stitch 24 and the profile screen)."""

    def setUp(self):
        from animals.models import AdoptionApplication, Animal, Sponsorship
        from rescue.models import Case, Report

        org_user = User.objects.create_user(email="o@example.com", username="o", password="x", role="organization")
        organization = Organization.objects.create(user=org_user, name="Paws & Care Rescue")
        self.user = User.objects.create_user(email="u@example.com", username="u", password="x", first_name="Sara")
        for status_name in ["rescued", "assigned"]:
            case = Case.objects.create(description="Dog", latitude=33.7, longitude=73.0, reported_by=self.user,
                                       status=status_name, species="dog", area="G-11", confidence_score=90, organization=organization)
            Report.objects.create(case=case, user=self.user, image="reports/x.jpg", description="d", latitude=33.7, longitude=73.0)
        other = Case.objects.create(description="Cat", latitude=33.7, longitude=73.0, reported_by=org_user)
        luna = Animal.objects.create(case=other, organization=organization, name="Luna", species="Cat", status="adoptable")
        AdoptionApplication.objects.create(animal=luna, applicant=self.user, full_name="Sara", phone="03001234567",
                                           home_type="house", status="approved")
        Sponsorship.objects.create(animal=luna, sponsor=self.user, amount_pkr=1500, monthly=True, status="confirmed")
        self.client.force_authenticate(user=self.user)

    def test_impact_points_level_and_badges(self):
        data = self.client.get("/auth/me/impact/").data
        self.assertEqual((data["reports"], data["rescued"], data["active_cases"], data["pledged_pkr"], data["adoptions"]), (2, 1, 1, 1500, 1))
        # 2 reports x 20 + 1 rescued x 30 + 15 for PKR 1,500 + 100 for the adoption.
        self.assertEqual(data["points"], 185)
        self.assertEqual((data["level"]["number"], data["level"]["name"], data["level"]["next_name"]), (2, "Hero", "Guardian"))
        self.assertEqual(data["accuracy"], 100)
        earned = {badge["key"] for badge in data["badges"] if badge["earned"]}
        self.assertTrue({"first_responder", "forever_friend", "kind_heart", "monthly_guardian"} <= earned)
        self.assertNotIn("eagle_eye", earned)

    def test_activity_timeline_and_filters(self):
        data = self.client.get("/auth/me/activity/").data
        self.assertEqual(data["counts"], {"reports": 2, "followed": 0, "applications": 1, "sponsorships": 1, "saved": 0, "all": 4})
        self.assertEqual({item["kind"] for item in data["items"]}, {"report", "application", "sponsorship"})
        pledge = next(item for item in data["items"] if item["kind"] == "sponsorship")
        self.assertEqual((pledge["title"], pledge["status"]["label"]), ("Monthly sponsorship", "Active donor"))
        self.assertIn("Renews in", pledge["extra"])

    def test_profile_edits_and_alert_rules(self):
        response = self.client.patch("/auth/me/profile/", {"area": "G-11, Islamabad", "phone": "+92 300 1234567"}, format="json")
        self.assertEqual((response.data["area"], response.data["phone_masked"]), ("G-11, Islamabad", "+92 300••••567"))
        self.assertEqual(self.client.patch("/auth/me/profile/", {"radius_alerts": True}, format="json").status_code, 400)
        on = self.client.patch("/auth/me/profile/", {"radius_alerts": True, "alert_latitude": 33.68, "alert_longitude": 73.0}, format="json")
        self.assertTrue(on.data["radius_alerts"])
        self.assertEqual(self.client.patch("/auth/me/profile/", {"phone": "12"}, format="json").status_code, 400)

    def test_radius_alerts_reach_people_nearby(self):
        from unittest.mock import patch as mock_patch

        from notifications.models import Notification
        from rescue.models import Case
        from rescue.views import alert_nearby_organizations

        near = User.objects.create_user(email="n@example.com", username="n", password="x", radius_alerts=True,
                                        alert_latitude=33.701, alert_longitude=73.001)
        far = User.objects.create_user(email="f@example.com", username="f", password="x", radius_alerts=True,
                                       alert_latitude=31.5, alert_longitude=74.3)
        case = Case.objects.create(description="Hit by car", latitude=33.7, longitude=73.0, reported_by=self.user,
                                   severity="critical", area="G-11, Islamabad")
        with mock_patch("notifications.services.send_push_notifications"):
            alert_nearby_organizations(case)
        alerted = set(Notification.objects.filter(kind="alert").values_list("user_id", flat=True))
        self.assertIn(near.id, alerted)
        self.assertNotIn(far.id, alerted)
        self.assertNotIn(self.user.id, alerted)


class TermsConsentTests(APITestCase):
    SIGN_UP = {"full_name": "Hira", "email": "hira@example.com", "password": "Rescue!Pass2026", "re_password": "Rescue!Pass2026"}

    def test_sign_up_needs_the_terms_to_be_accepted(self):
        for answer in (None, False, "false"):
            data = dict(self.SIGN_UP) if answer is None else {**self.SIGN_UP, "accept_terms": answer}
            response = self.client.post("/auth/users/", data, format="json")
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn("accept_terms", response.data)
        self.assertFalse(User.objects.filter(email="hira@example.com").exists())

    def test_the_time_of_acceptance_is_recorded(self):
        from django.utils import timezone

        before = timezone.now()
        response = self.client.post("/auth/users/", {**self.SIGN_UP, "accept_terms": True}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        accepted_at = User.objects.get(email="hira@example.com").accepted_terms_at
        self.assertIsNotNone(accepted_at)
        self.assertGreaterEqual(accepted_at, before)

    def test_sign_up_reply_does_not_leak_the_password(self):
        response = self.client.post("/auth/users/", {**self.SIGN_UP, "accept_terms": True}, format="json")
        self.assertNotIn("password", response.data)
        self.assertNotIn("re_password", response.data)
        self.assertNotIn("accept_terms", response.data)

    @patch("accounts.views._verify_google_id_token")
    def test_new_google_accounts_record_acceptance(self, mock_verify):
        mock_verify.return_value = {"email": "g@example.com", "email_verified": True}
        self.client.post("/auth/google/", {"id_token": "t", "accept_terms": True}, format="json")
        self.assertIsNotNone(User.objects.get(email="g@example.com").accepted_terms_at)


class GoogleAccessTokenTests(APITestCase):
    """Mobile signs in with a Google access token. The token must have been issued to one
    of StrayAid's own client apps, or a token from any other app could be replayed here."""

    def _google_replies(self, token_info, user_info=None):
        def fake_get(url, **kwargs):
            response = MagicMock()
            response.raise_for_status.return_value = None
            response.json.return_value = token_info if "tokeninfo" in url else (user_info or {})
            return response

        return patch("accounts.views.requests.get", side_effect=fake_get)

    def test_token_for_our_app_signs_in(self):
        from django.conf import settings

        token_info = {"aud": settings.GOOGLE_OAUTH_CLIENT_IDS[0], "email": "m@example.com", "email_verified": "true"}
        with self._google_replies(token_info, {"email": "m@example.com", "given_name": "Mona", "family_name": "Ali"}):
            response = self.client.post("/auth/google/", {"access_token": "ya29.token"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual((response.data["user"]["first_name"], response.data["user"]["last_name"]), ("Mona", "Ali"))

    def test_token_issued_to_another_app_is_refused(self):
        token_info = {"aud": "another-app.apps.googleusercontent.com", "email": "m@example.com", "email_verified": "true"}
        with self._google_replies(token_info):
            response = self.client.post("/auth/google/", {"access_token": "ya29.token"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email="m@example.com").exists())

    def test_unverified_email_in_token_info_is_refused(self):
        from django.conf import settings

        token_info = {"aud": settings.GOOGLE_OAUTH_CLIENT_IDS[0], "email": "m@example.com", "email_verified": "false"}
        with self._google_replies(token_info):
            response = self.client.post("/auth/google/", {"access_token": "ya29.token"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_google_being_unreachable_is_a_clean_error(self):
        with patch("accounts.views.requests.get", side_effect=OSError("offline")):
            response = self.client.post("/auth/google/", {"access_token": "ya29.token"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "Google token verification failed.")

    @patch("accounts.views.google_id_token.verify_oauth2_token")
    def test_id_token_for_another_app_is_refused(self, mock_verify):
        mock_verify.return_value = {"aud": "another-app", "email": "x@example.com", "email_verified": True}
        response = self.client.post("/auth/google/", {"id_token": "t"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("accounts.views._verify_google_id_token")
    def test_returning_google_user_gets_names_refreshed(self, mock_verify):
        User.objects.create_user(email="g@example.com", username="g", password="x", first_name="Old")
        mock_verify.return_value = {"email": "G@example.com", "email_verified": True, "given_name": "New", "family_name": "Name"}
        response = self.client.post("/auth/google/", {"id_token": "t"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(User.objects.filter(email__iexact="g@example.com").count(), 1)
        self.assertEqual(User.objects.get(email="g@example.com").first_name, "New")

    @patch("accounts.views._verify_google_id_token")
    def test_deactivated_accounts_cannot_sign_in_through_google(self, mock_verify):
        User.objects.create_user(email="g@example.com", username="g", password="x", is_active=False)
        mock_verify.return_value = {"email": "g@example.com", "email_verified": True}
        response = self.client.post("/auth/google/", {"id_token": "t"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class LoginBackendTests(APITestCase):
    def test_username_that_looks_like_another_email_does_not_crash(self):
        User.objects.create_user(email="a@example.com", username="a", password="Pass!2026a")
        User.objects.create_user(email="b@example.com", username="a@example.com", password="Pass!2026b")
        response = self.client.post("/auth/jwt/create/", {"email": "a@example.com", "password": "Pass!2026a"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_backend_accepts_email_or_username_in_any_case(self):
        from django.contrib.auth import authenticate

        user = User.objects.create_user(email="a@example.com", username="Asma", password="Pass!2026a")
        self.assertEqual(authenticate(username="A@Example.com", password="Pass!2026a"), user)
        self.assertEqual(authenticate(username="asma", password="Pass!2026a"), user)
        self.assertIsNone(authenticate(username="asma", password="wrong"))
        self.assertIsNone(authenticate(username=None, password="Pass!2026a"))
        self.assertIsNone(authenticate(username="nobody", password="Pass!2026a"))

    def test_inactive_accounts_cannot_sign_in(self):
        User.objects.create_user(email="a@example.com", username="a", password="Pass!2026a", is_active=False)
        response = self.client.post("/auth/jwt/create/", {"email": "a@example.com", "password": "Pass!2026a"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_empty_login_is_refused(self):
        response = self.client.post("/auth/jwt/create/", {"email": "  ", "password": "x"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertNotIn("access", response.data)


class DeleteAccountTests(MediaEnabledAPITestCase):
    """Settings, Delete account: personal details go, the rescue history stays."""

    def setUp(self):
        super().setUp()
        from animals.models import AdoptionApplication, Animal, Sponsorship
        from notifications.models import AnimalFollow, PushToken
        from posts.models import Post, PostComment
        from rescue.models import Case, Report

        org_user = User.objects.create_user(email="o@example.com", username="o", password="x", role="organization")
        self.organization = Organization.objects.create(user=org_user, name="Paws & Care Rescue")
        self.user = User.objects.create_user(
            email="sara@example.com", username="sara", password="Pass!2026s", first_name="Sara", last_name="Khan",
            phone="03001234567", area="G-11", radius_alerts=True, alert_latitude=33.7, alert_longitude=73.0,
        )
        self.case = Case.objects.create(description="Dog", latitude=33.7, longitude=73.0, reported_by=self.user)
        Report.objects.create(case=self.case, user=self.user, image="reports/x.jpg", description="d", latitude=33.7, longitude=73.0)
        animal = Animal.objects.create(case=self.case, organization=self.organization, name="Luna")
        self.application = AdoptionApplication.objects.create(
            animal=animal, applicant=self.user, full_name="Sara Khan", phone="03001234567", home_type="house", city="Islamabad",
        )
        Sponsorship.objects.create(animal=animal, sponsor=self.user, amount_pkr=1000, status="confirmed")
        post = Post.objects.create(animal=animal, organization=self.organization, title="Luna", content="Safe")
        PostComment.objects.create(post=post, user=self.user, body="Get well soon")
        AnimalFollow.objects.get_or_create(user=self.user, animal=animal)
        PushToken.objects.create(user=self.user, token="ExponentPushToken[abc]")
        self.client.force_authenticate(user=self.user)

    def _delete(self, **data):
        return self.client.delete("/auth/me/", {"confirm": "DELETE", **data}, format="json")

    def test_needs_the_confirmation_word(self):
        response = self.client.delete("/auth/me/", {"confirm": "yes", "password": "Pass!2026s"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_active)

    def test_wrong_password_is_refused(self):
        response = self._delete(password="wrong")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_active)

    def test_personal_details_are_removed(self):
        response = self._delete(password="Pass!2026s")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)
        self.assertFalse(self.user.has_usable_password())
        self.assertNotIn("sara", self.user.email.lower())
        self.assertNotIn("sara", self.user.username.lower())
        self.assertEqual((self.user.first_name, self.user.last_name), ("Deleted", "user"))
        self.assertEqual((self.user.phone, self.user.area), ("", ""))
        self.assertFalse(self.user.radius_alerts)
        self.assertIsNone(self.user.alert_latitude)

    def test_rescue_history_is_kept_without_the_name(self):
        from animals.models import Sponsorship
        from rescue.models import Report

        self._delete(password="Pass!2026s")
        self.assertEqual(Report.objects.filter(case=self.case).count(), 1)
        self.assertEqual(Sponsorship.objects.count(), 1)
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, "withdrawn")
        self.assertEqual((self.application.full_name, self.application.phone, self.application.city), ("Deleted user", "", ""))

    def test_follows_and_push_tokens_are_cleared(self):
        from notifications.models import AnimalFollow, PushToken

        self._delete(password="Pass!2026s")
        self.assertFalse(PushToken.objects.filter(user=self.user).exists())
        self.assertFalse(AnimalFollow.objects.filter(user=self.user).exists())

    def test_the_account_can_no_longer_sign_in(self):
        self._delete(password="Pass!2026s")
        self.client.force_authenticate(user=None)
        response = self.client.post("/auth/jwt/create/", {"email": "sara@example.com", "password": "Pass!2026s"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_the_email_can_be_used_for_a_new_account(self):
        self._delete(password="Pass!2026s")
        self.client.force_authenticate(user=None)
        response = self.client.post(
            "/auth/users/",
            {"full_name": "Sara", "email": "sara@example.com", "password": "Rescue!Pass2026", "re_password": "Rescue!Pass2026", "accept_terms": True},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    def test_google_accounts_can_delete_with_the_confirmation_word_alone(self):
        self.user.set_unusable_password()
        self.user.save()
        self.assertEqual(self._delete().status_code, status.HTTP_204_NO_CONTENT)

    def test_password_accounts_must_give_their_password(self):
        self.assertEqual(self._delete().status_code, status.HTTP_400_BAD_REQUEST)

    def test_organization_accounts_are_hidden_from_the_public(self):
        self.client.force_authenticate(user=self.organization.user)
        response = self.client.delete("/auth/me/", {"confirm": "DELETE", "password": "x"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.organization.refresh_from_db()
        self.assertFalse(self.organization.is_available)

    def test_needs_an_account(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self._delete().status_code, status.HTTP_401_UNAUTHORIZED)
