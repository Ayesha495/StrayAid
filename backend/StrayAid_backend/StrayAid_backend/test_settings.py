from .settings import *


DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "test_db.sqlite3",
    }
}

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# Score reports inside the request so tests see the result straight away.
AI_SCORE_IN_BACKGROUND = False

MIGRATION_MODULES = {
    "accounts": None,
    "notifications": None,
    "animals": None,
    "organizations": None,
    "posts": None,
    "rescue": None,
}
