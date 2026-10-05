# StrayAid: Spec for the Remaining Work

Agreed on 4 Oct 2026. Final FYP submission is **under 4 weeks** away; the plan assumes **1 Nov 2026** until the real date is confirmed.

The committee needs:
- docs (SRS, SDS, report) that match what's built
- testing evidence

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

- A migration renames `public` to `reporter` and makes reporter the default. Existing `admin` users become reporters.
- **No admin role, no admin dashboard and no org verification** in this release.
- Read endpoints for the feed, posts, stories, animals and orgs no longer need a login. Every write needs one, with the right role.
- Mobile and web open straight to the feed as a guest. Any action asks the guest to log in.

---

## 4. Week 1: blockers

**Mobile dev build** (likely causes found in the code):
- [ ] `expo-location` is pinned to `^55.1.4`, but the app is on SDK 54 (needs `~19.0.x`). This can crash the app at launch.
  - Run `npx expo install --check` and fix every mismatch.
  - Remove the deprecated `expo-random`.
- [ ] Remove the trailing comma after the `expo-speech-recognition` plugin in `app.json`.
- [ ] Add Firebase (`google-services.json`, `android.googleServicesFile`, FCM V1 key in EAS). Without it, Android push tokens fail and the error is hidden.
- [ ] Register the push token after login. Today it registers only at launch and silently skips if nobody is logged in.
- [ ] Add the Google Maps key (`android.config.googleMaps.apiKey`). Without it, the map picker crashes in a dev build.
- [ ] Point `EXPO_PUBLIC_API_URL` to the hosted HTTPS backend.
  - For local testing: `python manage.py runserver 0.0.0.0:8000`, and allow port 8000 in Windows Firewall.
- [ ] Google sign-in: create an Android OAuth client for `com.ayesha4956.strayaid_mobile_frontend` with the EAS keystore SHA-1.
- [ ] Rebuild the dev client and check `adb logcat` for any remaining crash.

**Repo and security:**
- [x] Merge `emaan` into `Ayesha` (done, c67edf2).
- [ ] Remove from git and add to `.gitignore`:
  - the mobile `.env`
  - `client_secret_*.json` and `client_*.plist`
  - 164 `__pycache__` files
  - `test_db.sqlite3`
