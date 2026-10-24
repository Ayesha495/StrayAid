# StrayAid: Spec for the Remaining Work

Agreed on 4 Oct 2026. Final FYP submission is **under 4 weeks** away; the plan assumes **1 Nov 2026** until the real date is confirmed.

The committee needs:
- docs (SRS, SDS, report) that match what's built
- testing evidence

---

## 0. Progress tracker (last checked 15 Oct 2026)

Checked against the code on the `Ayesha` branch, including uncommitted work. Legend: ✅ done · 🟡 partly done · ❌ not started.

| Area | Status | Summary |
| --- | --- | --- |
| Week 1: mobile dev build | 🟡 | `expo-location` fixed, `app.json` comma fixed, push registers after login, local networking fixed. Firebase, Maps key, hosted URL and the rebuild are still open. |
| Week 1: repo and security | 🟡 | emaan merged; `__pycache__` and SQLite are untracked and ignored. Mobile `.env` and the Google client files are still tracked; the secret hasn't been rotated; `settings.py` still has the hard-coded key. |
| Week 1: deployment | ❌ | `docker-compose.yml` exists; no VM, Caddy, domain or end-to-end test yet. |
| Week 1: design system | 🟡 | Mobile light tokens (`theme/tokens.ts`) plus `Button`, `Input` and `Toggle`. No dark tokens, no web tokens, no API contract doc. |
| Backend features (1–11) | 🟡 | AI score, notifications inbox, case follows (with animal auto-follow), animal-update notifications, adoption, chat, sponsorship and community are mostly built. Role rename, status rules, preferences, block and story upload are missing. Delete account is done (anonymises, 24 Oct). |
| Mobile features | 🟡 | Most screens are built (Stitch redesign). Settings switches and dark mode are missing. Delete account is done (Profile → Delete account). |
| Web features | 🟡 | Guest routes exist; the case map frames the pins and shows the org's service area (15 Oct). Other new feature screens aren't built (the notification bell is only an icon). |
| Tests | 🟡 | 157 Django tests, all passing. 1 Jest test file, 1 Playwright smoke test. No CI workflow. |
| Docs (SRS/SDS/report) | ❌ | Not updated in the repo. |

