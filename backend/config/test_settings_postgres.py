"""The tests on real Postgres with the real migrations: row locks and races can only be proved
on the database production uses (SQLite has neither)."""

import os

from .settings import database_from_url
from .test_settings import *  # noqa: F401, F403

DATABASES = {
    "default": database_from_url(os.environ["DATABASE_URL"])
    if os.getenv("DATABASE_URL")
    else {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("POSTGRES_DB", "strayaid_db"),
        "USER": os.getenv("POSTGRES_USER", "postgres"),
        "PASSWORD": os.getenv("POSTGRES_PASSWORD", ""),
        "HOST": os.getenv("POSTGRES_HOST", "localhost"),
        "PORT": os.getenv("POSTGRES_PORT", "5432"),
    }
}
MIGRATION_MODULES = {}
