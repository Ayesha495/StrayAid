import time
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from rescue.ai import detector
from rescue.utils.scoring import compute_confidence_score

# Two demo photos the model should get right: a dog, and a logo with no animal.
SAMPLES = ["08_s15_bella_rescue_dog.jpg", "16_s2_paws_and_care_rescue_logo.jpg"]


class Command(BaseCommand):
    help = "Check that the AI animal detector loads and works: python manage.py check_ai_model [photo ...]"

    def add_arguments(self, parser):
        parser.add_argument("photos", nargs="*", help="Photos to test (defaults to two demo photos).")

    def handle(self, *args, **options):
        model = Path(settings.AI_MODEL_PATH)
        self.stdout.write(f"Model:  {detector.MODEL_NAME}")
        self.stdout.write(f"File:   {model} ({'found' if model.exists() else 'MISSING'})")
        if not model.exists():
            raise CommandError("Download it first: python manage.py download_ai_model")

        started = time.monotonic()
        if detector._get_session() is None:
            raise CommandError("The model file exists but couldn't be loaded (see the warning above).")
        self.stdout.write(f"Loaded in {time.monotonic() - started:.1f}s\n")

        samples = Path(settings.BASE_DIR).parent.parent / "images" / "stitch"
        photos = [Path(photo) for photo in options["photos"]] or [samples / name for name in SAMPLES]
        for photo in photos:
            if not photo.exists():
                self.stdout.write(self.style.WARNING(f"{photo}: not found"))
                continue
            started = time.monotonic()
            with open(photo, "rb") as image_file:
                result = detector.detect_animal(image_file)
            took = (time.monotonic() - started) * 1000
            if result["label"]:
                verdict = f"{result['label']} {result['confidence']:.0%}"
                example = compute_confidence_score(result["confidence"], "medium", 1)
                note = f"  -> case score with medium severity, 1 report: {example}%"
            else:
                verdict, note = "no animal found", "  -> would be flagged 'Needs verification'"
            self.stdout.write(f"{photo.name}: {verdict} ({took:.0f} ms){note}")

        self.stdout.write(self.style.SUCCESS("\nThe AI detector is working."))
