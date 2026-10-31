-- The account the running app connects with. It can read and write rows, and nothing else: no
-- creating or dropping tables, no roles, and it can only add to the audit trail. If SQL
-- injection ever got past the ORM, this is what limits the damage.
--
-- Run once, as the database owner, after the first migration:
--   psql "$OWNER_DATABASE_URL" -v app_password="$APP_PASSWORD" -f deploy/least_privilege.sql
-- Then give the app DATABASE_URL with this role, and keep the owner's URL in
-- MIGRATION_DATABASE_URL, which only `migrate` uses (see docs/SECURITY.md).

SELECT 'CREATE ROLE strayaid_app LOGIN'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'strayaid_app')\gexec

ALTER ROLE strayaid_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD :'app_password';

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO strayaid_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO strayaid_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO strayaid_app;

-- Tables made by later migrations get the same rights.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO strayaid_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO strayaid_app;

-- The audit trail is add-only. Two columns stay writable because deleting an account has to
-- clear the person's IP addresses and unlink them. Old events are purged by the owner.
REVOKE UPDATE, DELETE, TRUNCATE ON accounts_auditevent FROM strayaid_app;
GRANT UPDATE (ip_address, actor_id) ON accounts_auditevent TO strayaid_app;

-- Only migrations change the record of migrations.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON django_migrations FROM strayaid_app;
