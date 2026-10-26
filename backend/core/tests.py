import io
import json
import os
import subprocess
import sys
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, override_settings
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from .uploads import UniqueUploadPath, validate_image_upload


User = get_user_model()
PROJECT_DIR = Path(__file__).resolve().parent.parent
LOCMEM_CACHE = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "throttle-tests"}}

PRODUCTION_ENV = {
    "DJANGO_SECRET_KEY": "a-production-secret-that-is-long-enough-to-pass-the-deploy-check-123456",
    "DEBUG": "0",
    "ALLOWED_HOSTS": "api.strayaid.example",
    "CORS_ALLOWED_ORIGINS": "https://strayaid.example",
    "CSRF_TRUSTED_ORIGINS": "https://strayaid.example",
    "DATABASE_URL": "postgres://user:pass@db.example:5432/strayaid",
}

SETTING_NAMES = [
    "DEBUG", "SECRET_KEY", "ALLOWED_HOSTS", "CORS_ALLOWED_ORIGINS", "CORS_ALLOW_ALL_ORIGINS",
    "CORS_ALLOW_CREDENTIALS", "CSRF_TRUSTED_ORIGINS", "SECURE_SSL_REDIRECT", "SESSION_COOKIE_SECURE",
    "CSRF_COOKIE_SECURE", "SECURE_HSTS_SECONDS", "SECURE_PROXY_SSL_HEADER", "X_FRAME_OPTIONS",
    "GOOGLE_OAUTH_CLIENT_IDS", "DATABASES", "INSTALLED_APPS", "SERVE_MEDIA",
]


def make_image_file(name="photo.jpg", size=(16, 16), image_format="JPEG", content_type="image/jpeg"):
    buffer = io.BytesIO()
    Image.new("RGB", size, "#1E6B56").save(buffer, format=image_format)
    return SimpleUploadedFile(name, buffer.getvalue(), content_type=content_type)


def run_with_env(code, env):
    # Settings are read once per process, so each environment gets a fresh interpreter. The
    # developer's own .env is skipped so only the variables given here count.
    base_env = {key: value for key, value in os.environ.items() if key in ("PATH", "SYSTEMROOT", "PYTHONPATH")}
    full_env = {**base_env, "DJANGO_ENV_FILE": str(PROJECT_DIR / "no-such.env"), **env}
    return subprocess.run(
        [sys.executable, "-c", code], cwd=PROJECT_DIR, env=full_env, capture_output=True, text=True, timeout=120
    )


def load_settings(env):
    code = (
        "import json, os\n"
        "os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')\n"
        "from django.conf import settings\n"
        f"names = {SETTING_NAMES!r}\n"
        "values = {name: getattr(settings, name, None) for name in names}\n"
        "values['DATABASE_URL_USED'] = settings.DATABASES['default']\n"
        "print(json.dumps(values, default=str))\n"
    )
    result = run_with_env(code, env)
    return result, (json.loads(result.stdout) if result.returncode == 0 else None)


