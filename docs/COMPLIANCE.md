# Launch compliance checklist

What was checked before deployment, what changed, and what is still open. "Web" is the
React site, "Mobile" the Expo app, "Backend" the Django API.

## Checklist

| # | Item | Result |
|---|------|--------|
| 1 | Privacy policy page | Done. Web `/legal/privacy` (also `/privacy`), Mobile Profile → Policies. Describes only what the code collects. |
| 2 | Terms & conditions page | Done. Web `/legal/terms` (also `/terms`), Mobile same. |
| 3 | Cookie policy | Done. Web `/legal/cookies`. |
| 4 | Cookie consent needed? | No banner needed: the site stores only its sign-in tokens (strictly necessary) and sets no analytics or advertising cookies. The cookie policy says so and promises to ask first if that ever changes. |
| 5 | Refund policy | Done as "Donations & Refunds" (`/legal/donations`). StrayAid never holds money; refunds are between the giver and the organization. |
| 6 | Form consent | Sign-up needs a ticked Terms/Privacy box (web and mobile) and the backend refuses sign-ups without it and records `accepted_terms_at`. Google sign-in shows the same notice. Adoption form: consent to share answers with the rescue team. Sponsorship form: confirmation that the transfer is genuine plus the refund policy link. Team registration: confirmation of authority and true details. |
| 7 | Only collect necessary data | Reviewed every model. No extra data found; phone and area are optional. Report location is the animal's, not a tracked position. Upload file names are replaced with random names so they can't leak names or be guessed. |
| 8 | Analytics / tracking | None in web, mobile or backend. No analytics SDKs, pixels or advertising IDs. |
| 9 | Third-party embeds | Google Fonts removed (fonts are self-hosted). Remaining third parties are listed in the privacy policy: Google sign-in (only when used), OpenStreetMap tiles, Expo push, Gmail SMTP, the host. Unused third-party UI components with outside links were deleted. |
| 10 | Accessibility | Web: `eslint-plugin-jsx-a11y` (0 errors), axe tests on the public pages, settings and dialogs, dialogs trap and return focus, step errors are announced. Mobile: every tappable element has a role (checked by a test), long-press-only rows have screen-reader actions. |
| 11 | Alt text on images | Web lint enforces it; decorative images use `alt=""`. Landing test checks every image has `alt`. |
| 12 | Colour contrast | Tests check WCAG AA (4.5:1) on both apps' colour tokens and scan every stylesheet / StyleSheet for faint text. 26 web and 38 mobile text colours were darkened; the danger red and mobile supporting grey tokens were adjusted. |
| 13 | Keyboard-friendly forms | Labels on every field, `aria-invalid`/`aria-describedby` on errors, dialogs reachable and closable by keyboard, dashboard case rows are real links (no clickable `<li>` with buttons inside). |
| 14 | Clear button labels | Icon-only buttons have `aria-label` / `accessibilityLabel`; destructive actions say exactly what they do ("Delete my account", "Keep my account"). |
| 15 | Fake reviews | The four placeholder landing testimonials were removed. |
| 16 | Unsupported claims | Removed "in under a minute", "finds the closest team", "is alerted", "verified banking information". The landing numbers only show once there are real rescues. |
| 17 | Real business details | Footer and every policy say who runs StrayAid (the project team, a BSSE final-year project, not a registered charity or company) and the area served. **Open:** set `VITE_CONTACT_EMAIL` / `EXPO_PUBLIC_CONTACT_EMAIL` to a real team address before launch. |
| 18 | Image copyright | Landing photos are from Pexels (free licence) and credited. Downloaded demo photos never reach a live server (see risk 1). |
| 19 | Local laws | See below. |
| 20 | Other risks | See below. |

## Local laws (Pakistan) and store rules

- **Prevention of Electronic Crimes Act 2016 (as amended):** StrayAid hosts user posts,
  comments and chats. The terms forbid unlawful, abusive and misleading content, and
  organizations can decline cases. A way to report a post or user would help with takedown
  requests (not built yet).
- **Personal data:** Pakistan's personal data protection bill is not yet law. The privacy
  policy follows its principles anyway: purpose limitation, minimal data, access and
  deletion on request, a 30-day reply promise.
- **Prevention of Cruelty to Animals Act 1890:** adoption and care decisions stay with the
  organizations; the terms say so.
- **Donations:** StrayAid processes no payments, so no payment licence applies. Organizations
  receive transfers directly and are responsible for them.
- **Google Play:** needs a privacy policy URL (`https://<site>/privacy`), in-app account
  deletion (done) and a web page explaining it (`https://<site>/delete-account`), the Data
  safety form (fill it from the privacy policy's "What we collect" section), and a content
  rating. Target audience 13+, matching the terms.

## Security work done before deployment

- No secrets in the code: settings read everything from environment variables; production
  refuses to start without `DJANGO_SECRET_KEY`; `DEBUG` is off by default.
- HTTPS hardening (redirect, HSTS, secure cookies, proxy header), `check --deploy` passes
  in CI.
- Rate limits on login, sign-up, Google sign-in and password reset; general per-client limits.
- Google access tokens must have been issued to StrayAid's own client IDs.
- Uploads: real images only, size limit, random names. Coordinates validated.
- Unused auth packages (allauth, dj-rest-auth, token auth) and their extra endpoints removed.
- Demo seeding refuses to run on a live server unless `--production` and a strong
  `DEMO_PASSWORD` are given, and never creates an admin with a known password.
- Web security headers (CSP, HSTS, frame, referrer, permissions) for Vercel and nginx.
- Backend image runs as a non-root user with a health check (`/api/health/`).
- Dependencies: backend and web have no known vulnerabilities; CI audits them on every push.
- The mobile `.env`, Google client files and uploaded media are no longer tracked.

## Risks to act on

1. **Demo photos are not ours.** `images/` includes a Shutterstock preview, a BBC image, a
   VIER PFOTEN photo and other downloaded pictures. They are used only when seeding a local
   computer; `seed_demo_data --production` swaps every one of them for the team's own Stitch
   images (tested). Replace them with Pexels or your own photos if the demo ever needs them
   publicly.
2. **Old secrets are still in git history.** The previous Django secret key and local
   database password were committed in `settings.py`. Neither is used any more (production
   gets a new key from the environment), but change the local Postgres password if it is
   used anywhere else. The Google client JSON had no client secret, so nothing needs
   rotating there.
3. **Demo data on the live site would look like real activity.** If the viva needs the live
   site seeded, say on the site that it is demo data.
4. **Uploaded files are public URLs.** Receipts and chat photos have unguessable names but no
   access check. Serving them through an authenticated view is a follow-up.
5. **No in-app reporting of abusive content** (see PECA above).
6. **Mobile build tooling advisories:** 12 npm advisories remain inside Expo's own build
   tools; they need an Expo SDK upgrade, not a patch.
