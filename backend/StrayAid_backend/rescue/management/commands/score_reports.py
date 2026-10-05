from django.core.management.base import BaseCommand, CommandError

from rescue.models import Case, Report
from rescue.utils.scoring import refresh_case_score, score_report


class Command(BaseCommand):
    help = "Run the animal detector on report photos and recalculate case AI scores."

    def add_arguments(self, parser):
        parser.add_argument("--all", action="store_true", help="Re-score reports that already have a score.")

    def handle(self, *args, **options):
        reports = Report.objects.exclude(image="")
        if not options["all"]:
            reports = reports.filter(ai_animal_confidence__isnull=True)

        scored = 0
        for report in reports.iterator():
            if not score_report(report):
                raise CommandError("The AI model isn't available. Run `python manage.py download_ai_model` first.")
            scored += 1

        for case in Case.objects.prefetch_related("reports"):
            refresh_case_score(case)
        self.stdout.write(self.style.SUCCESS(f"Scored {scored} report(s) and refreshed every case score."))
