# Deploying StrayAid

Production runs from the **`main`** branch, on free plans:

| Part | Service | How it gets deployed |
|------|---------|----------------------|
| Database | Neon Postgres (project `bitter-block-07976299`, branch `production`, us-east-2) | CI applies `neon.ts`; Django migrations run when the backend starts |
| Backend | Render web service `strayaid-api` (Docker, Ohio) from `render.yaml` | CI calls Render's deploy hook, then waits for `/api/health/` |
| Website | Vercel, root directory `frontend/Web/strayaid_web_frontend` | CI runs `vercel build --prod` and `vercel deploy --prebuilt --prod` |
| Android app | EAS (account `ayesha495`) | APKs are built by hand with `eas build`; CI publishes over-the-air updates to the `production` channel when app code changes |

## The pipeline (`.github/workflows/ci.yml`)

Every push and pull request runs the checks: backend, web, mobile and the secret scan.
A push to `main` that passes all of them continues:

```
checks ─► deploy-database ─► deploy-backend ─┬─► deploy-web
                                             └─► deploy-mobile (only if frontend/Mobile changed)
```

Render and Vercel don't deploy `main` on their own (`autoDeployTrigger: "off"` in
`render.yaml`, `git.deploymentEnabled.main: false` in `vercel.json`), so nothing reaches
production without passing the checks. Other branches still get Vercel preview links.

## One-time setup

### GitHub (Settings → Environments → New environment → `production`)

Secrets:

| Secret | Where to get it |
|--------|-----------------|
| `NEON_API_KEY` | Neon → Account settings → API keys |
| `RENDER_DEPLOY_HOOK_URL` | Render → strayaid-api → Settings → Deploy Hook |
| `VERCEL_TOKEN` | vercel.com/account/tokens |
| `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | Vercel → project → Settings → General (Project ID); Team/Account Settings (ID) |
| `EXPO_TOKEN` | expo.dev → Account settings → Access tokens |

Variables:

| Variable | Value |
|----------|-------|
| `BACKEND_URL` | `https://strayaid-api.onrender.com` (no trailing slash) |
| `WEBSITE_URL` | the Vercel production address |

### Render

New → Blueprint → this repo. Fill in `DATABASE_URL` with Neon's **direct** connection string
(the one without `-pooler`), `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` with the website
address, and optionally `EMAIL_HOST_PASSWORD` (a Gmail app password for strayaid0@gmail.com).

### Vercel

Import the repo, Root Directory `frontend/Web/strayaid_web_frontend`, environment variables
`VITE_API_URL=https://strayaid-api.onrender.com` and `VITE_GOOGLE_CLIENT_ID`. Set
Production Branch to `main`. Add the site address to the Google OAuth web client's authorised
JavaScript origins.

### Android APK

```bash
cd frontend/Mobile/strayaid_mobile_frontend
eas build -p android --profile production
```

Share the download link from the build page. Build again after native changes (new native
libraries, an Expo SDK upgrade or a version bump); everything else arrives through the
pipeline's over-the-air updates. Register the build's SHA-1 (`eas credentials -p android`)
on the Android OAuth client for Google sign-in.

## After the first deploy, check

- [ ] The pipeline's deploy jobs are green on the push to `main`.
- [ ] `https://strayaid-api.onrender.com/api/health/` shows `{"status":"ok"}`.
- [ ] https://securityheaders.com gives the website an A.
- [ ] Sign up (terms box), log in, Google sign-in, password reset email, delete account.
- [ ] Report from a phone, change status on the website, push notification arrives.
- [ ] Turn on GitHub secret scanning and Dependabot alerts in the repository settings.

Render's free plan sleeps after 15 idle minutes (the first request then takes ~30–50 s) and
has no permanent disk, so uploaded photos are lost on each redeploy until file storage is
moved to an object store.
