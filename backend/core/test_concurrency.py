"""Real simultaneous requests on real Postgres (config.test_settings_postgres). Sequential tests
can't show a race: these fire many requests at once and count how many got through."""

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest import skipUnless

from django.db import connection, connections
from django.test import TransactionTestCase

from accounts.models import AuditEvent
from animals.models import AdoptionApplication, Animal, Sponsorship
from core.test_security import apply, client_for, make_animal, make_case, person, team

RACERS = 8


def at_once(calls):
    """Run every call at the same moment on its own thread and database connection."""
    barrier = Barrier(len(calls))

    def run(call):
        try:
            barrier.wait()
            return call()
        finally:
            connections.close_all()

    with ThreadPoolExecutor(len(calls)) as pool:
        return list(pool.map(run, calls))


@skipUnless(connection.vendor == "postgresql", "needs Postgres row locks")
class RaceTests(TransactionTestCase):
    def test_only_one_of_many_simultaneous_approvals_wins(self):
        organization = team("owner")
        animal = make_animal(organization, person("reporter"))
        applications = [apply(animal, person(f"applicant{number}")) for number in range(RACERS)]

        def approve(application):
            return lambda: client_for(organization.user).post(
                f"/api/animals/applications/{application.id}/decide/", {"status": "approved"}, format="json"
            ).status_code

        codes = at_once([approve(application) for application in applications])
        self.assertEqual(sorted(codes), [200] + [400] * (RACERS - 1))
        self.assertEqual(AdoptionApplication.objects.filter(animal=animal, status="approved").count(), 1)
        self.assertEqual(AdoptionApplication.objects.filter(animal=animal, status="rejected").count(), RACERS - 1)
        self.assertEqual(Animal.objects.get(pk=animal.pk).status, Animal.STATUS_ADOPTED)
        self.assertEqual(AuditEvent.objects.filter(action="adoption.approved").count(), 1)

    def test_double_submitting_an_application_files_it_once(self):
        animal = make_animal(team("owner"), person("reporter"))
        applicant = person("applicant")
        form = {
            "full_name": "Sara Khan", "phone": "03001234567", "home_type": "house", "city": "Islamabad", "ownership": "own",
            "household_size": 3, "hours_alone": 2, "experience": "some", "reason": "We have a big garden and lots of time.",
            "agrees_home_visit": True, "agrees_return_policy": True,
        }
        codes = at_once([
            lambda: client_for(applicant).post(f"/api/animals/{animal.id}/apply/", form, format="json").status_code
            for _ in range(RACERS)
        ])
        self.assertEqual(sorted(codes), [201] + [400] * (RACERS - 1))
        self.assertEqual(AdoptionApplication.objects.filter(animal=animal, applicant=applicant).count(), 1)

    def test_two_teams_cannot_both_take_a_case(self):
        case = make_case(person("reporter"))
        teams = [team(f"team{number}") for number in range(RACERS)]
        codes = at_once([
            lambda user=organization.user: client_for(user).post(f"/api/cases/{case.id}/accept/").status_code
            for organization in teams
        ])
        self.assertEqual(sorted(codes), [200] + [400] * (RACERS - 1))

    def test_a_receipt_is_only_checked_once(self):
        organization = team("owner")
        animal = make_animal(organization, person("reporter"))
        pledge = Sponsorship.objects.create(animal=animal, sponsor=person("sponsor"), amount_pkr=1000)
        codes = at_once([
            lambda: client_for(organization.user).post(
                f"/api/animals/sponsorships/{pledge.id}/review/", {"status": "confirmed"}, format="json"
            ).status_code
            for _ in range(RACERS)
        ])
        self.assertEqual(sorted(codes), [200] + [400] * (RACERS - 1))
        self.assertEqual(AuditEvent.objects.filter(action="sponsorship.confirmed").count(), 1)


@skipUnless(connection.vendor == "postgresql", "needs Postgres")
class SearchOnPostgresTests(TransactionTestCase):
    def test_search_runs_on_postgres_and_treats_injection_as_text(self):
        case = make_case(person("reporter"), area="G-11/3, Islamabad")
        visitor = client_for()
        self.assertEqual([row["id"] for row in visitor.get("/api/cases/search/", {"q": "g11"}).data], [case.id])
        for text in ("' OR '1'='1", "%' OR 1=1 --", "'; DROP TABLE rescue_case; --", "zq\x00zq"):
            reply = visitor.get("/api/cases/search/", {"q": text})
            self.assertEqual((reply.status_code, reply.data), (200, []), text)
