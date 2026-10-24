# Deploying StrayAid (free tiers only)

Everything the code needs before deployment is in place (see COMPLIANCE.md). This page is
the order of work for going live, and what to check after.

## 1. Before the first deploy

- [ ] Decide the hosts. Any of these work with the current setup:
  - Backend: Render free web service (uses `backend/Dockerfile`), or an Oracle Cloud Always
    Free VM with `docker-compose.yml` behind Caddy (the plan in StrayAid_Spec.md).
  - Database: Neon or Supabase free Postgres (`DATABASE_URL`), or the compose Postgres.
  - Website: Vercel (reads `vercel.json`, which sets the security headers).
  - Mobile: EAS Build free plan.
- [ ] Generate a new `DJANGO_SECRET_KEY` for production (never reuse a local one).
- [ ] Pick a team contact email for the footer and policies.
- [ ] Replace or remove the downloaded photos in `images/` if the live site will be seeded.

## 2. Backend

Set these on the host (values in `.env.example`):

| Variable | Production value |
|----------|------------------|
| `DJANGO_SECRET_KEY` | new random value |
| `DEBUG` | `0` |
| `ALLOWED_HOSTS` | the API's hostname |
| `DATABASE_URL` | from Neon / Supabase |
| `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` | the website's `https://` origin |
| `GOOGLE_OAUTH_CLIENT_IDS` | web, Android and iOS client IDs |
| `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD` | Gmail + app password |
| `SERVE_MEDIA` | `1` unless a separate file server serves `/media/` |
| `ADMIN_URL` | something other than `admin/` |

The container runs migrations on start. Health check: `GET /api/health/`.

Free hosts usually wipe the disk on redeploy, so uploaded photos need a persistent disk or
volume (Render disks are paid; the Oracle VM volume is free). Plan this before real users
upload anything.

## 3. Website

On Vercel: root directory `frontend/Web/strayaid_web_frontend`, build `npm run build`,
output `dist`, and the variables `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`, `VITE_CONTACT_EMAIL`.
Then add the site's origin to the Google OAuth web client's authorised JavaScript origins.

## 4. Mobile

1. Set `EXPO_PUBLIC_API_URL` (and the Google and contact variables) for the `production`
   profile in `eas.json` or as EAS environment variables.
2. `eas build -p android --profile production`.
3. Register the EAS keystore's SHA-1 on the Android OAuth client.
4. Play Console: privacy policy URL `https://<site>/privacy`, account deletion URL
   `https://<site>/delete-account`, Data safety form (from the privacy policy), content
   rating, closed test with 12 testers for 14 days (new personal accounts), then production.

## 5. After deploying, check

- [ ] `python manage.py check --deploy` on the server prints no warnings.
- [ ] https://securityheaders.com gives the website an A.
- [ ] Sign up (terms box), log in, Google sign-in, password reset email, delete account.
- [ ] Report from a phone, change status on the website, push notification arrives.
- [ ] Policies open from the footer, the sign-up screen and the app's profile.
- [ ] Turn on GitHub secret scanning and Dependabot alerts in the repository settings.
