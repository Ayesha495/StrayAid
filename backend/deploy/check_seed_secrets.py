"""Run by the "Seed demo data" workflow before seeding. It checks the two secrets, repairs the
usual paste mistakes in the database address, and explains any problem as a GitHub annotation.
It never prints a secret's value, only what is wrong with it."""

import os
import re
import sys
from urllib.parse import unquote, urlparse

import psycopg2

MIN_PASSWORD_LENGTH = 12


def problem(message):
    print(f"::error title=Demo data::{message}")


def tidy(address):
    """Neon's page offers `psql 'postgresql://...'`, and pasted text can carry spaces or quotes."""
    found = re.search(r"postgres(?:ql)?://[^\s'\"]+", address)
    return found.group(0) if found else address.strip()


def check_password():
    password = os.getenv("DEMO_PASSWORD", "")
    if not password:
        problem("The DEMO_PASSWORD secret is empty or missing. Add it under Settings > Environments > production.")
        return False
    if len(password) < MIN_PASSWORD_LENGTH:
        problem(f"DEMO_PASSWORD has {len(password)} characters; it needs at least {MIN_PASSWORD_LENGTH}.")
        return False
    return True


def check_database():
    raw = os.getenv("DATABASE_URL", "")
    if not raw.strip():
        problem("The PRODUCTION_DATABASE_URL secret is empty or missing. Add it under Settings > Environments > production.")
        return False
    address = tidy(raw)
    parsed = urlparse(address)
    if parsed.scheme not in ("postgres", "postgresql") or not parsed.hostname:
        problem("PRODUCTION_DATABASE_URL isn't a database address. It should start with postgresql:// and hold the host.")
        return False
    if address != raw:
        print(f"::add-mask::{address}")
        print("The database address had extra text around it; using the address inside it.")
        with open(os.environ["GITHUB_ENV"], "a", encoding="utf-8") as env:
            env.write(f"DATABASE_URL={address}\n")
    try:
        connection = psycopg2.connect(
            host=parsed.hostname,
            port=parsed.port or 5432,
            user=unquote(parsed.username or ""),
            password=unquote(parsed.password or ""),
            dbname=unquote(parsed.path.lstrip("/")),
            sslmode="require",
            connect_timeout=30,
        )
        with connection.cursor() as cursor:
            cursor.execute("SELECT to_regclass('public.rescue_case') IS NOT NULL")
            if not cursor.fetchone()[0]:
                problem("That database has no StrayAid tables, so it's the wrong database or branch. Use Neon's production branch.")
                return False
        connection.close()
    except psycopg2.OperationalError as error:
        text = str(error).lower()
        if "password authentication failed" in text:
            problem("Neon refused the username or password in PRODUCTION_DATABASE_URL. Copy a fresh address from Neon.")
        elif "does not exist" in text:
            problem("The database or user named in PRODUCTION_DATABASE_URL doesn't exist on that server.")
        elif "translate host" in text or "name or service not known" in text:
            problem("The host in PRODUCTION_DATABASE_URL can't be found, so the address is incomplete.")
        else:
            problem(f"Couldn't connect to the database ({type(error).__name__}). Check PRODUCTION_DATABASE_URL.")
        return False
    return True


if __name__ == "__main__":
    # Both are checked every time, so one run reports everything that's wrong.
    results = [check_password(), check_database()]
    sys.exit(0 if all(results) else 1)
