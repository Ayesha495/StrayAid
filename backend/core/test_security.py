"""Attacks on the rules that keep people's data and money safe. Each test is written from the
attacker's side, so a failure here means a real hole, not a cosmetic bug."""

from unittest.mock import patch
from urllib.parse import unquote

from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from rest_framework.test import APIClient, APIRequestFactory

from accounts.models import AuditEvent, User
from animals.models import AdoptionApplication, Animal, Sponsorship
from core.media import media_url, signed_media_ok
from core.throttles import client_ip
from organizations.models import Organization
from rescue.models import Case, Report

PHOTO = (
    b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,"
    b"\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"
)


def person(name, role="public"):
    return User.objects.create_user(username=name, email=f"{name}@example.com", password="x", role=role)


def team(name, **details):
    return Organization.objects.create(user=person(name, role="organization"), name=name.title(), **details)


def client_for(user=None):
    client = APIClient()
    if user:
        client.force_authenticate(user)
    return client


def make_case(reporter, area="G-11/3, Islamabad", **fields):
    case = Case.objects.create(
        description="Limping near the market", latitude=33.68, longitude=73.04, area=area, reported_by=reporter, **fields
    )
    Report.objects.create(
        case=case, user=reporter, image=SimpleUploadedFile("a.gif", PHOTO, "image/gif"), description="Limping",
        latitude=33.68, longitude=73.04, area=area, ai_animal_label="dog",
    )
    return case


def make_animal(organization, reporter, status=Animal.STATUS_ADOPTABLE, name="Bruno"):
    case = make_case(reporter, status="rescued", organization=organization)
    return Animal.objects.create(case=case, organization=organization, name=name, species="Dog", status=status)


def apply(animal, applicant, status="pending"):
    return AdoptionApplication.objects.create(
        animal=animal, applicant=applicant, full_name=applicant.username, phone="03001234567", home_type="house", status=status,
    )


class OrganizationOwnershipTests(TestCase):
    def test_a_team_cannot_change_another_teams_bank_account(self):
        victim, attacker = team("victim", bank_account_number="111"), team("attacker")
        for method in ("patch", "put"):
            reply = getattr(client_for(attacker.user), method)(
                f"/api/organizations/{victim.id}/", {"name": "x", "bank_account_number": "666"}, format="json"
            )
            self.assertEqual(reply.status_code, 404)
        victim.refresh_from_db()
        self.assertEqual(victim.bank_account_number, "111")

    def test_a_team_can_still_edit_its_own_profile_and_it_is_audited(self):
        organization = team("owner", bank_account_number="111")
        reply = client_for(organization.user).patch(
            f"/api/organizations/{organization.id}/", {"bank_account_number": "222"}, format="json"
        )
        self.assertEqual(reply.status_code, 200)
        self.assertTrue(AuditEvent.objects.filter(action="organization.bank_details_changed", object_id=organization.id).exists())

    def test_nobody_can_verify_their_own_team(self):
        organization = team("owner")
        client_for(organization.user).patch("/api/organizations/me/", {"is_verified": True}, format="json")
        organization.refresh_from_db()
        self.assertFalse(organization.is_verified)

    def test_a_role_without_a_profile_is_refused_not_crashed(self):
        reply = client_for(person("half", role="organization")).get("/api/cases/my-cases/")
        self.assertEqual(reply.status_code, 403)


