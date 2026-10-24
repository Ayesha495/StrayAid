import os

# Tests run the same on every machine: the developer's own .env is not read.
os.environ["DJANGO_ENV_FILE"] = os.devnull
os.environ.setdefault("DJANGO_SECRET_KEY", "test-only-secret-key-never-used-outside-the-test-suite")
os.environ.setdefault("GOOGLE_OAUTH_CLIENT_IDS", "test-web-client.apps.googleusercontent.com,test-android-client.apps.googleusercontent.com")

from .settings import *  # noqa: E402, F401, F403

DEBUG = False
SECURE_SSL_REDIRECT = False
GOOGLE_OAUTH_CLIENT_IDS = env_list("GOOGLE_OAUTH_CLIENT_IDS")  # noqa: F405
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "test_db.sqlite3",  # noqa: F405
    }
}

# Rate limits are counted in the cache; tests that check them switch to a real one.
CACHES = {"default": {"BACKEND": "django.core.cache.backends.dummy.DummyCache"}}

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# Score reports inside the request so tests see the result straight away.
AI_SCORE_IN_BACKGROUND = False

MIGRATION_MODULES = {
    "accounts": None,
    "notifications": None,
    "animals": None,
    "chat": None,
    "organizations": None,
    "posts": None,
    "rescue": None,
}
