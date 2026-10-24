# StrayAid

StrayAid connects people who spot injured stray animals with rescue organizations nearby.
Reporters send a photo and location from the mobile app; rescue teams pick up cases, post
updates, and handle adoptions and sponsorships on the website.

A final-year BSSE project.

## Project layout

```
backend/                     Django + Django REST Framework API
  config/                    settings, URLs, WSGI (test_settings.py for the test suite)
  accounts/ animals/ chat/ notifications/ organizations/ posts/ rescue/
  core/                      shared upload checks, rate limits, health check
frontend/Web/strayaid_web_frontend/        React + Vite website (rescue teams and the public)
frontend/Mobile/strayaid_mobile_frontend/  Expo / React Native app (reporters)
images/                      photos used by the demo data (see docs/COMPLIANCE.md)
docs/                        compliance checklist and deployment guide
.github/workflows/ci.yml     tests, lint, audits and secret scan on every push
```

## Running it locally

**Backend** (Python 3.11, PostgreSQL):

```bash
cd backend
python -m venv venv && venv/Scripts/activate      # macOS/Linux: source venv/bin/activate
pip install -r requirements-dev.txt
cp ../.env.example .env                          # then set DEBUG=1 and POSTGRES_PASSWORD
python manage.py migrate
python manage.py download_ai_model               # free animal detector for report photos
python manage.py seed_demo_data                  # optional demo data
python manage.py runserver
```

**Website:**

```bash
cd frontend/Web/strayaid_web_frontend
cp .env.example .env.local
npm install
npm run dev
```

**Mobile app:**

```bash
cd frontend/Mobile/strayaid_mobile_frontend
cp .env.example .env
npm install
npx expo start                                   # add --tunnel if the phone can't reach the PC
```

## Tests

| Part | Command | What it covers |
|------|---------|----------------|
| Backend | `python manage.py test --settings=config.test_settings` (in `backend/`) | API, permissions, production settings, rate limits, uploads, account deletion, demo seeding |
| Website | `npx jest` | Pages, forms and consent, policies, axe accessibility checks, colour contrast |
| Mobile | `npx jest` | Sign-up consent, policies (must match the website's), account deletion, accessibility roles, colour contrast |

## Configuration and secrets

Every secret and environment-specific setting is an environment variable; see
`.env.example` (backend), `frontend/Web/strayaid_web_frontend/.env.example` and
`frontend/Mobile/strayaid_mobile_frontend/.env.example`. Never commit a `.env` file.

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Policies and launch checks are in
[docs/COMPLIANCE.md](docs/COMPLIANCE.md).