- [ ] Rotate the Google OAuth client secret. The old one is in the git history.
- [ ] Move `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, CORS and the Google client IDs into env vars.

**Deployment:**
- [ ] Set up an Oracle Always Free VM running the `docker-compose.yml`.
- [ ] Put Caddy in front for HTTPS on DuckDNS.
- [ ] Serve `/media/` from the `media_data` volume. Gunicorn doesn't serve images with `DEBUG` off.
- [ ] Add the domain to Google OAuth origins and set `VITE_API_URL`.
- [ ] Test end to end: report on a phone → change status on web → push arrives.

**Design system:**
- [ ] Spacing, type and colour tokens (light and dark) for web and mobile.
- [ ] Shared components:
  - button
  - input
  - card
  - round avatar
  - chip
  - empty and error states
  - skeleton loader
- [ ] API contract for every new endpoint (from section 6).

**Week 1 is done when** a dev build logs in against the hosted backend and receives a push.

---

## 5. Must-have features (all required, no cut order)

| # | Feature | Backend | Web | Mobile | Week |
| --- | --- | --- | --- | --- | --- |
| 1 | Guest / Reporter / Org roles | Role rename migration; public reads | Guest routes, role checks | Open as guest; login prompt on actions | 2 |
| 2 | Better notifications | Send after save, in batches; remove dead tokens; skip the actor; inbox model; preferences | Notification bell for orgs | Notification inbox | 2 |
| 3 | Rescue updates for reporters | `CaseFollow`; follow the animal automatically | — | "Keep me updated" toggle on Report; turn off in Activity | 2 |
| 4 | AI confidence score (0–100%) | ONNX detector + score when a report is saved | Score badge; rank the case list and map | Severity picker on Report | 2 |
| 5 | Case status rules | Only allowed status changes | Only valid next-status buttons | — | 2 |
| 6 | Adoption applications | `adoption` app | Review applications | Apply; My applications | 2–3 |
| 7 | Chat (case threads + DMs) | `chat` app, polling | Org inbox | DM inbox and threads | 3 |
| 8 | Sponsorship | `sponsorship` app | Confirm or reject receipts | Pledge, upload receipt, My sponsorships | 3 |
| 9 | Instagram-style community | Avatars, likes, comments, 24h stories | Likes, comments, story upload | Stories row, likes, comments | 3 |
| 10 | Settings | Preference fields; delete account by anonymising | Settings page | Settings screen | 3 |
| 11 | Case map polish | — | Restyle `RescueBoard.tsx` (reported cases as pins) | — | 4 |

**Feature freeze: 25 Oct.** Week 4 is bug fixes, the redesign sweep, dark mode, tests, docs and a demo rehearsal.

**Full redesign (mobile and web):**
- After the design system, every screen is rebuilt in the new design as its feature is built. Untouched screens get a final sweep.
- Each screen is checked against Nielsen's heuristics:
  - feedback
  - empty and error states
  - consistency
  - touch targets of at least 44 pt

---

## 6. Feature details

### 1. Roles
- `User.role` choices: `reporter` (default) and `organization`.
- New `IsReporter` permission, alongside the existing `IsOrganizationUser`.
- No login needed for:
  - the public feed and posts by animal
  - stories
  - public animal lists and detail pages
  - org detail pages and their animals

### 2. Notifications
- **New `Notification` model:** user, type, title, body, data (JSON), `is_read`, `created_at`.
- **Endpoints:**
  - `GET /api/notifications/`
  - `POST /api/notifications/{id}/read/`
  - `POST /api/notifications/read-all/`
- **`notify_users`:**
  - Saves a `Notification` for each user and respects their preferences.
  - Skips the user who triggered the event.
  - Sends pushes after the database save, on a background thread, in batches of 100.
  - Deletes tokens Expo reports as `DeviceNotRegistered`.

### 3. Rescue updates for reporters
- **New model:** `CaseFollow` (user, case).
- **Reporting:** the report endpoint takes `keep_updated` (default true) and creates the follow.
- **Case status changes** notify case followers instead of every reporter.
- **When the Animal record is created,** each case follower automatically follows the animal.
- **Endpoints:** `POST` / `DELETE /api/notifications/follow/case/{id}/`.

### 4. AI confidence score
- **New fields:**
  - `Report.severity` (low / medium / high / critical) and `Report.ai_animal_confidence`
  - `Case.confidence_score` (0–100) and `Case.possibly_invalid`
- **Detector:** a pretrained COCO detector (SSD-MobileNet or YOLOv8n) exported to ONNX, run with `onnxruntime` and loaded once per worker. Its confidence is the highest score among dog, cat, bird, horse, sheep and cow.
- **Formula:** score = round(100 × (0.5 × detector + 0.3 × severity + 0.2 × reports))
  - severity: low 0.25 / medium 0.5 / high 0.75 / critical 1
  - reports: 1 → 0.33, 2 → 0.67, 3 or more → 1
  - recalculated each time a report merges into the case
- **`possibly_invalid`** when the detector confidence is below 0.3. **Nothing is rejected automatically.** Nearby cases sort by severity, then score.
- **"Condition"** comes from the severity the reporter picks plus the description. It isn't judged from the photo; say so honestly in the viva.

### 5. Case status rules
Allowed changes:
- reported → assigned (accept)
- assigned → in_progress, or back to reported (release)
- in_progress → rescued
- rescued → adoption or closed
- adoption → closed

Anything else returns 400.

### 6. Adoption
- **`AdoptionApplication`:** animal, applicant, home type, other pets, experience, reason, phone, status, org note, dates.
  - Status: pending / approved / rejected / withdrawn.
  - One pending application per person per animal.
- **Reporter endpoints:**
  - `POST /api/adoptions/` (adoptable animals only)
  - `GET /api/adoptions/mine/`
  - `POST /api/adoptions/{id}/withdraw/`
- **Org endpoints** (only the animal's org):
  - `GET /api/adoptions/org/`
  - `POST /api/adoptions/{id}/approve/`
  - `POST /api/adoptions/{id}/reject/`
- **Approving** marks the animal adopted, rejects the other pending applications and notifies every applicant.

### 7. Chat
- **Models:**
  - `Conversation`: reporter, organization, optional case, `last_message_at`, `blocked`
  - `Message`: conversation, sender, body, `created_at`, `read_at`
- **Endpoints:**
  - `GET` / `POST /api/chat/conversations/`
  - `GET /api/chat/conversations/{id}/messages/?after=<id>`
  - `POST` messages
  - `POST /api/chat/conversations/{id}/block/` (org only)
- **Updates:** the app checks for new messages every 5 seconds in an open conversation and every 30 seconds in the inbox, plus a push for each new message.
- **"Who can message me":** any org, orgs I follow, or none.

### 8. Sponsorship
- **`Sponsorship`:** animal, sponsor, amount (PKR), receipt image, status, org note, dates.
  - Status: pledged → receipt_uploaded → confirmed or rejected.
- **Endpoints:**
  - `POST /api/sponsorships/`
  - `POST /api/sponsorships/{id}/receipt/`
  - `GET /api/sponsorships/mine/`
  - `GET /api/sponsorships/org/`
  - `POST /api/sponsorships/{id}/confirm/`
  - `POST /api/sponsorships/{id}/reject/`
- **Confirming** makes the sponsor follow the animal and notifies them.
- **Privacy:** only the sponsor and the org can see receipts. The animal page shows the sponsor count.

### 9. Community
- **New:** `User.avatar`, `PostLike`, `PostComment`, `Story`.
  - Stories show for 24 hours, using a time filter (no scheduled job).
- **Endpoints:**
  - `POST` / `DELETE /api/posts/{id}/like/`
  - `GET` / `POST /api/posts/{id}/comments/`
  - `DELETE /api/posts/comments/{id}/` (the comment author or the post's org)
  - `GET /api/stories/` (public)
  - `POST /api/stories/` (org)
- **Feed items** add `like_count`, `comment_count` and `liked_by_me`.
- Only organizations create posts.

### 10. Settings
- **Contents:**
  - edit profile and avatar
  - change password
  - notification switches per type (case updates, chat, adoption, sponsorship, posts)
  - who can message me
  - dark mode (saved on the device)
  - about and help
  - logout
  - delete account
- **Deleting an account** deactivates the user and clears their name and email. Their cases and reports are kept.

---

## 7. Testing and docs

| Deliverable | What | When |
| --- | --- | --- |
| Django tests | Each new endpoint and permission rule; role tests for guest, reporter and org (55 tests exist today) | With each feature |
| Score tests | Formula with a fixed detector output; a real photo vs a non-animal photo | Week 2 |
| Web Jest tests | Adoption review, receipt confirmation, guest feed, settings form | With each screen |
| Web Playwright | Guest browses the feed; org accepts a case | Week 4 |
| Mobile manual test cases | Steps and expected results per screen, run on a real phone | Week 4 |
| SRS / SDS | Use cases, roles table, class diagram, sequence diagrams for report → rescue → adoption | Updated weekly |
| Test report | Pass counts and coverage (`coverage run manage.py test`) | Week 4 |
| Demo script | Guest browses → signs up → reports → org accepts → push → chat → adoption → sponsorship | Week 4 rehearsal |

Every PR runs the Django and Jest tests on GitHub Actions. A failing PR is not merged.

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
- push works on a phone by **Oct 11**
- feature freeze **Oct 25**
- demo **Nov 1** (assumed)

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
- **A9.** No offline mode. If sending a report fails, the form keeps what was typed and offers a retry.
- **A10.** Images are stored on the server's disk volume.
- **A11.** Deleting an account anonymises it; the user's cases are kept.
- **A12.** Only the sponsor and the org can see receipts.
- **A13.** Stories expire using a time filter, with no scheduled job.
- **A15.** Guests can see animal and org pages too, not just the feed.
- **A16.** Existing `public` and `admin` users become reporters.

---

## 11. Risks

- **R1. Dev build.** It still fails, and the causes aren't confirmed. Without a working build there's no push on a phone, and the only fallback is the in-app notification inbox.
- **R2. Workload.** 11 features, a full redesign and dark mode in under 4 weeks, built by one person, with no agreed cut order. This is the biggest risk.
- **R3. Deadline.** The exact date is unknown.
- **R5. Leaked Google secret.** It's in the git history and must be rotated.
- **R6. Hosting setup.** The VM, domain, HTTPS and OAuth redirects all need setting up.
- **R7. Mobile testing.** Mobile testing evidence is manual only.
- **R8. Moderation.** Without an admin, fake reports can only be handled in Django `/admin/`.
- **R9. AI detector.** It may miss animals in blurry photos. Test with realistic images.
- **R10. Role rename.** It touches every permission and every role check in the clients.
- **R11. Oracle signup.** Signup can be rejected, or free capacity may be unavailable. The fallback is Azure for Students.
- **R12. Google billing.** The Google billing account has a card on it, so the key restrictions and budget alert are mandatory.
- **R13. Missing keys.** The missing Maps key and Firebase setup may be part of the dev-build failures.
