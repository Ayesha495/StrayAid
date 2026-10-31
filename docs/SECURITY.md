# StrayAid security

What protects the app, how each control was tested, and what is still open. It follows the OWASP
API Security Top 10 and the Information Security course's Database Security lecture (CLO 4).

## Threats that matter for StrayAid

| Asset | Who wants it | Worst outcome |
|-------|--------------|---------------|
| Organizations' bank details | Fraudsters | Donations are sent to an attacker |
| Adoption applications (name, phone, home) | Stalkers, scammers | Personal data leaks |
| Reporters' identity and movements | Anyone | Someone is linked to places and times |
| Receipts and private chat photos | Anyone | Financial details leak |
| Adoption outcome | Applicants, buggy clients | An animal is promised to two families |

## Lecture controls and where they are

| Lecture topic | StrayAid | Status |
|---------------|----------|--------|
| 3-tier architecture | Client, Django API, Postgres. Clients never hold database credentials. | Done |
| Parameterised queries | Every query uses the Django ORM. The only raw SQL is the constant `SELECT 1` health check. `bandit` scans for new raw SQL in CI. | Done, tested |
| Input validation | Allow-lists for status filters, numeric ids checked, search text capped at 100 characters, NUL bytes removed, addresses stripped of control characters. | Done, tested |
| Hide errors, log them | `DEBUG` is off in production; no stack traces reach clients. | Done |
| Least-privilege DB account | `backend/deploy/least_privilege.sql` creates `strayaid_app` (rows only, no schema changes). `migrate` uses a separate owner URL. | Script tested; **switch-over needed in production** |
| RBAC | Public, organization roles. `IsOrganizationUser` needs the role and a real profile. API is closed by default (`IsAuthenticated`). | Done, tested |
| Object-level checks (BOLA) | Querysets are scoped to the owner; another team's records return 404. | Done, tested |
| Views (expose chosen columns) | Public serializers are the app's views: no reporter identity, no account details. | Done, tested |
| Row-level security | Not used. See "Decisions" below. | Not done, on purpose |
| ACID transactions | Adoption decisions, applications, case acceptance and money checks run in `transaction.atomic`. | Done |
| Locking, race conditions | `SELECT ... FOR UPDATE` on the animal, case or pledge, with the state re-read after the lock. | Done, tested on Postgres |
| Entity and referential integrity | Primary and foreign keys; partial unique constraints for one approved application per animal and one active application per person; check constraints on coordinates and amounts. | Done, tested |
| Aggregation and inference | Sponsor initials hidden below 3 sponsors; public reports carry no reporter name; the audit log holds ids, not personal details. | Done, tested |
| Accounting, audit logs | `AuditEvent`: failed logins, adoption decisions, case acceptance, money checks, bank detail changes. Read-only in admin; add-only for the app's DB role. | Done, tested |
| Retention, minimisation | `purge_audit_log` removes events after 180 days; deleting an account clears its IP addresses. | Done; **needs scheduling** |
| Encryption in transit | HTTPS with HSTS for clients; TLS required to Neon. | Done |
| Encryption at rest | Provided by Neon and Render. Backups are AES-256 encrypted before upload. | Done by the providers; backup workflow **needs turning on** |
| Key management | Secrets only in environment variables; CI scans for leaked secrets. | Done |
| Backup and recovery | Neon's restore window, plus the nightly encrypted dump in `backup.yml`. | **Needs turning on, and a test restore** |
| Patching | `pip-audit` and `npm audit` in CI. | Done |
| Masked test data | Tests use fake data; demo data is synthetic. | Done |
| Treat AI output as untrusted | Reviewed, attack tests, `bandit` and dependency scans. | Done |

### Topics that don't apply

- **Multilevel security, Bell-LaPadula, Biba, polyinstantiation:** for labelled classified data.
  StrayAid has two roles and no clearance levels.
- **Distributed databases, 2PC:** there is one database, so one transaction is enough.
- **Data warehouses, ETL:** StrayAid has no analytics store.
- **LLM assistants, RAG, vector databases:** the only AI is an image detector. It reads photos
  and never touches the database, so prompt injection has nothing to reach.
- **NoSQL:** Redis holds only rate-limit counters, on a private network with no personal data.

## Load balancing

`docker compose up` runs nginx in front of two backend servers (`deploy/nginx/loadbalancer.conf`)
using least-connections, with failover and per-client rate limiting. Redis gives every server
the same rate-limit counters, and migrations run once in their own container.

**Production is different.** Render's free plan runs one instance, so the live site has no
second server to balance to. Scaling up needs a paid instance. Render's own balancer then
spreads traffic, and `REDIS_URL` must be set so limits stay shared. Each instance also needs
about 512 MB for the AI model.

## Decisions

- **No Postgres row-level security.** All requests share one database role, so RLS would need
  the user set on the connection for every request, and admin, signals and background jobs would
  each need a bypass. A mistake there breaks rescues or quietly bypasses the policy. Ownership
  is enforced in scoped querysets instead, with attack tests. This is the first control to add
  if the app grows beyond a final-year project.
- **Reporter emails only for the team that accepted the case.** Teams can self-register, so the
  organization role alone doesn't justify seeing them.
- **Unverified teams are still allowed to accept cases**, because nobody can verify them yet
  (there is no admin workflow). A team's `is_verified` can't be set through the API.

## Open items

1. Switch production to the least-privilege role (below).
2. Set the repository secrets and variable for backups, then do one test restore.
3. Schedule `purge_audit_log`, for example monthly.
4. Confirm `CLIENT_IP_HEADER` on Render: after deploying, check that audit events show real
   client addresses rather than proxy ones.
5. JWT refresh tokens last 30 days and can't be revoked after a password change. Rotation with
   a blocklist needs both clients to store the new token.
6. Neon's connection is open to the internet (protected by password and TLS). IP allow-listing
   isn't available to us on the free setup, and Render's free outbound addresses are shared.
7. No multi-factor login for organization accounts, which hold bank details.

## Switching production to the least-privilege role

```bash
psql "$OWNER_DATABASE_URL" -v app_password="<new strong password>" -f backend/deploy/least_privilege.sql
```

On Render, set `MIGRATION_DATABASE_URL` to the current owner URL, then change `DATABASE_URL` to
the same address with `strayaid_app` and the new password. Do these in one step, then redeploy.

## How to run the checks

```bash
cd backend
python manage.py test --settings=config.test_settings           # includes core/test_security.py
python manage.py test core.test_concurrency --settings=config.test_settings_postgres   # real races
bandit -q -r . -x ./venv,./media,./ai_models -ll
```

Sources: [OWASP API Security Top 10](https://owasp.org/API-Security/),
[DRF throttling and NUM_PROXIES](https://www.django-rest-framework.org/api-guide/throttling/),
[Neon plans](https://neon.com/docs/introduction/plans).