**Fixed on 15 Oct 2026 (mobile "network error"):**
- In development the app now calls Django **through the Expo dev server**. `metro.config.js` forwards `/api`, `/auth`, `/media`, `/accounts`, `/admin` and `/static` from port 8081 to Django on the same PC, and `services/apiConfig.ts` points the app at the address it was loaded from.
- No IP needs updating any more: `update-ip.js` was removed, and `.env` keeps `EXPO_PUBLIC_API_URL` empty for local work.
- No Windows Firewall rule for port 8000 and no `0.0.0.0` are needed: plain `python manage.py runserver` works. It also works with `npx expo start --tunnel` (e.g. on campus Wi-Fi that blocks phone-to-PC traffic).
- Checked over the Wi-Fi IP through port 8081: feed, photo URLs, login, signed-in calls and a multipart photo upload (`check-photo`) all work.
- Set `EXPO_PUBLIC_API_URL` to the hosted HTTPS backend for release builds; a hosted URL always wins.
- Also fixed: the invalid trailing comma in `app.json`, and `test_settings.py` missing the new `chat` app (the test suite couldn't start).

**Built beyond this spec** (to cover in the SRS):
- case history (`CaseUpdate`) and org notes
- "report incorrect AI detection" (`AIFeedback`)
- search
- saved posts, comment likes and pinning
- story "seen" tracking
- shelter donations (`ShelterDonation`)
- profile impact and activity
- urgent radius alerts
- offline report queue
- per-chat notification grouping
- chat photos

---

## 1. How we work

- **Who builds it:** Ayesha builds everything (backend, web, mobile). Commit credit is split across Ayesha, Emaan and Kashaf, following the work areas in section 9.
- **Branch:** all work stays on the `Ayesha` branch.
  - **Nothing is pushed to `main`.** Ayesha reviews with the team and supervisor first; then the team merges to `main`.
  - Nothing is pushed to the remote unless Ayesha asks.
- **Commits:**
  - Credited to the teammate whose area the work belongs to, using these git identities:
    - Ayesha495 `<ayescapade@gmail.com>`
    - kashafchh `<kashafch26@gmail.com>`
    - devcomx-1122 `<devcomx1122@gmail.com>` (assumed to be Emaan; to be confirmed)
  - No AI mentions or co-author lines, in commits or PRs.
- **Never commit:** secrets, `.env` files, `__pycache__`, `venv` or SQLite files.
- **Dashboard:** `emaan` is merged into `Ayesha` (commit c67edf2). The conflicting dashboard files took Emaan's version.

---

## 2. Free services only (no budget)

Every service, API and deployment must be free. Where a card is unavoidable, a safeguard makes sure it can never be charged.

| Need | Service | Safeguard |
| --- | --- | --- |
| Hosting | Oracle Cloud Always Free ARM VM, running docker-compose (Django, Postgres, media, AI model) | Only "Always Free eligible" shapes; never upgrade to Pay As You Go. Fallback: Azure for Students (university email, no card). |
| Domain + HTTPS | DuckDNS subdomain + Caddy (automatic Let's Encrypt certificates) | Free |
| Database + images | Postgres and a media volume on the same VM | Free (no RDS, no S3) |
| Mobile builds | EAS free plan | Monthly build limit. Fallback: local `npx expo run:android`. |
| Push | Expo Push + Firebase Cloud Messaging (Spark plan) | Free. Needs `google-services.json` + FCM V1 key in EAS. **Not set up yet.** |
| Google sign-in | Google OAuth | Free |
| Mobile maps | Google Maps SDK for Android key on a $0 billing account | Key restricted to package + SHA-1 and Maps SDK only; $1 budget alert; no other APIs |
| Web maps | Leaflet + OpenStreetMap (already used) | Free; keep the attribution |
| AI | Pretrained detector with `onnxruntime`, on the server | No hosted AI APIs |
| Email | Gmail SMTP with an app password | 500 emails a day |
| Payments | None (sponsorship uses an uploaded receipt) | Free |
| CI | GitHub Actions | Free minutes |

---

## 3. Roles

| Role | Who | Can do |
| --- | --- | --- |
| **Guest** | Not logged in | Browse the community feed, posts, stories, and animal and organization pages (read-only) |
| **Reporter** | Anyone who signs up (today's `public` role, renamed) | Report, follow, like, comment, chat, adopt, sponsor, settings |
| **Organization** | Creates an org profile | Same as today, plus review adoptions, confirm sponsorships, inbox, stories |

- ❌ A migration renames `public` to `reporter` and makes reporter the default. Existing `admin` users become reporters. *(Not done: `User.role` still offers `public` / `organization` / `admin`, default `public`.)*
- **No admin role, no admin dashboard and no org verification** in this release.
- ✅ Read endpoints for the feed, posts, stories, animals and orgs no longer need a login. Every write needs one, with the right role.
- 🟡 Mobile and web open straight to the feed as a guest. Any action asks the guest to log in. *(Mobile: done, `app/index.tsx` goes to Home and `auth-sheet.tsx` asks to log in. Web: public `/feed`, `/animals/*` and `/organizations/*` routes exist; `/` is still the landing page.)*

---

## 4. Week 1: blockers

**Mobile dev build** (likely causes found in the code):
- [ ] `expo-location` is pinned to `^55.1.4`, but the app is on SDK 54 (needs `~19.0.x`). This can crash the app at launch.
  - [x] `expo-location` is now `~19.0.8`.
  - [ ] Run `npx expo install --check` and fix every mismatch.
  - [ ] Remove the deprecated `expo-random` (still in `package.json`; not imported anywhere).
- [x] Remove the trailing comma after the `expo-speech-recognition` plugin in `app.json`. *(Fixed 15 Oct.)*
- [ ] Add Firebase (`google-services.json`, `android.googleServicesFile`, FCM V1 key in EAS). Without it, Android push tokens fail and the error is hidden.
- [x] Register the push token after login. *(Done in `services/authService.ts`, and again after reporting and following.)*
- [ ] Add the Google Maps key (`android.config.googleMaps.apiKey`). Without it, the map picker crashes in a dev build.
- [ ] Point `EXPO_PUBLIC_API_URL` to the hosted HTTPS backend (waits on deployment).
  - [x] Local testing: fixed 15 Oct (see section 0). Run `python manage.py runserver` and `npx expo start` (add `--tunnel` if the Wi-Fi blocks phone-to-PC traffic). No IP, `0.0.0.0` or firewall rule needed.
- [ ] Google sign-in: create an Android OAuth client for `com.ayesha4956.strayaid_mobile_frontend` with the EAS keystore SHA-1. *(Not verifiable from the code.)*
- [ ] Rebuild the dev client and check `adb logcat` for any remaining crash.

**Repo and security:**
- [x] Merge `emaan` into `Ayesha` (done, c67edf2).
- [ ] Remove from git and add to `.gitignore`:
  - [x] the mobile `.env`
  - [x] `client_secret_*.json` and `client_*.plist`
  - [x] 164 `__pycache__` files
  - [x] `test_db.sqlite3`
- [ ] Rotate the Google OAuth client secret. The old one is in the git history.
- [x] Move `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, CORS and the Google client IDs into env vars. *(Done 24 Oct: one env-driven `config/settings.py`; see docs/COMPLIANCE.md.)*

**Deployment:**
- [ ] Set up an Oracle Always Free VM running the `docker-compose.yml`. *(The compose file, `Dockerfile` and `.env.example` exist; see docs/DEPLOYMENT.md.)*
- [ ] Put Caddy in front for HTTPS on DuckDNS.
- [ ] Serve `/media/` from the `media_data` volume. Gunicorn doesn't serve images with `DEBUG` off. *(The volume exists in compose; nothing serves it yet.)*
- [ ] Add the domain to Google OAuth origins and set `VITE_API_URL`.
- [ ] Test end to end: report on a phone → change status on web → push arrives.

**Design system:**
- [ ] Spacing, type and colour tokens (light and dark) for web and mobile. *(Mobile light tokens in `theme/tokens.ts` and `styles/mobileTheme.ts`; no dark set; no web tokens.)*
- [ ] Shared components:
  - [x] button (`components/Button.tsx`, mobile)
  - [x] input (`components/Input.tsx`, mobile)
  - [ ] card
  - [ ] round avatar
  - [ ] chip
  - [ ] empty and error states
  - [ ] skeleton loader
- [ ] API contract for every new endpoint (from section 6).

**Week 1 is done when** a dev build logs in against the hosted backend and receives a push. ❌ *Not reached yet.*

---

## 5. Must-have features (all required, no cut order)

| # | Feature | Backend | Web | Mobile | Week |
| --- | --- | --- | --- | --- | --- |
| 1 | Guest / Reporter / Org roles | ❌ Role rename migration; ✅ public reads | 🟡 Guest routes, role checks | ✅ Open as guest; login prompt on actions | 2 |
| 2 | Better notifications | ❌ Send after save, in batches; remove dead tokens; skip the actor; ✅ inbox model; ❌ preferences | ❌ Notification bell for orgs | ✅ Notification inbox | 2 |
| 3 | Rescue updates for reporters | ✅ `CaseFollow`; ✅ follow the animal automatically | — | ✅ "Keep me updated" toggle on Report; turn off from the case page | 2 |
| 4 | AI confidence score (0–100%) | ✅ ONNX detector + score when a report is saved | ❌ Score badge; rank the case list and map | ✅ Severity picker on Report | 2 |
| 5 | Case status rules | ❌ Only allowed status changes | ❌ Only valid next-status buttons | — | 2 |
| 6 | Adoption applications | ✅ Inside the `animals` app (not a separate `adoption` app) | ❌ Review applications | ✅ Apply; My applications | 2–3 |
| 7 | Chat (case threads + DMs) | 🟡 `chat` app, polling | ❌ Org inbox | ✅ DM inbox and threads | 3 |
| 8 | Sponsorship | 🟡 Inside the `animals` app (not a separate `sponsorship` app) | ❌ Confirm or reject receipts | ✅ Pledge, upload receipt, My sponsorships | 3 |
| 9 | Instagram-style community | ✅ Avatars, likes, comments, 24h stories; ❌ story upload API | ❌ Likes, comments, story upload | ✅ Stories row, likes, comments | 3 |
| 10 | Settings | ❌ Preference fields; ✅ delete account by anonymising | ✅ Settings page (incl. delete account) | 🟡 Settings screen; ✅ delete account | 3 |
| 11 | Case map polish | — | 🟡 Restyle `RescueBoard.tsx` (reported cases as pins): pins auto-framed, service-area circle and empty-area hint done 15 Oct; restyle open | — | 4 |

**Feature freeze: 25 Oct.** Week 4 is bug fixes, the redesign sweep, dark mode, tests, docs and a demo rehearsal.

**Full redesign (mobile and web):**
- After the design system, every screen is rebuilt in the new design as its feature is built. Untouched screens get a final sweep.
  - 🟡 Mobile: rebuilt from the Stitch designs, screen by screen. Web: not started.
- Each screen is checked against Nielsen's heuristics:
  - feedback
  - empty and error states
  - consistency
  - touch targets of at least 44 pt

---

## 6. Feature details

### 1. Roles
- ❌ `User.role` choices: `reporter` (default) and `organization`.
- ❌ New `IsReporter` permission, alongside the existing `IsOrganizationUser`.
- ✅ No login needed for:
  - the public feed and posts by animal
  - stories
  - public animal lists and detail pages
  - org detail pages and their animals

### 2. Notifications
- ✅ **New `Notification` model:** user, type, title, body, data (JSON), `is_read`, `created_at`. *(Built with `kind`, `read_at` instead of `is_read`, and `group_key` so a chat shows one entry, not one per message.)*
- ✅ **Endpoints:**
  - `GET /api/notifications/`
  - `POST /api/notifications/{id}/read/`
  - `POST /api/notifications/read-all/`
  - *(extra: `unread-counts/`, `clear-read/`)*
- 🟡 **`notify_users`:**
  - 🟡 Saves a `Notification` for each user ✅ and respects their preferences ❌.
  - 🟡 Skips the user who triggered the event. *(Done for animal updates, case notes and posts: the organization never hears about its own changes. Not yet general in `notify_users`.)*
  - ❌ Sends pushes after the database save, on a background thread, in batches of 100. *(Today: one synchronous request with every token.)*
  - ❌ Deletes tokens Expo reports as `DeviceNotRegistered`.

### 3. Rescue updates for reporters
- ✅ **New model:** `CaseFollow` (user, case).
- ✅ **Reporting:** the report endpoint takes `keep_updated` (default true) and creates the follow. *(Stored as `Report.notify_reporter`; can be changed later through `reports/<id>/keep-updated/`.)*
- ✅ **Case status changes** notify case followers instead of every reporter. *(Only reporters who kept "Keep me updated" on, plus followers.)*
- ✅ **When the Animal record is created,** each case follower automatically follows the animal. *(Reporters who kept "Keep me updated" on follow it too, and everyone gets a "Meet {name}" notification.)*
- ✅ **Animal updates reach the reporter (15 Oct).** Reporters with "Keep me updated" on, case followers and animal followers are notified when the organization:
  - creates the animal's profile
  - changes its status (one notification; the matching case status change stays quiet)
  - edits its name, photo, health, vaccinations, medical notes, story, age, breed, gender or colour (repeat edits refresh one unread entry)
  - posts about it, or adds a note to the case
  - approves an adoption ("adopted")

  The approved applicant gets their own decision message instead. *(`notifications/signals.py`, tests in `notifications/tests.py`.)*
- ✅ **Endpoints:** `POST` / `DELETE /api/notifications/follow/case/{id}/`. *(Built as `POST` / `DELETE /api/cases/public/{id}/keep-updated/`.)*

### 4. AI confidence score ✅
- ✅ **New fields:**
  - `Report.severity` (low / medium / high / critical) and `Report.ai_animal_confidence`
  - `Case.confidence_score` (0–100) and `Case.possibly_invalid`
- ✅ **Detector:** a pretrained COCO detector (SSD-MobileNet or YOLOv8n) exported to ONNX, run with `onnxruntime` and loaded once per worker. Its confidence is the highest score among dog, cat, bird, horse, sheep and cow.
- ✅ **Formula:** score = round(100 × (0.5 × photo + 0.3 × severity + 0.2 × reports) × freshness) *(`rescue/utils/scoring.py`)*
  - photo: the detector confidence of every report photo combined, as "chance at least one photo shows an animal": 1 − (1 − c₁)(1 − c₂)…; one photo is just its own confidence
  - severity: low 0.25 / medium 0.5 / high 0.75 / critical 1
  - reports: 1 → 0.33, 2 → 0.67, 3 or more → 1
  - freshness: 1 for 6 hours after the latest report, then falls linearly to 0.5 at 72 hours and stays there. It only runs while no organization has responded: accepting the case stops the clock, and a new report restarts it.
  - recalculated each time a report merges into the case, when the status changes, when the case page is opened, and (at most every 10 minutes) when score-sorted lists load
- ✅ **Detector:** SSD-MobileNet v1 from the ONNX Model Zoo (Apache-2.0). `python manage.py download_ai_model` fetches it (checksum-verified); `python manage.py check_ai_model` tests it on a dog photo and a logo.
- ✅ **Photos must show an animal.** The app checks the photo as soon as it's picked (`POST /api/cases/check-photo/`) and shows a "No animal found" window asking for a retake. The server checks again on submit and refuses the report (422 `not_an_animal`) if the detector confidence is below 0.3, or answers 503 if the detector isn't available, so false reports can't get through.
- ✅ **One photo per report and per case.** The case page shows the photo of the report that started it; later sightings keep their own photos under Related Reports.
- ✅ **Merging sightings:** a new report joins an open case only if it is within 15 ft, the case had a report in the last 48 hours, it shows the same kind of animal (when known), and the reporter hasn't already reported that case. "reports" in the score counts different people, so one person can't inflate it.
- ✅ **`possibly_invalid`** remains for older reports saved before the photo check (combined photo confidence below 0.3). Nearby cases sort by severity, then score.
- **"Condition"** comes from the severity the reporter picks plus the description. It isn't judged from the photo; say so honestly in the viva.

### 5. Case status rules ❌
*(Not built: `PATCH /api/cases/{id}/update-status/` accepts any valid status, and there is no "release" back to reported.)*

Allowed changes:
- reported → assigned (accept)
- assigned → in_progress, or back to reported (release)
- in_progress → rescued
- rescued → adoption or closed
- adoption → closed

Anything else returns 400.

### 6. Adoption 🟡
- ✅ **`AdoptionApplication`:** animal, applicant, home type, other pets, experience, reason, phone, status, org note, dates. *(In `animals/models.py`, with extra fields from the Stitch form: city, ownership, household, hours alone, care plan, agreements.)*
  - Status: pending / approved / rejected / withdrawn.
  - One pending application per person per animal.
- ✅ **Reporter endpoints** *(built under `/api/animals/`)*:
  - `POST /api/adoptions/` (adoptable animals only) → `POST /api/animals/{id}/apply/`
  - `GET /api/adoptions/mine/` → `GET /api/animals/applications/`
  - `POST /api/adoptions/{id}/withdraw/` → `POST /api/animals/applications/{id}/withdraw/`
- ✅ **Org endpoints** (only the animal's org):
  - `GET /api/adoptions/org/` → `GET /api/animals/applications/` (scoped to the org)
  - `POST /api/adoptions/{id}/approve/` and `/reject/` → one `POST /api/animals/applications/{id}/decide/` with `status`
- ✅ **Approving** marks the animal adopted, rejects the other pending applications and notifies every applicant. The case closes and the reporters are told.

### 7. Chat 🟡
- ✅ **Models:**
  - `Conversation`: reporter, organization, optional case, `last_message_at`, `blocked` *(built with `member` for the reporter, an optional `animal`, and per-side read times; ❌ no `blocked` field)*
  - `Message`: conversation, sender, body, `created_at`, `read_at` *(plus an optional photo)*
- 🟡 **Endpoints:**
  - ✅ `GET` / `POST /api/chat/conversations/` *(new threads via `POST conversations/start/`)*
  - ✅ `GET /api/chat/conversations/{id}/messages/?after=<id>`
  - ✅ `POST` messages
  - ❌ `POST /api/chat/conversations/{id}/block/` (org only)
- ✅ **Updates:** the app checks for new messages every 5 seconds in an open conversation and every 30 seconds in the inbox, plus a push for each new message.
- ❌ **"Who can message me":** any org, orgs I follow, or none.

### 8. Sponsorship 🟡
- 🟡 **`Sponsorship`:** animal, sponsor, amount (PKR), receipt image, status, org note, dates. *(In `animals/models.py`, plus `monthly`.)*
  - Status: pledged → receipt_uploaded → confirmed or rejected. *(Built as pending → confirmed or rejected; the receipt is sent with the pledge.)*
- 🟡 **Endpoints** *(built under `/api/animals/`)*:
  - `POST /api/sponsorships/` → `POST /api/animals/{id}/sponsor/`
  - `POST /api/sponsorships/{id}/receipt/` → receipt is part of the pledge
  - `GET /api/sponsorships/mine/` and `GET /api/sponsorships/org/` → `GET /api/animals/sponsorships/`
  - `POST /api/sponsorships/{id}/confirm/` and `/reject/` → `POST /api/animals/sponsorships/{id}/review/` with `status`
- 🟡 **Confirming** makes the sponsor follow the animal ❌ and notifies them ✅.
- ✅ **Privacy:** only the sponsor and the org can see receipts. The animal page shows the sponsor count.

### 9. Community 🟡
- ✅ **New:** `User.avatar`, `PostLike`, `PostComment`, `Story`.
  - Stories show for 24 hours, using a time filter (no scheduled job).
- 🟡 **Endpoints:**
  - ✅ `POST` / `DELETE /api/posts/{id}/like/`
  - ✅ `GET` / `POST /api/posts/{id}/comments/`
  - ✅ `DELETE /api/posts/comments/{id}/` (the comment author or the post's org)
  - ✅ `GET /api/stories/` (public) → `GET /api/posts/stories/` (grouped by category)
  - ❌ `POST /api/stories/` (org) *(stories exist only through the seed data and Django admin)*
- ✅ **Feed items** add `like_count`, `comment_count` and `liked_by_me`.
- ✅ Only organizations create posts.

### 10. Settings 🟡
- **Contents:**
  - ✅ edit profile and avatar (mobile `profile/edit.tsx`, `/auth/me/profile/`)
  - ❌ change password *(Djoser's `/auth/users/set_password/` exists; no screen)*
  - ❌ notification switches per type (case updates, chat, adoption, sponsorship, posts)
  - ❌ who can message me
  - ❌ dark mode (saved on the device)
  - ✅ about and help (mobile `legal/[doc].tsx`)
  - ✅ logout
  - ✅ delete account
- ❌ **Deleting an account** deactivates the user and clears their name and email. Their cases and reports are kept.

---

## 7. Testing and docs

| Deliverable | What | When | Status |
| --- | --- | --- | --- |
| Django tests | Each new endpoint and permission rule; role tests for guest, reporter and org (55 tests exist today) | With each feature | 🟡 157 tests, all passing on 15 Oct. `chat ... test_unread_counts_notifications_and_reading` failed once in a full run and passed on rerun, so it's flaky. No role tests yet. |
| Score tests | Formula with a fixed detector output; a real photo vs a non-animal photo | Week 2 | ✅ In `rescue/tests.py`. |
| Web Jest tests | Adoption review, receipt confirmation, guest feed, settings form | With each screen | 🟡 Only `FeedContent.test.tsx`. |
| Web Playwright | Guest browses the feed; org accepts a case | Week 4 | 🟡 Only `tests/e2e/smoke.spec.ts`. |
| Mobile manual test cases | Steps and expected results per screen, run on a real phone | Week 4 | ❌ |
| SRS / SDS | Use cases, roles table, class diagram, sequence diagrams for report → rescue → adoption | Updated weekly | ❌ |
| Test report | Pass counts and coverage (`coverage run manage.py test`) | Week 4 | ❌ |
| Demo script | Guest browses → signs up → reports → org accepts → push → chat → adoption → sponsorship | Week 4 rehearsal | ❌ (demo data exists: `python manage.py seed_demo_data`) |

Every PR runs the Django and Jest tests on GitHub Actions. A failing PR is not merged. ❌ *No `.github/workflows` yet.*

Run the Django tests with `python manage.py test --settings=config.test_settings` (from `backend/`, using `backend/venv`).

---

## 8. Out of scope (future work)

- admin role and dashboard
- org verification
- volunteer/staff assignment
- lost & found
- posts by reporters
- escalating cases no org accepts
- real payment gateway
- live (WebSocket) chat
- custom-trained AI model
- Urdu / translations
- PostGIS
- S3

`Case.assigned_to`, the unused `is_verified` field, and `Conversation` (which could later allow user-to-user chat) are kept so these can be added later.

---

## 9. Timeline and commit credit

| Week | Ayesha (backend, mobile) | Emaan (web, docs) | Kashaf (web, docs) |
| --- | --- | --- | --- |
| 1 · Oct 5–11 | Fix dev build, deploy to Oracle, secrets cleanup, merge emaan | Design tokens, web components, API contract | Mobile tokens, shared components, API contract |
| 2 · Oct 12–18 | Role rename, notifications, AI score, adoption, status rules, mobile Report | Adoption review, score on case list, status buttons, notification bell | Guest web routes, feed redesign, SDS diagrams |
| 3 · Oct 19–25 | Chat, sponsorship, community and settings APIs; mobile wiring | Org chat inbox, mobile screens UI, SRS updates | Receipt confirmation, likes and comments, story upload, settings page |
| 4 · Oct 26–Nov 1 | Bug fixes, Django tests, demo data, deploy freeze | Map polish, redesign sweep, mobile test cases | Playwright tests, test report, dark mode sweep |

**Gates:**
- push works on a phone by **Oct 11** ❌ *missed: needs Firebase and a dev build*
- feature freeze **Oct 25**
- demo **Nov 1** (assumed)

**Still open, as of 15 Oct** (in suggested order):
1. Backend: role rename, status rules, sponsorship-confirm follow, `notify_users` (skip actor, background batches, dead tokens, preferences), chat block and "who can message me", story upload and preferences.
2. Web: every feature column in section 5 (bell, score badge, status buttons, adoption review, receipts, inbox, likes/comments/stories, settings, map).
3. Mobile: settings switches, change password, dark mode.
4. Week 1 leftovers: Firebase, Maps key, dev build, secrets cleanup, deployment.
5. Tests (role tests, Jest, Playwright, CI), docs and demo script.

---

## 10. Assumptions

- **A1.** Chat updates by polling plus push, not WebSockets.
- **A2.** Chats are reporter↔org only.
- **A3.** `devcomx-1122` is Emaan.
- **A4.** The AI detector is a small ONNX model on CPU, run when a report is saved.
- **A5.** "Condition" comes from the severity the reporter picks plus the description, not from the photo.
- **A6.** The score formula is fixed and documented, not learned.
- **A7.** Posts keep one image each.
- **A8.** Without an admin, abuse is handled by:
  - orgs deleting comments on their own posts
  - orgs blocking users in chat
  - a developer using Django `/admin/` for anything else.
- **A9.** No offline mode. If sending a report fails, the form keeps what was typed and offers a retry. *(Built: a failed report is queued on the phone and retried; see `services/offlineQueue.ts`.)*
- **A10.** Images are stored on the server's disk volume.
- **A11.** Deleting an account anonymises it; the user's cases are kept.
- **A12.** Only the sponsor and the org can see receipts.
- **A13.** Stories expire using a time filter, with no scheduled job.
- **A15.** Guests can see animal and org pages too, not just the feed.
- **A16.** Existing `public` and `admin` users become reporters.

---

## 11. Risks

- **R1. Dev build.** It still fails, and the causes aren't confirmed. Without a working build there's no push on a phone, and the only fallback is the in-app notification inbox. *(15 Oct: the `expo-location` and `app.json` causes are fixed, and the Expo Go "network error" is fixed; Firebase and the Maps key are still missing.)*
- **R2. Workload.** 11 features, a full redesign and dark mode in under 4 weeks, built by one person, with no agreed cut order. This is the biggest risk. *(15 Oct: the web side of every feature is still open with 10 days to the freeze.)*
- **R3. Deadline.** The exact date is unknown.
- **R5. Leaked Google secret.** It's in the git history and must be rotated.
- **R6. Hosting setup.** The VM, domain, HTTPS and OAuth redirects all need setting up.
- **R7. Mobile testing.** Mobile testing evidence is manual only.
- **R8. Moderation.** Without an admin, fake reports can only be handled in Django `/admin/`.
- **R9. AI detector.** It may miss animals in blurry photos. Test with realistic images.
- **R10. Role rename.** It touches every permission and every role check in the clients.
- **R11. Oracle signup.** Signup can be rejected, or free capacity may be unavailable. The fallback is Azure for Students.
- **R12. Google billing.** The Google billing account has a card on it, so the key restrictions and budget alert are mandatory.
