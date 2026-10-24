import hashlib
import os
import shutil
import tempfile
from io import StringIO
from pathlib import Path
from unittest.mock import patch

from django.core.management import CommandError, call_command
from django.test import TestCase, override_settings

from accounts.models import User
from animals.models import Animal
from organizations.models import Organization
from posts.models import Post, Story
from rescue.models import Case, Report

from .tests import FAKE_DOG, make_test_image


class TempMediaTestCase(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._media = tempfile.mkdtemp()
        cls._override = override_settings(MEDIA_ROOT=cls._media)
        cls._override.enable()

    @classmethod
    def tearDownClass(cls):
        cls._override.disable()
        shutil.rmtree(cls._media, ignore_errors=True)
        super().tearDownClass()


def run(command, *args, **options):
    out = StringIO()
    call_command(command, *args, stdout=out, stderr=StringIO(), **options)
    return out.getvalue()


@patch("rescue.ai.detector.detect_animal", return_value=FAKE_DOG)
class SeedDemoDataTests(TempMediaTestCase):
    @override_settings(DEBUG=True)
    def test_seeds_a_consistent_demo_world(self, _detector):
        output = run("seed_demo_data")
        self.assertIn("Demo data ready.", output)
        self.assertGreater(Organization.objects.count(), 1)
        self.assertGreater(Case.objects.count(), 1)
        self.assertGreater(Animal.objects.count(), 1)
        self.assertGreater(Post.objects.count(), 1)
        self.assertTrue(User.objects.filter(email__endswith="@strayaid.local", role="public").exists())

    @override_settings(DEBUG=True)
    def test_running_twice_does_not_duplicate(self, _detector):
        run("seed_demo_data")
        counts = (User.objects.count(), Organization.objects.count(), Case.objects.count(), Post.objects.count())
        run("seed_demo_data")
        self.assertEqual(counts, (User.objects.count(), Organization.objects.count(), Case.objects.count(), Post.objects.count()))

    @override_settings(DEBUG=True)
    def test_reset_removes_demo_accounts_but_keeps_real_ones(self, _detector):
        real = User.objects.create_user(email="real@example.com", username="real", password="x")
        run("seed_demo_data")
        run("seed_demo_data", reset=True)
        self.assertTrue(User.objects.filter(pk=real.pk).exists())

    @override_settings(DEBUG=True)
    def test_stories_can_be_refreshed_on_their_own(self, _detector):
        run("seed_demo_data")
        Story.objects.update(created_at="2000-01-01T00:00:00Z")
        self.assertIn("Stories refreshed", run("seed_demo_data", stories=True))
        self.assertTrue(Story.objects.exclude(created_at__year=2000).exists())

    @override_settings(DEBUG=False)
    def test_refuses_to_run_on_a_live_server_by_accident(self, _detector):
        with self.assertRaisesMessage(CommandError, "--production"):
            run("seed_demo_data")
        self.assertFalse(User.objects.exists())

    @override_settings(DEBUG=False)
    def test_live_server_needs_its_own_demo_password(self, _detector):
        with patch.dict(os.environ, {"DEMO_PASSWORD": ""}):
            with self.assertRaisesMessage(CommandError, "DEMO_PASSWORD"):
                run("seed_demo_data", production=True)

    @override_settings(DEBUG=False)
    def test_live_server_seed_uses_the_given_password_and_makes_no_superuser(self, _detector):
        with patch.dict(os.environ, {"DEMO_PASSWORD": "A-strong-demo-pass-2026"}):
            output = run("seed_demo_data", production=True)
        self.assertFalse(User.objects.filter(is_superuser=True).exists())
        reporter = User.objects.filter(email__endswith="@strayaid.local", role="public").first()
        self.assertTrue(reporter.check_password("A-strong-demo-pass-2026"))
        self.assertNotIn("A-strong-demo-pass-2026", output)
        self.assertNotIn("demo12345", output)

    @override_settings(DEBUG=True)
    def test_local_seed_never_makes_a_superuser_with_a_known_password(self, _detector):
        run("seed_demo_data")
        for admin in User.objects.filter(is_superuser=True):
            self.assertFalse(admin.check_password("admin12345"))


class ScoreReportsCommandTests(TempMediaTestCase):
    def setUp(self):
        user = User.objects.create_user(email="r@example.com", username="r", password="x")
        self.case = Case.objects.create(description="Dog", latitude=33.7, longitude=73.0, reported_by=user)
        self.report = Report.objects.create(
            case=self.case, user=user, image=make_test_image(), description="d", latitude=33.7, longitude=73.0
        )

    @patch("rescue.ai.detector.detect_animal", return_value=FAKE_DOG)
    def test_scores_unscored_reports(self, _detector):
        self.assertIn("Scored 1 report", run("score_reports"))
        self.report.refresh_from_db()
        self.assertEqual(self.report.ai_animal_label, "dog")
        self.assertIn("Scored 0 report", run("score_reports"))
        self.assertIn("Scored 1 report", run("score_reports", all=True))

    @patch("rescue.ai.detector.detect_animal", return_value=None)
    def test_explains_when_the_model_is_missing(self, _detector):
        with self.assertRaisesMessage(CommandError, "download_ai_model"):
            run("score_reports")


class DownloadAiModelTests(TestCase):
    def setUp(self):
        self.folder = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.folder, ignore_errors=True)
        self.model = self.folder / "model.onnx"
        self.content = b"fake-onnx-model"
        self.checksum = hashlib.sha256(self.content).hexdigest()

    def _fake_download(self, content):
        return lambda url, target: Path(target).write_bytes(content)

    def test_downloads_and_checks_the_file(self):
        with override_settings(AI_MODEL_PATH=self.model), \
                patch("rescue.management.commands.download_ai_model.MODEL_SHA256", self.checksum), \
                patch("urllib.request.urlretrieve", side_effect=self._fake_download(self.content)):
            self.assertIn("Saved", run("download_ai_model"))
            self.assertIn("already present", run("download_ai_model"))
        self.assertEqual(self.model.read_bytes(), self.content)

    def test_refuses_a_file_with_the_wrong_checksum(self):
        with override_settings(AI_MODEL_PATH=self.model), \
                patch("rescue.management.commands.download_ai_model.MODEL_SHA256", self.checksum), \
                patch("urllib.request.urlretrieve", side_effect=self._fake_download(b"tampered")):
            with self.assertRaisesMessage(CommandError, "checksum"):
                run("download_ai_model")
        self.assertFalse(self.model.exists())
        self.assertFalse(self.model.with_suffix(".part").exists())

    def test_network_errors_are_reported(self):
        with override_settings(AI_MODEL_PATH=self.model), patch("urllib.request.urlretrieve", side_effect=OSError("offline")):
            with self.assertRaisesMessage(CommandError, "Download failed"):
                run("download_ai_model")


