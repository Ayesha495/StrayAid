import shutil
import tempfile

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from animals.models import Animal
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
            radius=5,
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

    def test_report_case_saves_area_on_new_case(self):
        self.client.force_authenticate(user=self.public_user)

        response = self.client.post(
            "/api/cases/report/",
            {
                "description": "Dog is injured",
                "latitude": "31.5200",
                "longitude": "74.3200",
                "area": "  F-7, Islamabad  ",
                "image": make_test_image(),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Case.objects.get(pk=response.data["case_id"]).area, "F-7, Islamabad")

    def test_nearby_report_fills_missing_area_but_keeps_existing_one(self):
        self.client.force_authenticate(user=self.public_user)
        payload = {"description": "Seen again", "latitude": "31.5100", "longitude": "74.3100"}

        self.client.post("/api/cases/report/", {**payload, "area": "G-9, Islamabad", "image": make_test_image()}, format="multipart")
        self.client.post("/api/cases/report/", {**payload, "area": "Somewhere else", "image": make_test_image()}, format="multipart")

        self.case.refresh_from_db()
        self.assertEqual(self.case.area, "G-9, Islamabad")

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

    def test_report_case_requires_latitude_and_longitude(self):
        self.client.force_authenticate(user=self.public_user)

        response = self.client.post(
            "/api/cases/report/",
            {
                "description": "Dog is injured",
                "image": make_test_image(),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "Latitude and longitude are required")

    def test_report_case_rejects_invalid_coordinates(self):
        self.client.force_authenticate(user=self.public_user)

        response = self.client.post(
            "/api/cases/report/",
            {
                "description": "Dog is injured",
                "latitude": "abc",
                "longitude": "74.3200",
                "image": make_test_image(),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "Invalid latitude or longitude format")

    def test_report_case_attaches_report_to_nearby_existing_case(self):
        self.client.force_authenticate(user=self.public_user)

        response = self.client.post(
            "/api/cases/report/",
            {
                "description": "Another sighting nearby",
                "latitude": "31.5100",
                "longitude": "74.3100",
                "image": make_test_image(),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["message"], "Report attached to existing case")
        self.assertEqual(response.data["case_id"], self.case.id)
        self.assertEqual(Case.objects.count(), 1)
        self.assertEqual(Report.objects.count(), 1)

    def test_report_case_creates_new_case_when_report_is_outside_15_feet(self):
        self.client.force_authenticate(user=self.public_user)

        response = self.client.post(
            "/api/cases/report/",
            {
                "description": "Another sighting but outside duplicate range",
                "latitude": "31.5101",
                "longitude": "74.3100",
                "image": make_test_image(),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["message"], "New case created and report added")
        self.assertEqual(Case.objects.count(), 2)
        self.assertEqual(Report.objects.count(), 1)

    def test_user_can_view_own_reported_cases(self):
        self.client.force_authenticate(user=self.public_user)
        self.client.post(
            "/api/cases/report/",
            {
                "description": "Dog is injured",
                "latitude": "31.5200",
                "longitude": "74.3200",
                "image": make_test_image(),
            },
            format="multipart",
        )

        response = self.client.get("/api/cases/my-reports/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["reported_by"], self.public_user.id)

    def test_public_user_cannot_access_organization_case_endpoints(self):
        self.client.force_authenticate(user=self.public_user)

        response = self.client.get("/api/cases/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_organization_case_list_shows_unassigned_and_own_cases_only(self):
        other_org_user = User.objects.create_user(
            email="otherorg@example.com",
            username="otherorg",
            password="secret123",
            role="organization",
        )
        other_organization = Organization.objects.create(
            user=other_org_user,
            name="Second Chance",
            email=other_org_user.email,
            latitude=31.7,
            longitude=74.5,
        )
        own_case = Case.objects.create(
            description="Own case",
            latitude=31.52,
            longitude=74.32,
            reported_by=self.public_user,
            organization=self.organization,
            assigned_to=self.organization_user,
            status="assigned",
        )
        foreign_case = Case.objects.create(
            description="Foreign case",
            latitude=31.53,
            longitude=74.33,
            reported_by=self.public_user,
            organization=other_organization,
            assigned_to=other_org_user,
            status="assigned",
        )
        self.client.force_authenticate(user=self.organization_user)

        response = self.client.get("/api/cases/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = {item["id"] for item in response.data}
        self.assertIn(self.case.id, returned_ids)
        self.assertIn(own_case.id, returned_ids)
        self.assertNotIn(foreign_case.id, returned_ids)

    def test_case_list_hides_unassigned_cases_outside_organization_radius(self):
        far_unassigned = Case.objects.create(
            description="Far open case",
            latitude=32.5,
            longitude=75.3,
            reported_by=self.public_user,
            status="reported",
        )
        self.client.force_authenticate(user=self.organization_user)

        response = self.client.get("/api/cases/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = {item["id"] for item in response.data}
        self.assertIn(self.case.id, returned_ids)
        self.assertNotIn(far_unassigned.id, returned_ids)

    def test_nearby_cases_filters_by_radius_and_excludes_closed_cases(self):
        near_case = Case.objects.create(
            description="Near open case",
            latitude=31.5001,
            longitude=74.3001,
            reported_by=self.public_user,
            status="reported",
        )
        far_case = Case.objects.create(
            description="Far case",
            latitude=32.5,
            longitude=75.3,
            reported_by=self.public_user,
            status="reported",
        )
        Case.objects.create(
            description="Closed case",
            latitude=31.5002,
            longitude=74.3002,
            reported_by=self.public_user,
            status="closed",
        )
        self.client.force_authenticate(user=self.organization_user)

        response = self.client.get("/api/cases/nearby/?radius_km=5")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = {item["id"] for item in response.data}
        self.assertIn(self.case.id, returned_ids)
        self.assertIn(near_case.id, returned_ids)
        self.assertNotIn(far_case.id, returned_ids)
        self.assertEqual(len(returned_ids), 2)

    def test_my_cases_returns_only_cases_assigned_to_current_organization(self):
        Case.objects.create(
            description="Assigned case",
            latitude=31.52,
            longitude=74.32,
            reported_by=self.public_user,
            organization=self.organization,
            assigned_to=self.organization_user,
            status="assigned",
        )
        self.client.force_authenticate(user=self.organization_user)

        response = self.client.get("/api/cases/my-cases/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["organization"]["id"], self.organization.id)

    def test_organization_can_accept_unassigned_case(self):
        self.client.force_authenticate(user=self.organization_user)

        response = self.client.post(f"/api/cases/{self.case.id}/accept/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.case.refresh_from_db()
        self.assertEqual(self.case.organization, self.organization)
        self.assertEqual(self.case.status, "assigned")

    def test_organization_cannot_accept_case_outside_service_radius(self):
        self.case.latitude = 32.5
        self.case.longitude = 75.3
        self.case.save(update_fields=["latitude", "longitude", "updated_at"])
        self.client.force_authenticate(user=self.organization_user)

        response = self.client.post(f"/api/cases/{self.case.id}/accept/")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "This case is outside your service radius.")

    def test_organization_cannot_accept_case_when_animal_capacity_is_full(self):
        self.organization.capacity = 1
        self.organization.save(update_fields=["capacity"])
        assigned_case = Case.objects.create(
            description="Assigned case",
            latitude=31.5001,
            longitude=74.3001,
            reported_by=self.public_user,
            organization=self.organization,
            assigned_to=self.organization_user,
            status="rescued",
        )
        Animal.objects.create(case=assigned_case, organization=self.organization, name="Milo")
        self.client.force_authenticate(user=self.organization_user)

        response = self.client.post(f"/api/cases/{self.case.id}/accept/")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "Organization animal capacity has been reached.")

    def test_organization_cannot_accept_case_assigned_to_another_organization(self):
        other_org_user = User.objects.create_user(
            email="otherorg@example.com",
            username="otherorg",
            password="secret123",
            role="organization",
        )
        other_organization = Organization.objects.create(
            user=other_org_user,
            name="Second Chance",
            email=other_org_user.email,
        )
        self.case.organization = other_organization
        self.case.assigned_to = other_org_user
        self.case.status = "assigned"
        self.case.save(update_fields=["organization", "assigned_to", "status", "updated_at"])
        self.client.force_authenticate(user=self.organization_user)

        response = self.client.post(f"/api/cases/{self.case.id}/accept/")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "This case is already assigned.")

    def test_organization_can_update_own_case_status(self):
        self.case.organization = self.organization
        self.case.assigned_to = self.organization_user
        self.case.status = "assigned"
        self.case.save(update_fields=["organization", "assigned_to", "status", "updated_at"])
        self.client.force_authenticate(user=self.organization_user)

        response = self.client.patch(
            f"/api/cases/{self.case.id}/update-status/",
            {"status": "in_progress"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.case.refresh_from_db()
        self.assertEqual(self.case.status, "in_progress")

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

    def test_organization_cannot_update_another_organizations_case(self):
        other_org_user = User.objects.create_user(
            email="otherorg@example.com",
            username="otherorg",
            password="secret123",
            role="organization",
        )
        other_organization = Organization.objects.create(
            user=other_org_user,
            name="Second Chance",
            email=other_org_user.email,
        )
        self.case.organization = other_organization
        self.case.assigned_to = other_org_user
        self.case.status = "assigned"
        self.case.save(update_fields=["organization", "assigned_to", "status", "updated_at"])
        self.client.force_authenticate(user=self.organization_user)

        response = self.client.patch(
            f"/api/cases/{self.case.id}/update-status/",
            {"status": "rescued"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_resolved_timestamp_is_set_when_case_is_rescued(self):
        self.case.organization = self.organization
        self.case.assigned_to = self.organization_user
        self.case.status = "assigned"
        self.case.save(update_fields=["organization", "assigned_to", "status", "updated_at"])
        self.client.force_authenticate(user=self.organization_user)

        response = self.client.patch(
            f"/api/cases/{self.case.id}/update-status/",
            {"status": "rescued"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.case.refresh_from_db()
        self.assertEqual(self.case.status, "rescued")
        self.assertIsNotNone(self.case.resolved_at)


class PublicHomeEndpointTests(MediaEnabledAPITestCase):
    """Trending cases and community stats are readable without logging in."""

    def setUp(self):
        self.reporter = User.objects.create_user(
            email="public@example.com", username="public", password="secret123"
        )

        def make_case(title, severity, score, status_value="reported"):
            case = Case.objects.create(
                description=title,
                title=title,
                severity=severity,
                confidence_score=score,
                status=status_value,
                latitude=33.68,
                longitude=73.04,
                reported_by=self.reporter,
            )
            Report.objects.create(
                case=case,
                user=self.reporter,
                image=make_test_image(),
                description=title,
                latitude=33.68,
                longitude=73.04,
            )
            return case

        self.medium = make_case("Abandoned Cat — F-8", "medium", 78)
        self.high_low_score = make_case("Hurt Puppy — I-8", "high", 40)
        self.high = make_case("Injured Dog — G-11", "high", 93, "assigned")
        self.closed = make_case("Old case", "critical", 99, "closed")
        self.rescued = make_case("Rescued already", "critical", 99, "rescued")

    def test_trending_is_public_and_sorted_by_urgency(self):
        response = self.client.get("/api/cases/trending/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = [item["title"] for item in response.data]
        self.assertEqual(titles, ["Injured Dog — G-11", "Hurt Puppy — I-8", "Abandoned Cat — F-8"])
        first = response.data[0]
        self.assertEqual(first["status_label"], "Responder Assigned")
        self.assertEqual(first["report_count"], 1)
        self.assertTrue(first["image"].startswith("http://testserver/media/"))
        self.assertNotIn("reported_by", first)

    def test_trending_respects_limit(self):
        response = self.client.get("/api/cases/trending/?limit=1")

        self.assertEqual(len(response.data), 1)

    def test_trending_title_falls_back_to_species_and_area(self):
        self.high.title = ""
        self.high.species = "dog"
        self.high.area = "G-11"
        self.high.save()

        response = self.client.get("/api/cases/trending/")

        self.assertEqual(response.data[0]["title"], "Dog — G-11")

    def test_stats_count_rescued_animals(self):
        Animal.objects.create(case=self.rescued, name="Max")

        response = self.client.get("/api/cases/stats/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {"rescued_total": 1, "rescued_today": 1})


class ConfidenceScoreTests(APITestCase):
    def test_formula_matches_spec(self):
        from .utils.scoring import compute_confidence_score

        # 0.5*0.97 + 0.3*0.75 + 0.2*1.0 = 0.91
        self.assertEqual(compute_confidence_score(0.97, "high", 3), 91)
        # 0.5*0.9 + 0.3*0.5 + 0.2*0.33 = 0.666
        self.assertEqual(compute_confidence_score(0.9, "medium", 1), 67)
        self.assertEqual(compute_confidence_score(1.0, "critical", 5), 100)
        self.assertEqual(compute_confidence_score(None, "low", 0), 8)

    def test_low_detector_confidence_is_flagged(self):
        from .utils.scoring import is_possibly_invalid

        self.assertTrue(is_possibly_invalid(0.12))
        self.assertFalse(is_possibly_invalid(0.3))
