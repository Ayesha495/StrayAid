import shutil
import tempfile

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from organizations.models import Organization

from .models import Case, Report


User = get_user_model()


def make_test_image():
    return SimpleUploadedFile("report.jpg", b"filecontent", content_type="image/jpeg")


class MediaEnabledAPITestCase(APITestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._temp_media = tempfile.mkdtemp()
        cls._override = override_settings(MEDIA_ROOT=cls._temp_media)
        cls._override.enable()

    @classmethod
    def tearDownClass(cls):
        cls._override.disable()
        shutil.rmtree(cls._temp_media, ignore_errors=True)
        super().tearDownClass()


class RescueApiTests(MediaEnabledAPITestCase):
    def setUp(self):
        self.public_user = User.objects.create_user(
            email="public@example.com",
            username="publicuser",
            password="secret123",
            role="public",
        )
        self.organization_user = User.objects.create_user(
            email="org@example.com",
            username="orguser",
            password="secret123",
            role="organization",
        )
        self.organization = Organization.objects.create(
            user=self.organization_user,
            name="Safe Paws",
            email=self.organization_user.email,
            latitude=31.5,
            longitude=74.3,
        )
        self.case = Case.objects.create(
            description="Need help",
            latitude=31.51,
            longitude=74.31,
            reported_by=self.public_user,
        )

    def test_report_case_creates_new_case_and_report(self):
        self.client.force_authenticate(user=self.public_user)

        response = self.client.post(
            "/api/cases/report/",
            {
                "description": "Dog is injured",
                "latitude": "31.5200",
                "longitude": "74.3200",
                "image": make_test_image(),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Case.objects.count(), 2)
        self.assertEqual(Report.objects.count(), 1)

    def test_report_case_requires_image(self):
        self.client.force_authenticate(user=self.public_user)

        response = self.client.post(
            "/api/cases/report/",
            {
                "description": "Dog is injured",
                "latitude": "31.5200",
                "longitude": "74.3200",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "Image is required")

    def test_organization_can_accept_unassigned_case(self):
        self.client.force_authenticate(user=self.organization_user)

        response = self.client.post(f"/api/cases/{self.case.id}/accept/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.case.refresh_from_db()
        self.assertEqual(self.case.organization, self.organization)
        self.assertEqual(self.case.status, "assigned")

    def test_invalid_case_status_update_is_rejected(self):
        self.case.organization = self.organization
        self.case.assigned_to = self.organization_user
        self.case.save(update_fields=["organization", "assigned_to", "updated_at"])
        self.client.force_authenticate(user=self.organization_user)

        response = self.client.patch(
            f"/api/cases/{self.case.id}/update-status/",
            {"status": "not-a-real-status"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "Invalid status.")
