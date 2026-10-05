import hashlib
import urllib.request
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from rescue.ai.detector import MODEL_SHA256, MODEL_URL


class Command(BaseCommand):
    help = "Download the free animal-detection model (SSD-MobileNet v1, ONNX Model Zoo) to AI_MODEL_PATH."

    def handle(self, *args, **options):
        path = Path(settings.AI_MODEL_PATH)
        if path.exists() and self._sha256(path) == MODEL_SHA256:
            self.stdout.write(f"Model already present: {path}")
            return

        path.parent.mkdir(parents=True, exist_ok=True)
        partial = path.with_suffix(".part")
        self.stdout.write(f"Downloading {MODEL_URL} ...")
        try:
            urllib.request.urlretrieve(MODEL_URL, partial)
        except OSError as error:
            raise CommandError(f"Download failed: {error}") from error

        if self._sha256(partial) != MODEL_SHA256:
            partial.unlink(missing_ok=True)
            raise CommandError("Downloaded file doesn't match the expected checksum; not using it.")
        partial.replace(path)
        self.stdout.write(self.style.SUCCESS(f"Saved {path}"))

    @staticmethod
    def _sha256(path):
        digest = hashlib.sha256()
        with open(path, "rb") as handle:
            for chunk in iter(lambda: handle.read(1 << 20), b""):
                digest.update(chunk)
        return digest.hexdigest()