class CheckAiModelTests(TestCase):
    def test_missing_model_is_explained(self):
        with override_settings(AI_MODEL_PATH=Path(tempfile.gettempdir()) / "no-model-here.onnx"):
            with self.assertRaisesMessage(CommandError, "download_ai_model"):
                run("check_ai_model")

    def test_reports_what_it_sees_in_each_photo(self):
        model = Path(tempfile.mkdtemp()) / "model.onnx"
        model.write_bytes(b"x")
        self.addCleanup(shutil.rmtree, model.parent, ignore_errors=True)
        results = [FAKE_DOG, {"confidence": 0.0, "label": "", "box": None}]
        with override_settings(AI_MODEL_PATH=model), \
                patch("rescue.ai.detector._get_session", return_value=object()), \
                patch("rescue.ai.detector.detect_animal", side_effect=results):
            output = run("check_ai_model")
        self.assertIn("dog 90%", output)
        self.assertIn("no animal found", output)
        self.assertIn("working", output)

    def test_unloadable_model_is_explained(self):
        model = Path(tempfile.mkdtemp()) / "model.onnx"
        model.write_bytes(b"x")
        self.addCleanup(shutil.rmtree, model.parent, ignore_errors=True)
        with override_settings(AI_MODEL_PATH=model), patch("rescue.ai.detector._get_session", return_value=None):
            with self.assertRaisesMessage(CommandError, "couldn't be loaded"):
                run("check_ai_model")