class ProductionSettingsTests(SimpleTestCase):
    def test_production_refuses_to_start_without_a_secret_key(self):
        env = {key: value for key, value in PRODUCTION_ENV.items() if key != "DJANGO_SECRET_KEY"}
        result, _ = load_settings(env)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DJANGO_SECRET_KEY", result.stderr)

    def test_debug_is_off_unless_asked_for(self):
        result, values = load_settings(PRODUCTION_ENV)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(values["DEBUG"])

    def test_no_secrets_or_wildcards_are_baked_in(self):
        result, values = load_settings(PRODUCTION_ENV)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(values["SECRET_KEY"], PRODUCTION_ENV["DJANGO_SECRET_KEY"])
        self.assertEqual(values["ALLOWED_HOSTS"], ["api.strayaid.example"])
        self.assertFalse(values["CORS_ALLOW_ALL_ORIGINS"])
        self.assertFalse(values["CORS_ALLOW_CREDENTIALS"])
        self.assertEqual(values["CORS_ALLOWED_ORIGINS"], ["https://strayaid.example"])
        self.assertEqual(values["CSRF_TRUSTED_ORIGINS"], ["https://strayaid.example"])

    def test_https_hardening_is_on_in_production(self):
        result, values = load_settings(PRODUCTION_ENV)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(values["SECURE_SSL_REDIRECT"])
        self.assertTrue(values["SESSION_COOKIE_SECURE"])
        self.assertTrue(values["CSRF_COOKIE_SECURE"])
        self.assertGreaterEqual(values["SECURE_HSTS_SECONDS"], 3600)
        self.assertEqual(values["SECURE_PROXY_SSL_HEADER"], ["HTTP_X_FORWARDED_PROTO", "https"])
        self.assertEqual(values["X_FRAME_OPTIONS"], "DENY")

    def test_database_comes_from_database_url(self):
        result, values = load_settings(PRODUCTION_ENV)
        self.assertEqual(result.returncode, 0, result.stderr)
        database = values["DATABASES"]["default"]
        self.assertEqual(
            (database["NAME"], database["USER"], database["PASSWORD"], database["HOST"], database["PORT"]),
            ("strayaid", "user", "pass", "db.example", 5432),
        )

    def test_neon_direct_connection_is_preferred_for_a_long_running_server(self):
        env = {
            **PRODUCTION_ENV,
            "DATABASE_URL": "postgresql://u:p@ep-cool-name-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require",
            "DATABASE_URL_UNPOOLED": "postgresql://u:p@ep-cool-name.us-east-2.aws.neon.tech/neondb?sslmode=require",
        }
        result, values = load_settings(env)
        self.assertEqual(result.returncode, 0, result.stderr)
        database = values["DATABASE_URL_USED"]
        self.assertEqual(database["HOST"], "ep-cool-name.us-east-2.aws.neon.tech")
        self.assertFalse(database.get("DISABLE_SERVER_SIDE_CURSORS", False))
        self.assertEqual(database["OPTIONS"]["sslmode"], "require")

    def test_pooled_neon_connection_disables_server_side_cursors(self):
        env = {**PRODUCTION_ENV, "DATABASE_URL": "postgresql://u:p@ep-cool-name-pooler.us-east-2.aws.neon.tech/neondb"}
        result, values = load_settings(env)
        self.assertEqual(result.returncode, 0, result.stderr)
        database = values["DATABASE_URL_USED"]
        self.assertEqual(database["HOST"], "ep-cool-name-pooler.us-east-2.aws.neon.tech")
        self.assertTrue(database["DISABLE_SERVER_SIDE_CURSORS"])
        self.assertEqual(database["CONN_MAX_AGE"], 0)

    def test_database_can_come_from_postgres_variables(self):
        env = {key: value for key, value in PRODUCTION_ENV.items() if key != "DATABASE_URL"}
        env.update({"POSTGRES_DB": "stray", "POSTGRES_USER": "u", "POSTGRES_PASSWORD": "p", "POSTGRES_HOST": "db"})
        result, values = load_settings(env)
        self.assertEqual(result.returncode, 0, result.stderr)
        database = values["DATABASES"]["default"]
        self.assertEqual((database["NAME"], database["USER"], database["PASSWORD"], database["HOST"]), ("stray", "u", "p", "db"))

    def test_google_client_ids_come_from_the_environment(self):
        result, values = load_settings({**PRODUCTION_ENV, "GOOGLE_OAUTH_CLIENT_IDS": " web-id , android-id ,"})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(values["GOOGLE_OAUTH_CLIENT_IDS"], ["web-id", "android-id"])

    def test_local_development_still_works_with_debug_on(self):
        result, values = load_settings({"DEBUG": "1"})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(values["DEBUG"])
        self.assertFalse(values["SECURE_SSL_REDIRECT"])
        self.assertTrue(values["SECRET_KEY"])

    def test_unused_auth_packages_are_not_installed(self):
        result, values = load_settings(PRODUCTION_ENV)
        self.assertEqual(result.returncode, 0, result.stderr)
        for app in ("allauth", "dj_rest_auth", "rest_framework.authtoken"):
            self.assertNotIn(app, values["INSTALLED_APPS"])

    def test_deploy_check_passes(self):
        code = (
            "import os, sys\n"
            "os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')\n"
            "from django.core.management import execute_from_command_line\n"
            "execute_from_command_line(['manage.py', 'check', '--deploy', '--fail-level', 'WARNING'])\n"
        )
        result = run_with_env(code, PRODUCTION_ENV)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


class SecurityHeaderTests(APITestCase):
    def test_responses_carry_security_headers(self):
        response = self.client.get("/api/posts/public-feed/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")
        self.assertEqual(response["X-Frame-Options"], "DENY")
        self.assertEqual(response["Referrer-Policy"], "same-origin")
        self.assertEqual(response["Cross-Origin-Opener-Policy"], "same-origin")

    def test_health_check_needs_no_account_and_is_never_rate_limited(self):
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {"status": "ok"})

    def test_unused_allauth_pages_are_gone(self):
        self.assertEqual(self.client.get("/accounts/login/").status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.get("/accounts/signup/").status_code, status.HTTP_404_NOT_FOUND)


