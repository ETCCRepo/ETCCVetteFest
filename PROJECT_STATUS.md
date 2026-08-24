# ETCC Vette Fest App — Project Status

Last updated: 2026-08-23 (end of session). No prior PROJECT_STATUS.md existed for this
project — this is the first one, written after the fact by inspecting the repo rather
than from session memory, since the app was already substantially built when this session
began.

## Current state: code-complete, not yet deployed

The app is a single-page registration manager for ETCC's Vette Fest car show, closely
modeled on the sibling **ETCC Car Show** app (`Z:\Backup\Websites\CarShow`) but with a
materially different event model (see `App/src/config.js`'s header comment for the full
list of deliberate differences — unisex shirts in 12 buckets not 24, four priced
admissions that drive both Reg Type and attendee count, a `26-01`-style per-event Reg #,
no sponsorship concept at all).

**Regression suite: 85/85 passing** (`node App/test/run-tests.js`), covering fixture-based
generation (registrations, attendees, funds, judges, shirt buckets, generation tally, Reg
#, event-title fallback chain, show-year validation) and an Excel export round-trip.

**Version:** `App/version.json` — 1.3, last built 2026-08-23.

### Front end (`App/src/`)
- `app.js` — the SPA (~109KB), `logic.js` — pure business logic (~17.5KB, mirrors
  `lib.php`'s server-side validation rules), `config.js` — the single place to adapt the
  tool to a different event, `excel.js` — export, `styles.css`, `regression-tests.js`.
- `build.js` inlines `vendor/` + `src/` + fixture CSVs into a self-contained
  `App/ETCCVetteFest.html`, bumping `version.json`'s minor number on each build.

### Backend (`App/deploy/`) — complete, matches its own README exactly
All files the README describes are present and consistent with the documented
architecture: `index.php` (login gate + live data-stitching), `_login.html`, `lib.php`
(shared helpers, auth, per-event path validation via `vettefest_valid_year()`), `shows.php`
(event registry: list/create/rename/archive/unarchive/set_current/delete — delete needs
the Developer password), `app-settings.php`, `deleted-registrations.php`,
`registration-overrides.php`, `registrations-upload.php` / `registrations-import.php`,
`send-tshirt-order-email.php`, forgot/reset-password pairs (site + separate Developer
password), `logout.php`, `.htaccess`, `secrets.example.php`, `ftp-deploy.sh`,
`upload-registrations.js`.

Data model: one JSON dataset per event year under `data/<year>/` on the server
(registrations, deleted-registrations, overrides, settings), plus a global
`data/shows.json` registry — never a flat single-event layout, so there's no migration
step needed for a fresh install.

**Not yet deployed** — by design, not oversight:
- No `secrets.php` (only `secrets.example.php` — needs site + Developer password hashes
  and SMTP credentials filled in).
- No `.ftp-credentials` (only `.ftp-credentials.example`).
- The `vettefest` FTP account itself has not been created in hPanel yet.

## Known follow-ups / next steps

1. **First deploy** (see `App/deploy/README.md` "First deploy" section for exact steps):
   create the hPanel FTP account scoped to `public_html/vettefest`, fill in
   `.ftp-credentials` and `secrets.php` from their `.example` templates, run
   `node App/build.js && bash App/deploy/ftp-deploy.sh`, hand-upload `secrets.php` once,
   then sign in and create the first event via **+ New Vette Fest**.
2. Nothing in the code itself is known-broken or half-finished as of this writing — a
   scan for TODO/FIXME/placeholder markers across `App/src` and `App/deploy` turned up
   nothing beyond literal HTML `placeholder=` attributes.
3. No human has yet exercised the live app end-to-end (it isn't live) — once deployed,
   the same kind of verification the CarShow app's multi-year work got (create an event,
   import the real CSV pair, confirm shirt/attendee/fund tallies against a known-good
   export) is still open.

## Architecture notes worth preserving

- **CODE vs DATA deploy separately.** Code (`App/src/*` → `ETCCVetteFest.html` →
  `app-bundle.html` on the server) only changes via `build.js` + `ftp-deploy.sh`. DATA
  (ClubExpress CSV pair, row edits/deletions) lives in gitignored JSON under `data/<year>/`
  on the server, is never touched by `ftp-deploy.sh`, and `index.php` reads it fresh on
  every page load — a data refresh is live immediately, no rebuild needed.
- **One event per year**, `data/shows.json` is the registry, `vettefest_valid_year()` in
  `lib.php` is the only thing allowed to turn a `?year=` param into a path segment (strict
  `^[0-9]{4}$`, hard 400 on failure — never a silent fallback that could cross-write
  another year's data). `logic.js` mirrors the same rule client-side for early rejection,
  but the server is the real gate.
- **Two passwords**: site password (everyone) vs. Developer password (hamburger menu's
  Import Registrations / Settings / Regression Tests / Change Log, plus required
  server-side to delete an entire event's data).