class PersonalDataTests(TestCase):
    def setUp(self):
        self.reporter = person("reporter")

    def test_only_the_team_that_took_a_case_sees_the_reporters_email(self):
        stranger, owner = team("stranger"), team("owner")
        unclaimed = make_case(self.reporter)
        taken = make_case(self.reporter, organization=owner)
        reply = client_for(stranger.user).get(f"/api/cases/{unclaimed.id}/")
        self.assertEqual(reply.status_code, 200)
        self.assertNotIn("user_email", reply.data["reports"][0])
        reply = client_for(owner.user).get(f"/api/cases/{taken.id}/")
        self.assertEqual(reply.data["reports"][0]["user_email"], "reporter@example.com")

    def test_public_reports_never_name_the_reporter(self):
        self.reporter.first_name = "Ayesha"
        self.reporter.save()
        case = make_case(self.reporter)
        reply = client_for().get(f"/api/cases/public/{case.id}/reports/")
        self.assertNotIn("Ayesha", str(reply.content))

    def test_sponsors_are_not_identifiable_from_a_small_group(self):
        organization = team("owner")
        animal = make_animal(organization, self.reporter)
        sponsors = [person(f"sponsor{number}") for number in range(3)]
        Sponsorship.objects.create(animal=animal, sponsor=sponsors[0], amount_pkr=500, status="confirmed")
        self.assertEqual(client_for().get(f"/api/animals/{animal.id}/").data["sponsor_initials"], [])
        for sponsor in sponsors[1:]:
            Sponsorship.objects.create(animal=animal, sponsor=sponsor, amount_pkr=500, status="confirmed")
        self.assertEqual(len(client_for().get(f"/api/animals/{animal.id}/").data["sponsor_initials"]), 1)

    def test_the_teams_login_email_is_not_published_as_its_contact(self):
        organization = team("owner", email="")
        animal = make_animal(organization, self.reporter)
        self.assertNotIn("owner@example.com", str(client_for().get(f"/api/animals/{animal.id}/").content))

    def test_applicants_cannot_read_each_others_applications(self):
        organization = team("owner")
        animal = make_animal(organization, self.reporter)
        application = apply(animal, person("first"))
        self.assertEqual(client_for(person("second")).get(f"/api/animals/applications/{application.id}/").status_code, 404)
        self.assertEqual(client_for(team("other").user).get(f"/api/animals/applications/{application.id}/").status_code, 404)


class ProtectedFileTests(TestCase):
    def test_receipts_need_a_valid_signature(self):
        self.assertFalse(signed_media_ok("receipts/a.png", None))
        self.assertFalse(signed_media_ok("receipts/a.png", "forged"))
        self.assertTrue(signed_media_ok("avatars/a.png", None))

    def test_a_signature_for_one_file_does_not_open_another(self):
        class Stored:
            name = "receipts/a.png"
            url = "/media/receipts/a.png"

            def __bool__(self):
                return True

        signature = unquote(media_url(None, Stored()).split("sig=")[1])
        self.assertTrue(signed_media_ok("receipts/a.png", signature))
        self.assertFalse(signed_media_ok("receipts/b.png", signature))

    def test_folder_tricks_do_not_dodge_the_check(self):
        for path in ("x/../receipts/a.png", ".//receipts/a.png", "CHAT/a.png", "/chat/a.png"):
            self.assertFalse(signed_media_ok(path, None), path)


class OneAdoptionPerAnimalTests(TestCase):
    def setUp(self):
        self.organization = team("owner")
        self.reporter = person("reporter")
        self.animal = make_animal(self.organization, self.reporter)
        self.first, self.second = person("first"), person("second")
        self.team_client = client_for(self.organization.user)

    def decide(self, application, status):
        return self.team_client.post(f"/api/animals/applications/{application.id}/decide/", {"status": status}, format="json")

    def test_the_database_itself_refuses_a_second_approval(self):
        apply(self.animal, self.first, status="approved")
        with self.assertRaises(IntegrityError), transaction.atomic():
            apply(self.animal, self.second, status="approved")

    def test_the_database_refuses_two_active_applications_from_one_person(self):
        apply(self.animal, self.first)
        with self.assertRaises(IntegrityError), transaction.atomic():
            apply(self.animal, self.first)

    def test_approving_one_closes_the_rest_and_marks_the_animal_adopted(self):
        winner, loser = apply(self.animal, self.first), apply(self.animal, self.second)
        self.assertEqual(self.decide(winner, "approved").status_code, 200)
        loser.refresh_from_db()
        self.animal.refresh_from_db()
        self.assertEqual(loser.status, "rejected")
        self.assertEqual(self.animal.status, Animal.STATUS_ADOPTED)

    def test_a_stale_second_approval_is_refused(self):
        winner, loser = apply(self.animal, self.first), apply(self.animal, self.second)
        self.decide(winner, "approved")
        self.assertEqual(self.decide(loser, "approved").status_code, 400)
        self.assertEqual(self.animal.adoption_applications.filter(status="approved").count(), 1)

    def test_no_one_can_apply_for_an_adopted_animal(self):
        self.decide(apply(self.animal, self.first), "approved")
        reply = client_for(self.second).post(f"/api/animals/{self.animal.id}/apply/", {}, format="json")
        self.assertEqual(reply.status_code, 400)

    def test_an_adopted_animal_shows_no_applications_but_stays_on_the_profile(self):
        self.decide(apply(self.animal, self.first), "approved")
        animals = client_for().get(f"/api/organizations/{self.organization.id}/animals/").data
        self.assertEqual(
            [(animal["id"], animal["status"], animal["application_count"]) for animal in animals],
            [(self.animal.id, "adopted", 0)],
        )

    def test_a_returned_animal_can_be_adopted_again(self):
        self.decide(apply(self.animal, self.first), "approved")
        Animal.objects.filter(pk=self.animal.pk).update(image="animals/bruno.jpg", description="Friendly.", health="healthy")
        reply = self.team_client.patch(
            f"/api/animals/{self.animal.id}/", {"status": "adoptable", "status_note": "The family moved abroad."}, format="json"
        )
        self.assertEqual(reply.status_code, 200)
        self.assertEqual(self.animal.adoption_applications.filter(status="approved").count(), 0)
        self.assertEqual(self.decide(apply(self.animal, self.second), "approved").status_code, 200)

    def test_decisions_leave_an_audit_trail_without_personal_details(self):
        self.decide(apply(self.animal, self.first), "approved")
        event = AuditEvent.objects.get(action="adoption.approved")
        self.assertEqual(event.actor, self.organization.user)
        self.assertNotIn("first@example.com", str(event.details))