@override_settings(CACHES=LOCMEM_CACHE)
class RateLimitTests(APITestCase):
    def setUp(self):
        from django.core.cache import cache

        cache.clear()
        User.objects.create_user(email="p@example.com", username="p", password="Right!Pass2026")

    def test_repeated_failed_logins_are_slowed_down(self):
        codes = [
            self.client.post("/auth/jwt/create/", {"email": "p@example.com", "password": f"wrong{n}"}, format="json").status_code
            for n in range(11)
        ]
        self.assertEqual(codes[:10], [status.HTTP_401_UNAUTHORIZED] * 10)
        self.assertEqual(codes[10], status.HTTP_429_TOO_MANY_REQUESTS)

    def test_sign_up_is_rate_limited(self):
        codes = [
            self.client.post(
                "/auth/users/",
                {"email": f"bot{n}@example.com", "password": "Rescue!Pass2026", "re_password": "Rescue!Pass2026", "accept_terms": True},
                format="json",
            ).status_code
            for n in range(11)
        ]
        self.assertEqual(codes[:10], [status.HTTP_201_CREATED] * 10)
        self.assertEqual(codes[10], status.HTTP_429_TOO_MANY_REQUESTS)

    def test_google_sign_in_is_rate_limited(self):
        codes = [self.client.post("/auth/google/", {}, format="json").status_code for _ in range(11)]
        self.assertEqual(codes[10], status.HTTP_429_TOO_MANY_REQUESTS)

    def test_password_reset_codes_are_rate_limited_per_client(self):
        codes = [
            self.client.post("/auth/password-reset/confirm/", {"email": "p@example.com", "code": "000000", "new_password": "x"}, format="json").status_code
            for _ in range(11)
        ]
        self.assertEqual(codes[10], status.HTTP_429_TOO_MANY_REQUESTS)

    def test_signed_in_users_are_not_limited_by_the_login_limit(self):
        user = User.objects.get(email="p@example.com")
        self.client.force_authenticate(user=user)
        codes = {self.client.get("/auth/me/").status_code for _ in range(15)}
        self.assertEqual(codes, {status.HTTP_200_OK})


class ImageUploadValidationTests(SimpleTestCase):
    def test_a_real_image_passes(self):
        validate_image_upload(make_image_file())

    def test_png_and_webp_pass(self):
        validate_image_upload(make_image_file("a.png", image_format="PNG", content_type="image/png"))
        validate_image_upload(make_image_file("a.webp", image_format="WEBP", content_type="image/webp"))

    def test_text_pretending_to_be_an_image_is_refused(self):
        fake = SimpleUploadedFile("photo.jpg", b"<script>alert(1)</script>", content_type="image/jpeg")
        with self.assertRaisesMessage(ValidationError, "isn't a photo"):
            validate_image_upload(fake)

    def test_svg_is_refused(self):
        svg = SimpleUploadedFile("logo.svg", b"<svg xmlns='http://www.w3.org/2000/svg'></svg>", content_type="image/svg+xml")
        with self.assertRaises(ValidationError):
            validate_image_upload(svg)

    @override_settings(MAX_UPLOAD_BYTES=100)
    def test_oversized_files_are_refused(self):
        with self.assertRaisesMessage(ValidationError, "smaller than"):
            validate_image_upload(make_image_file(size=(64, 64)))

    def test_file_position_is_rewound_after_checking(self):
        image = make_image_file()
        validate_image_upload(image)
        self.assertEqual(image.tell(), 0)


class UniqueUploadPathTests(SimpleTestCase):
    def test_original_file_names_are_not_kept(self):
        path = UniqueUploadPath("receipts")(None, "Ali Khan bank statement.JPG")
        self.assertTrue(path.startswith("receipts/"))
        self.assertTrue(path.endswith(".jpg"))
        self.assertNotIn("Ali", path)
        self.assertGreaterEqual(len(Path(path).stem), 32)

    def test_every_upload_gets_a_new_name(self):
        upload_to = UniqueUploadPath("reports")
        self.assertNotEqual(upload_to(None, "a.png"), upload_to(None, "a.png"))

    def test_unexpected_extensions_are_dropped(self):
        self.assertTrue(UniqueUploadPath("posts")(None, "evil.php").endswith(".bin"))

    def test_it_can_be_written_to_migrations(self):
        self.assertEqual(UniqueUploadPath("chat").deconstruct()[1], ("chat",))
