import shutil
import tempfile
import unittest
from pathlib import Path

from django.conf import settings
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


FAKE_DOG = {"confidence": 0.9, "label": "dog", "box": [0.1, 0.1, 0.9, 0.9]}


class MediaEnabledAPITestCase(APITestCase):
    # Test photos are placeholder bytes, so the animal detector is replaced by one that
    # always sees a dog. Classes that test the real model set this to True.
    real_detector = False

    @classmethod
    def setUpClass(cls):
        from unittest.mock import patch

        super().setUpClass()
        cls._temp_media = tempfile.mkdtemp()
        cls._override = override_settings(MEDIA_ROOT=cls._temp_media)
        cls._override.enable()
        cls._detector = None
        if not cls.real_detector:
            cls._detector = patch("rescue.ai.detector.detect_animal", return_value=dict(FAKE_DOG))
            cls._detector.start()

    @classmethod
    def tearDownClass(cls):
        if cls._detector:
            cls._detector.stop()
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

    def test_report_sets_severity_and_keep_updated(self):
        self.client.force_authenticate(user=self.public_user)

        response = self.client.post(
            "/api/cases/report/",
            {
                "description": "Hit by a car",
                "latitude": "31.5200",
                "longitude": "74.3200",
                "severity": "Critical",
                "keep_updated": "false",
                "image": make_test_image(),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        report = Report.objects.get(pk=response.data["report_id"])
        self.assertEqual((report.severity, report.notify_reporter), ("critical", False))
        self.assertEqual(report.case.severity, "critical")

    def test_report_defaults_to_medium_and_updates_on(self):
        self.client.force_authenticate(user=self.public_user)

        response = self.client.post(
            "/api/cases/report/",
            {"description": "Stray", "latitude": "31.5200", "longitude": "74.3200", "image": make_test_image()},
            format="multipart",
        )

        report = Report.objects.get(pk=response.data["report_id"])
        self.assertEqual((report.severity, report.notify_reporter), ("medium", True))

    def test_report_rejects_unknown_severity(self):
        self.client.force_authenticate(user=self.public_user)

        response = self.client.post(
            "/api/cases/report/",
            {"description": "x", "latitude": "31.52", "longitude": "74.32", "severity": "urgent", "image": make_test_image()},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Report.objects.count(), 0)

    def test_nearby_report_raises_case_severity_but_never_lowers_it(self):
        self.client.force_authenticate(user=self.public_user)
        payload = {"description": "Seen again", "latitude": "31.5100", "longitude": "74.3100"}

        self.client.post("/api/cases/report/", {**payload, "severity": "high", "image": make_test_image()}, format="multipart")
        self.case.refresh_from_db()
        self.assertEqual(self.case.severity, "high")

        self.client.post("/api/cases/report/", {**payload, "severity": "low", "image": make_test_image()}, format="multipart")
        self.case.refresh_from_db()
        self.assertEqual(self.case.severity, "high")

    def test_status_updates_skip_reporters_who_opted_out(self):
        from unittest.mock import patch

        other = User.objects.create_user(email="other@example.com", username="other", password="x")
        Report.objects.create(case=self.case, user=self.public_user, image=make_test_image(), description="a",
                              latitude=31.51, longitude=74.31, notify_reporter=False)
        Report.objects.create(case=self.case, user=other, image=make_test_image(), description="b",
                              latitude=31.51, longitude=74.31, notify_reporter=True)

        with patch("notifications.services.notify_users") as notify_users:
            self.case.status = "assigned"
            self.case.save()

        notified = set(notify_users.call_args.args[0])
        self.assertEqual(notified, {other.id})

    def test_report_response_has_case_summary(self):
        self.client.force_authenticate(user=self.public_user)

        response = self.client.post(
            "/api/cases/report/",
            {"description": "Dog", "latitude": "31.5200", "longitude": "74.3200", "area": "G-11, Islamabad",
             "severity": "high", "image": make_test_image()},
            format="multipart",
        )

        case = Case.objects.get(pk=response.data["case_id"])
        self.assertEqual(response.data["case"], {
            "id": case.id,
            "reference": f"SA-{case.created_at.year}-{case.id:04d}",
            "area": "G-11, Islamabad",
            "severity": "high",
            "confidence_score": 74,  # stand-in detector: dog 0.9, high severity, 1 report
            "status": "reported",
        })
        self.assertTrue(response.data["keep_updated"])

    def test_keep_me_updated_turns_updates_on_for_own_report_only(self):
        report = Report.objects.create(case=self.case, user=self.public_user, image=make_test_image(),
                                       description="a", latitude=31.51, longitude=74.31, notify_reporter=False)
        stranger = User.objects.create_user(email="s@example.com", username="s", password="x")

        self.client.force_authenticate(user=stranger)
        self.assertEqual(self.client.post(f"/api/cases/reports/{report.id}/keep-updated/").status_code, 404)

        self.client.force_authenticate(user=self.public_user)
        response = self.client.post(f"/api/cases/reports/{report.id}/keep-updated/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        report.refresh_from_db()
        self.assertTrue(report.notify_reporter)

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


class CasePageTests(MediaEnabledAPITestCase):
    def setUp(self):
        self.reporter = User.objects.create_user(email="r@example.com", username="r", password="x", first_name="Hira")
        self.viewer = User.objects.create_user(email="v@example.com", username="v", password="x")
        org_user = User.objects.create_user(email="o@example.com", username="o", password="x", role="organization")
        self.organization = Organization.objects.create(user=org_user, name="Safe Paws", city="Islamabad",
                                                        latitude=31.5, longitude=74.3, radius=5)
        self.client.force_authenticate(user=self.reporter)
        response = self.client.post(
            "/api/cases/report/",
            {"description": "Limping dog", "latitude": "31.52", "longitude": "74.32", "area": "G-11, Islamabad",
             "severity": "high", "image": make_test_image()},
            format="multipart",
        )
        self.case = Case.objects.get(pk=response.data["case_id"])
        self.client.force_authenticate(user=None)

    def test_new_case_starts_its_history_and_status_changes_are_recorded(self):
        self.assertEqual(list(self.case.updates.values_list("status", flat=True)), ["reported"])

        self.case.organization = self.organization
        self.case.status = "assigned"
        self.case.save()

        latest = self.case.updates.first()
        self.assertEqual(latest.status, "assigned")
        self.assertIn("Safe Paws", latest.message)

    def test_guest_sees_public_case_without_reporter_identity_or_coordinates(self):
        response = self.client.get(f"/api/cases/public/{self.case.id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertEqual(data["reference"], self.case.reference)
        self.assertEqual(data["area"], "G-11, Islamabad")
        self.assertEqual(data["severity"], "high")
        self.assertEqual(data["update_count"], 1)
        self.assertTrue(data["image"].endswith(".jpg"))
        self.assertNotIn("images", data)
        self.assertFalse(data["keep_updated"])
        self.assertNotIn("latitude", data)
        self.assertNotIn("r@example.com", str(data))

    def test_reports_show_first_name_only(self):
        response = self.client.get(f"/api/cases/public/{self.case.id}/reports/")

        self.assertEqual(response.data[0]["reporter"], "Hira")
        self.assertNotIn("r@example.com", str(response.data))

    def test_reporter_switch_controls_own_report_updates(self):
        self.client.force_authenticate(user=self.reporter)

        self.client.delete(f"/api/cases/public/{self.case.id}/keep-updated/")
        self.assertFalse(self.case.reports.get().notify_reporter)
        self.assertFalse(self.client.get(f"/api/cases/public/{self.case.id}/").data["keep_updated"])

        self.client.post(f"/api/cases/public/{self.case.id}/keep-updated/")
        self.assertTrue(self.case.reports.get().notify_reporter)

    def test_other_users_follow_the_case_and_get_status_pushes(self):
        from unittest.mock import patch

        self.client.force_authenticate(user=self.viewer)
        self.client.post(f"/api/cases/public/{self.case.id}/keep-updated/")
        self.assertTrue(self.client.get(f"/api/cases/public/{self.case.id}/").data["keep_updated"])

        with patch("notifications.services.notify_users") as notify_users:
            self.case.status = "in_progress"
            self.case.save()
        self.assertIn(self.viewer.id, notify_users.call_args.args[0])

        self.client.delete(f"/api/cases/public/{self.case.id}/keep-updated/")
        self.assertFalse(self.client.get(f"/api/cases/public/{self.case.id}/").data["keep_updated"])

    def test_keep_updated_needs_an_account(self):
        response = self.client.post(f"/api/cases/public/{self.case.id}/keep-updated/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_only_the_owning_organization_posts_notes(self):
        self.case.organization = self.organization
        self.case.save()
        other_user = User.objects.create_user(email="o2@example.com", username="o2", password="x", role="organization")
        Organization.objects.create(user=other_user, name="Other", latitude=31.5, longitude=74.3, radius=5)

        self.client.force_authenticate(user=other_user)
        denied = self.client.post(f"/api/cases/{self.case.id}/add-update/", {"message": "Hi"}, format="json")
        self.client.force_authenticate(user=self.organization.user)
        posted = self.client.post(f"/api/cases/{self.case.id}/add-update/", {"message": "Vet visit done."}, format="json")

        self.assertIn(denied.status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND))
        self.assertEqual(posted.status_code, status.HTTP_201_CREATED)
        self.assertEqual(posted.data["author_name"], "Safe Paws")
        self.assertEqual(self.client.get(f"/api/cases/public/{self.case.id}/updates/").data[0]["message"], "Vet visit done.")

    def test_missing_case_is_404(self):
        self.assertEqual(self.client.get("/api/cases/public/999999/").status_code, status.HTTP_404_NOT_FOUND)


STITCH_IMAGES = settings.BASE_DIR.parent.parent / "images" / "stitch"
MODEL_PRESENT = Path(settings.AI_MODEL_PATH).exists()


def stitch_upload(name):
    return SimpleUploadedFile(name, (STITCH_IMAGES / name).read_bytes(), content_type="image/jpeg")


class MapCasesTests(MediaEnabledAPITestCase):
    def setUp(self):
        reporter = User.objects.create_user(email="m@example.com", username="m", password="x")
        self.near_high = Case.objects.create(description="a", latitude=33.6900, longitude=73.0500, severity="high", reported_by=reporter)
        self.near_low = Case.objects.create(description="b", latitude=33.6950, longitude=73.0550, severity="low", reported_by=reporter)
        self.far = Case.objects.create(description="c", latitude=31.5, longitude=74.3, severity="critical", reported_by=reporter)
        self.done = Case.objects.create(description="d", latitude=33.6901, longitude=73.0501, status="closed", reported_by=reporter)

    def test_guests_see_open_cases_most_urgent_first(self):
        ids = [item["id"] for item in self.client.get("/api/cases/map/").data]

        self.assertEqual(ids, [self.far.id, self.near_high.id, self.near_low.id])
        self.assertNotIn(self.done.id, ids)

    def test_position_limits_to_nearby_cases(self):
        response = self.client.get("/api/cases/map/?lat=33.69&lng=73.05&radius_km=10")

        self.assertEqual([item["id"] for item in response.data], [self.near_high.id, self.near_low.id])
        self.assertIn("latitude", response.data[0])


class AIScoreTests(MediaEnabledAPITestCase):
    def setUp(self):
        self.reporter = User.objects.create_user(email="r@example.com", username="r", password="x")

    def test_formula_with_fixed_detector_output(self):
        from .utils.scoring import compute_confidence_score, is_possibly_invalid

        # 0.5 * 0.9 + 0.3 * 0.75 (high) + 0.2 * 0.33 (one report) = 0.741
        self.assertEqual(compute_confidence_score(0.9, "high", 1), 74)
        self.assertEqual(compute_confidence_score(0.9, "high", 3), 88)  # 0.45 + 0.225 + 0.2 = 0.875
        self.assertEqual(compute_confidence_score(0.0, "low", 1), 14)
        self.assertTrue(is_possibly_invalid(0.29))
        self.assertFalse(is_possibly_invalid(0.3))

    def test_case_score_counts_people_not_repeat_reports(self):
        from .utils.scoring import score_breakdown

        other = User.objects.create_user(email="o2@example.com", username="o2", password="x")
        payload = {"description": "Cat", "latitude": "31.52", "longitude": "74.32", "severity": "high"}
        self.client.force_authenticate(user=self.reporter)
        first = self.client.post("/api/cases/report/", {**payload, "image": make_test_image()}, format="multipart")
        again = self.client.post("/api/cases/report/", {**payload, "image": make_test_image()}, format="multipart")
        self.client.force_authenticate(user=other)
        joined = self.client.post("/api/cases/report/", {**payload, "image": make_test_image()}, format="multipart")

        # The same person's second report is a new case; someone else's joins the first one.
        self.assertNotEqual(again.data["case_id"], first.data["case_id"])
        self.assertEqual(joined.data["case_id"], first.data["case_id"])
        self.assertEqual(score_breakdown(Case.objects.get(pk=first.data["case_id"]))["report_count"], 2)


class RealDetectorTests(MediaEnabledAPITestCase):
    real_detector = True

    def setUp(self):
        self.reporter = User.objects.create_user(email="r@example.com", username="r", password="x")

    @unittest.skipUnless(MODEL_PRESENT, "AI model not downloaded (python manage.py download_ai_model)")
    def test_detector_finds_the_dog_and_not_the_logo(self):
        from .ai.detector import detect_animal

        dog = detect_animal(stitch_upload("08_s15_bella_rescue_dog.jpg"))
        logo = detect_animal(stitch_upload("16_s2_paws_and_care_rescue_logo.jpg"))

        self.assertEqual(dog["label"], "dog")
        self.assertGreater(dog["confidence"], 0.8)
        self.assertEqual(len(dog["box"]), 4)
        self.assertLess(logo["confidence"], 0.3)

    @unittest.skipUnless(MODEL_PRESENT, "AI model not downloaded (python manage.py download_ai_model)")
    def test_submitted_report_is_scored_end_to_end(self):
        self.client.force_authenticate(user=self.reporter)

        response = self.client.post(
            "/api/cases/report/",
            {"description": "Dog", "latitude": "31.52", "longitude": "74.32", "severity": "high",
             "image": stitch_upload("08_s15_bella_rescue_dog.jpg")},
            format="multipart",
        )

        report = Report.objects.get(pk=response.data["report_id"])
        self.assertEqual(report.ai_animal_label, "dog")
        self.assertIsNotNone(response.data["case"]["confidence_score"])
        self.assertFalse(report.case.possibly_invalid)

    @unittest.skipUnless(MODEL_PRESENT, "AI model not downloaded (python manage.py download_ai_model)")
    def test_logo_photo_is_refused_before_anything_is_saved(self):
        self.client.force_authenticate(user=self.reporter)

        check = self.client.post(
            "/api/cases/check-photo/", {"image": stitch_upload("16_s2_paws_and_care_rescue_logo.jpg")}, format="multipart"
        )
        report = self.client.post(
            "/api/cases/report/",
            {"description": "?", "latitude": "31.52", "longitude": "74.32",
             "image": stitch_upload("16_s2_paws_and_care_rescue_logo.jpg")},
            format="multipart",
        )
        dog = self.client.post(
            "/api/cases/check-photo/", {"image": stitch_upload("08_s15_bella_rescue_dog.jpg")}, format="multipart"
        )

        self.assertEqual((check.status_code, check.data["code"]), (422, "not_an_animal"))
        self.assertEqual((report.status_code, report.data["code"]), (422, "not_an_animal"))
        self.assertEqual(Report.objects.count(), 0)
        self.assertEqual((dog.status_code, dog.data["animal"]), (200, "dog"))

    def test_case_score_follows_detector_severity_and_report_count(self):
        from unittest.mock import patch

        other = User.objects.create_user(email="o2@example.com", username="o2", password="x")
        payload = {"description": "Cat", "latitude": "31.52", "longitude": "74.32", "severity": "high"}
        with patch("rescue.ai.detector.detect_animal", return_value={"confidence": 0.9, "label": "cat", "box": [0, 0, 1, 1]}):
            self.client.force_authenticate(user=self.reporter)
            first = self.client.post("/api/cases/report/", {**payload, "image": make_test_image()}, format="multipart")
            self.client.force_authenticate(user=other)
            self.client.post("/api/cases/report/", {**payload, "image": make_test_image()}, format="multipart")

        case = Case.objects.get(pk=first.data["case_id"])
        self.assertEqual(first.data["case"]["confidence_score"], 74)  # one report
        # Second report: photos combine to 1 - 0.1 * 0.1 = 0.99, and 2 reports weigh 0.67.
        self.assertEqual(case.confidence_score, 85)  # 0.495 + 0.225 + 0.134

    def test_photo_without_an_animal_is_refused(self):
        from unittest.mock import patch

        self.client.force_authenticate(user=self.reporter)
        with patch("rescue.ai.detector.detect_animal", return_value={"confidence": 0.12, "label": "dog", "box": None}):
            response = self.client.post(
                "/api/cases/report/",
                {"description": "?", "latitude": "31.52", "longitude": "74.32", "image": make_test_image()},
                format="multipart",
            )
            check = self.client.post("/api/cases/check-photo/", {"image": make_test_image()}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)
        self.assertEqual(response.data["code"], "not_an_animal")
        self.assertEqual(check.data["code"], "not_an_animal")
        self.assertEqual((Report.objects.count(), Case.objects.count()), (0, 0))

    def test_without_the_model_reports_wait_instead_of_skipping_the_check(self):
        from unittest.mock import patch

        self.client.force_authenticate(user=self.reporter)
        with patch("rescue.ai.detector.detect_animal", return_value=None):
            response = self.client.post(
                "/api/cases/report/",
                {"description": "Dog", "latitude": "31.52", "longitude": "74.32", "image": make_test_image()},
                format="multipart",
            )

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data["code"], "detector_unavailable")
        self.assertEqual(Report.objects.count(), 0)

    def test_check_photo_needs_an_account_and_a_photo(self):
        self.assertEqual(self.client.post("/api/cases/check-photo/").status_code, status.HTTP_401_UNAUTHORIZED)
        self.client.force_authenticate(user=self.reporter)
        self.assertEqual(self.client.post("/api/cases/check-photo/").status_code, status.HTTP_400_BAD_REQUEST)

    def test_case_page_explains_the_score_and_records_feedback(self):
        from unittest.mock import patch

        self.client.force_authenticate(user=self.reporter)
        with patch("rescue.ai.detector.detect_animal", return_value={"confidence": 0.9, "label": "dog", "box": [0.1, 0.2, 0.8, 0.9]}):
            case_id = self.client.post(
                "/api/cases/report/",
                {"description": "Dog", "latitude": "31.52", "longitude": "74.32", "severity": "high", "image": make_test_image()},
                format="multipart",
            ).data["case_id"]

        ai = self.client.get(f"/api/cases/public/{case_id}/").data["ai"]
        self.assertEqual((ai["animal"], ai["animal_confidence"], ai["severity_weight"], ai["report_count"]), ("dog", 0.9, 0.75, 1))
        self.assertEqual(ai["box"], [0.1, 0.2, 0.8, 0.9])
        self.assertIsNone(ai["my_feedback"])

        bad = self.client.post(f"/api/cases/public/{case_id}/ai-feedback/", {"reason": "nonsense"}, format="json")
        good = self.client.post(f"/api/cases/public/{case_id}/ai-feedback/", {"reason": "wrong_animal"}, format="json")

        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(good.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.client.get(f"/api/cases/public/{case_id}/").data["ai"]["my_feedback"], "wrong_animal")



class ScoreOverTimeTests(MediaEnabledAPITestCase):
    """Unanswered cases lose confidence; more reports and an organization's response help."""

    def setUp(self):
        from unittest.mock import patch

        self.reporter = User.objects.create_user(email="r@example.com", username="r", password="x")
        org_user = User.objects.create_user(email="o@example.com", username="o", password="x", role="organization")
        self.organization = Organization.objects.create(user=org_user, name="Safe Paws", latitude=31.5, longitude=74.3, radius=5)
        self.client.force_authenticate(user=self.reporter)
        self.detector = patch("rescue.ai.detector.detect_animal", return_value={"confidence": 0.9, "label": "dog", "box": [0, 0, 1, 1]})
        self.detector.start()
        self.addCleanup(self.detector.stop)
        response = self.client.post(
            "/api/cases/report/",
            {"description": "Dog", "latitude": "31.52", "longitude": "74.32", "severity": "high", "image": make_test_image()},
            format="multipart",
        )
        self.case = Case.objects.get(pk=response.data["case_id"])

    def age_reports(self, hours):
        from datetime import timedelta

        from django.utils import timezone

        self.case.reports.update(created_at=timezone.now() - timedelta(hours=hours))

    def score(self):
        return self.client.get(f"/api/cases/public/{self.case.id}/").data["confidence_score"]

    def test_combined_photos_and_freshness_helpers(self):
        from .utils.scoring import combined_photo_confidence, freshness_factor

        self.assertAlmostEqual(combined_photo_confidence([0.6, 0.6]), 0.84)
        self.assertAlmostEqual(combined_photo_confidence([0.9]), 0.9)
        self.assertIsNone(combined_photo_confidence([None]))
        self.assertEqual(freshness_factor(5), 1.0)
        self.assertAlmostEqual(freshness_factor(39), 0.75)
        self.assertEqual(freshness_factor(200), 0.5)

    def test_unanswered_case_loses_confidence_over_time(self):
        fresh = self.score()  # 74: 0.45 + 0.225 + 0.066
        self.age_reports(39)  # freshness 0.75
        older = self.score()
        self.age_reports(500)  # floor 0.5
        oldest = self.score()

        self.assertEqual((fresh, older, oldest), (74, 56, 37))
        ai = self.client.get(f"/api/cases/public/{self.case.id}/").data["ai"]
        self.assertFalse(ai["answered"])
        self.assertEqual(ai["freshness"], 0.5)

    def test_a_new_report_restarts_the_clock_and_strengthens_the_score(self):
        self.age_reports(39)
        self.assertEqual(self.score(), 56)

        self.client.force_authenticate(user=User.objects.create_user(email="n@example.com", username="n", password="x"))
        self.client.post(
            "/api/cases/report/",
            {"description": "Still here", "latitude": "31.52", "longitude": "74.32", "severity": "high", "image": make_test_image()},
            format="multipart",
        )

        self.assertEqual(self.score(), 85)  # fresh again, two photos, two reports

    def test_score_stops_falling_once_an_organization_responds(self):
        self.age_reports(39)
        self.case.organization = self.organization
        self.case.status = "assigned"
        self.case.save()
        frozen = self.score()
        self.assertEqual(frozen, 56)  # answered 39 hours after the report

        # Weeks later: the report and the response both move back in time together.
        from datetime import timedelta

        from django.utils import timezone

        self.age_reports(500)
        self.case.updates.filter(status="assigned").update(created_at=timezone.now() - timedelta(hours=461))
        self.assertEqual(self.score(), frozen)
        self.assertTrue(self.client.get(f"/api/cases/public/{self.case.id}/").data["ai"]["answered"])

    def test_lists_refresh_waiting_cases(self):
        from .utils import scoring

        self.age_reports(500)
        scoring._last_refresh = 0.0
        self.client.get("/api/cases/trending/")

        self.case.refresh_from_db()
        self.assertEqual(self.case.confidence_score, 37)