class CaseSearchTests(TestCase):
    def setUp(self):
        self.reporter = person("reporter")
        self.visitor = client_for()

    def search(self, text, **params):
        return self.visitor.get("/api/cases/search/", {"q": text, **params})

    def ids(self, text):
        return [row["id"] for row in self.search(text).data]

    def test_an_unrescued_report_is_found_by_its_address(self):
        case = make_case(self.reporter, area="Street 4, G-11/3, Islamabad")
        self.assertEqual(self.ids("G-11/3"), [case.id])

    def test_the_address_can_be_typed_loosely(self):
        case = make_case(self.reporter, area="G-11/3, Islamabad")
        for text in ("g11", "G 11", "g-11", "islamabad g-11", "G11/3 Islamabad"):
            self.assertEqual(self.ids(text), [case.id], text)

    def test_a_later_sighting_at_another_address_is_found_too(self):
        case = make_case(self.reporter, area="F-7 Markaz")
        Report.objects.create(
            case=case, user=self.reporter, image=SimpleUploadedFile("b.gif", PHOTO, "image/gif"), description="Seen again",
            latitude=33.7, longitude=73.05, area="Jinnah Super",
        )
        self.assertEqual(self.ids("Jinnah Super"), [case.id])

    def test_every_case_is_searchable_whatever_its_status(self):
        statuses = ["reported", "assigned", "in_progress", "rescued", "adoption", "closed"]
        cases = [make_case(self.reporter, area=f"Saddar Bazaar {status}", status=status) for status in statuses]
        self.assertEqual(sorted(self.ids("Saddar")), sorted(case.id for case in cases))

    def test_cases_are_found_by_animal_name_kind_and_reference(self):
        animal = make_animal(team("owner"), self.reporter, name="Bruno")
        self.assertIn(animal.case_id, self.ids("bruno"))
        self.assertIn(animal.case_id, self.ids("dog"))
        self.assertEqual(self.ids(animal.case.reference), [animal.case_id])

    def test_open_cases_come_first(self):
        closed = make_case(self.reporter, area="Blue Area", status="closed")
        open_case = make_case(self.reporter, area="Blue Area", status="reported")
        self.assertEqual(self.ids("blue area"), [open_case.id, closed.id])

    def test_results_carry_no_reporter_details(self):
        make_case(self.reporter)
        body = str(self.search("G-11").content)
        self.assertNotIn("reporter@example.com", body)
        self.assertNotIn("reported_by", body)

    def test_injection_is_just_text(self):
        make_case(self.reporter)
        for text in ("' OR '1'='1", "%%", "__", "\\\\", "'; DROP TABLE rescue_case; --", "G-11' UNION SELECT password FROM accounts_user--"):
            reply = self.search(text)
            self.assertEqual(reply.status_code, 200, text)
            self.assertEqual(reply.data, [], text)
        self.assertEqual(Case.objects.count(), 1)

    def test_hostile_input_is_handled_calmly(self):
        make_case(self.reporter)
        self.assertEqual(self.search("a\x00b").status_code, 200)
        self.assertEqual(self.search("x" * 5000).status_code, 200)
        self.assertEqual(self.search("").data, [])
        self.assertEqual(self.search("a").data, [])

    def test_results_are_capped(self):
        for _ in range(6):
            make_case(self.reporter, area="Blue Area")
        self.assertEqual(len(self.search("blue", limit=2).data), 2)
        self.assertEqual(len(self.search("blue", limit="many").data), 6)


class InputHandlingTests(TestCase):
    def test_bad_filters_are_refused_not_crashed(self):
        visitor = client_for()
        self.assertEqual(visitor.get("/api/animals/public/", {"organization_id": "1 OR 1=1"}).status_code, 400)
        self.assertEqual(visitor.get("/api/animals/public/", {"status": "'; DROP"}).status_code, 400)
        self.assertEqual(visitor.get("/api/posts/public-feed/", {"animal": "abc"}).status_code, 400)

    def test_private_routes_require_a_login(self):
        self.assertEqual(client_for().get("/api/notifications/").status_code, 401)
        self.assertEqual(client_for().post("/api/cases/report/", {}).status_code, 401)

    def test_the_address_is_stored_without_control_characters(self):
        from rescue.views import clean_area

        self.assertEqual(clean_area(" F-7\x00\n Islamabad "), "F-7 Islamabad")


class DemoDataTests(TestCase):
    def test_the_apps_are_told_when_demo_data_is_present(self):
        self.assertFalse(client_for().get("/api/cases/stats/").data["demo_data"])
        User.objects.create_user(username="demo", email="demo@strayaid.local", password="x")
        self.assertTrue(client_for().get("/api/cases/stats/").data["demo_data"])

    def test_demo_records_move_to_the_bundled_photos_and_real_uploads_stay(self):
        from pathlib import Path
        from tempfile import TemporaryDirectory

        from django.conf import settings
        from django.core.files.base import ContentFile

        from rescue.management.commands.seed_demo_data import Command

        source = sorted(settings.DEMO_OWN_IMAGES_DIR.iterdir())[0]
        reporter = person("reporter")
        with TemporaryDirectory() as folder, override_settings(MEDIA_ROOT=folder):
            demo = make_case(reporter).reports.first()
            demo.image.save("a.jpg", ContentFile(source.read_bytes()), save=True)
            real = make_case(reporter).reports.first()
            real_name = real.image.name
            missing = make_case(reporter).reports.first()
            Path(folder, missing.image.name).unlink()
            missing_name = missing.image.name
            Command().use_bundled_photos()
            demo.refresh_from_db()
            real.refresh_from_db()
            missing.refresh_from_db()
        self.assertEqual(demo.image.name, f"demo/{source.name}")
        self.assertEqual(real.image.name, real_name)
        self.assertEqual(missing.image.name, missing_name)


class ClientIpTests(TestCase):
    def request(self, **headers):
        return APIRequestFactory().get("/", **headers)

    @override_settings(CLIENT_IP_HEADER="")
    def test_a_forged_forwarded_header_does_not_change_who_you_are(self):
        with patch("core.throttles.api_settings") as api_settings:
            api_settings.NUM_PROXIES = 1
            forged = client_ip(self.request(HTTP_X_FORWARDED_FOR="1.1.1.1, 9.9.9.9", REMOTE_ADDR="10.0.0.1"))
            other = client_ip(self.request(HTTP_X_FORWARDED_FOR="2.2.2.2, 9.9.9.9", REMOTE_ADDR="10.0.0.1"))
        self.assertEqual(forged, "9.9.9.9")
        self.assertEqual(other, forged)

    @override_settings(CLIENT_IP_HEADER="HTTP_TRUE_CLIENT_IP")
    def test_the_hosts_own_header_wins_when_configured(self):
        self.assertEqual(client_ip(self.request(HTTP_TRUE_CLIENT_IP="8.8.8.8", HTTP_X_FORWARDED_FOR="1.1.1.1")), "8.8.8.8")
