# Hostinger deployment

Intended to live at **https://etccapps.com/apps/vettefest/**, password-protected with a
branded login screen — the same pattern as the sibling ETCC Car Show and Silent Auction
Manager apps on this domain.

> **Not deployed yet.** The FTP account for `vettefest` has not been created, and
> `deploy/secrets.php` does not exist in this repo. Everything below describes what a
> first deploy needs; see **First deploy** at the bottom for the exact steps.

Note the `/apps/` prefix will be required even though hPanel lists an FTP account's home
directory as `public_html/vettefest` (no `apps/` segment) — there's a server-level Alias
mapping `/apps/<name>/` to that directory, matching the URL convention every other
sub-app on this domain uses. Bare `/vettefest/` will 404 for everything, including brand
new files, because it isn't a real path under the actual document root.

## Architecture: CODE vs DATA are deployed separately

This matters more than it sounds — get it backwards and you'll deploy code but wonder
why the data didn't update, or vice versa.

- **CODE** (`App/src/*` → `ETCCVetteFest.html` → `app-bundle.html` on the server) changes
  only when you edit the app itself. Refreshed with `node build.js` + `ftp-deploy.sh`.
- **DATA** (the ClubExpress CSV pair, plus officers' row edits and deletions) changes
  independently, any time someone exports fresh CSVs or corrects a record. It lives in
  gitignored JSON under `data/<year>/` on the server and is **never** touched by
  `ftp-deploy.sh`. `index.php` reads it fresh on every single page load and stitches it
  into the app bundle server-side — so a data refresh is live for the next visitor
  immediately, with no rebuild or redeploy of any kind.

## One event per year

The app holds a completely separate dataset per Vette Fest year. `data/shows.json` is the
registry (`{ "current": 2026, "shows": [{year, name, status, created}, …] }`) and each
event's files live under `data/<year>/`.

`vettefest_valid_year()` in `lib.php` is the **only** thing allowed to turn a `?year=`
parameter into a path segment — strict `^[0-9]{4}$`, returning the year or `null`. Every
endpoint treats a failed validation as a hard HTTP 400, never a silent fallback, because
guessing would risk writing one year's data into another's. `logic.js` carries a mirror
of the same rule (`LOGIC.validShowYear`) so the UI can reject a typo before the round
trip, but the server is the real gate.

Switching events is a full page load (`?year=2027`), not a client-side refetch —
`index.php` re-inlines every dataset from scratch per request, so a reload is free
correctness with no cache-invalidation logic.

There is **no migration step**: this app has never had a flat single-event layout, so a
fresh install simply starts with no `data/shows.json` and shows the "No events yet"
empty state until an officer creates the first one.

## Layout

Server-side files, uploaded by `ftp-deploy.sh` to the FTP account's home directory
(already scoped to `public_html/vettefest`):

| File | What it does |
| --- | --- |
| `index.php` | The login gate **and** the live data-stitching template. Serves `_login.html` to anyone not signed in; otherwise reads `app-bundle.html`, injects `window.__vettefestSite` plus a boot script carrying this event's data, and echoes the result. |
| `_login.html` | The branded password screen. Posts `action=login` back to `index.php`. |
| `lib.php` | Shared helpers: auth, lock-guarded JSON read/write, safe inline-JSON embedding, a self-contained SMTP client, and every per-event path helper. |
| `shows.php` | The event registry API — `list`, `create`, `rename`, `archive`, `unarchive`, `set_current`, `delete`. `delete` additionally requires the **Developer** password. |
| `app-settings.php` | Per-event settings (`get` / `save`). Defaults come from `vettefest_settings_defaults()` in `lib.php` — one definition, read by this file, `index.php` and `send-tshirt-order-email.php`. |
| `deleted-registrations.php` | The tombstone list of `csvRegKey()`s an officer has deleted, so a deleted row stays gone across a re-import. |
| `registration-overrides.php` | The `csvRegKey() → patch` map of detail-modal field edits, re-applied on top of every fresh CSV parse. |
| `registrations-upload.php` | Stores a CSV pair server-side. Meant for `upload-registrations.js`'s scripted flow (session **or** password auth). |
| `registrations-import.php` | The browser-based sibling of the above: an officer-only upload form. Same destination file. |
| `send-tshirt-order-email.php` | Sends the T-Shirts tab's order email through `vettefest_send_mail()`. |
| `forgot-password.php` / `reset-password.php` | Time-limited emailed reset for the main site password. |
| `dev-forgot-password.php` / `dev-reset-password.php` | The same flow for the separate Developer password. |
| `logout.php` | Destroys the session. |
| `.htaccess` | `DirectoryIndex`, the CSP header (needed so the Change Log can reach `api.github.com`), and a blanket deny on every `*.json`. |
| `secrets.php` | **Never committed, never uploaded by the deploy script.** Password hashes + SMTP credentials. |

Server-accumulated, never uploaded:

- `data/shows.json` — the event registry.
- `data/<year>/registrations-data.json` — the stored CSV pair (contains registrant PII).
- `data/<year>/deleted-registrations.json`, `registration-overrides.json`, `app-settings.json`.
- `password-reset.json`, `dev-password-reset.json` — pending reset tokens (global).

## Two passwords

- **Site password** (`$PASSWORD_HASH`) — the login gate. Everyone who uses the app has it.
- **Developer password** (`$DEV_PASSWORD_HASH`) — unlocks the hamburger menu's Import
  Registrations / Settings / Regression Tests / Change Log items, and is additionally
  required server-side to **delete an event** (a whole year of data, with no undo).

Generate either hash with:

```bash
openssl passwd -6 -salt "$(openssl rand -hex 8)" 'the-actual-password'
```

`crypt()` verifies SHA-512-crypt (`$6$`) hashes natively, so no PHP is needed locally.

`ftp-deploy.sh` deliberately never uploads `secrets.php`: `reset-password.php` rewrites
the **live** copy when someone uses the "Forgot password?" flow, and re-uploading the
local file on every code deploy would silently revert that change to whatever stale hash
is sitting in the working copy. To push a hand-generated hash instead, upload it once by
hand — the command is in the comment at the bottom of `ftp-deploy.sh`.

## Refreshing the data

Either of these makes new registration data live on the next page load. Neither needs a
rebuild or redeploy.

- **In the app** — Developer → Import Registrations, and pick the two CSVs. Imports into
  whichever event the session currently has open.
- **From the command line:**

```bash
VETTEFEST_SITE_PASSWORD='the-site-password' VETTEFEST_YEAR=2026 node deploy/upload-registrations.js
```

With no path arguments it picks the newest `registration_data*.csv` /
`activity_registrant_data*.csv` out of the Vette Fest Exports folder. `VETTEFEST_YEAR`
defaults to the current calendar year — right for an in-season refresh, wrong if you're
backfilling a past event, so set it explicitly in that case. The server rejects an
unknown year outright rather than filing the CSVs under the wrong event.

Both CSVs come from ClubExpress: **Admin Options → Exports → "Registration Data"**, then
again for **"Activity Registrant Data"**. The activity export is what carries the
admissions and shirt purchases, so without it every row imports with no admission at all.

## Automated imports (no Claude subscription required)

The Setup tab's Import Schedule panel (Event URL, auto-import times, "Import Now") only
*leaves a signal* — a web page can't drive a browser through ClubExpress. The other half
is `deploy/sync-registrations.js`, run by **Windows Task Scheduler** every 15 minutes on
an officer's machine. It replaced an equivalent Claude Code scheduled task; the server
side is unchanged, and `import-schedule.php` / `logs.php` / `registrations-upload.php`
never knew the difference.

```
sync-registrations.js  --check-------> import-schedule.php   "anything due?"
                       --mark_start--> import-schedule.php   Setup tab: "Import started"
                       --Playwright--> ClubExpress Exports   the two CSVs
                       --spawn-------> upload-registrations.js -> registrations-upload.php
                       --store-------> logs.php              History tab's log icon
                       --mark_run----> import-schedule.php   Setup tab: "Last run"
```

Most polls find nothing due and exit silently in about half a second — no browser, no
files, no log. Only a due slot or a clicked **Import Now** opens Chrome.

### One-time setup on the machine that runs it

1. `VETTEFEST_SITE_PASSWORD` set as a persistent Windows **user** environment variable.
2. `npm install` in `App/` (pulls `playwright-core`; it drives the system's real Chrome,
   so there is no browser download).
3. `node deploy/clubexpress-login.js` — opens a visible Chrome window on a **dedicated**
   profile at `%LOCALAPPDATA%\ETCC\clubexpress-profile`. Sign into ClubExpress by hand,
   tick **Remember Me**, close the window.
4. Register the task (see `deploy/install-scheduled-task.ps1`).

### Authentication, deliberately

Nothing in this pipeline ever types a ClubExpress username or password. The sync reuses
the session left behind in step 3 and, when that lapses, fails with
`ClubExpress session not logged in` — which shows up in the Setup tab's "Last run" line
and as a FAILED row in the History tab. The fix is to re-run step 3. ClubExpress admin
credentials are therefore never stored on this machine or reachable by an automation bug.

A dedicated profile, not the officer's everyday Chrome: Chrome allows only one process
per profile folder, so reusing the default one would fail whenever they had Chrome open.

### Running it by hand

```bash
node deploy/sync-registrations.js --force --headed
```

`--force` skips the schedule check and imports immediately (reporting itself to the
server as a `manual` run, exactly like an Import Now click). `--headed` shows the Chrome
window, which is how to see what ClubExpress is actually doing when something breaks.

### When it breaks

Unlike the Claude task it replaced, this can't improvise around a ClubExpress redesign.
It anchors on visible text and roles rather than coordinates or generated ASP.NET ids, so
ordinary layout shifts are survivable — but a renamed button will stop it. It fails loudly
rather than silently: non-zero exit (Task Scheduler's "Last Run Result"), a FAILED row in
the History tab, the archived log, and a line in `deploy/sync-registrations.local.log`.

`/ETCCVetteFestImportData` is still available as a manual fallback for that day.

## Deploying code

```bash
node App/build.js && bash App/deploy/ftp-deploy.sh
```

`build.js` inlines `vendor/` + `src/` + the fixture CSVs into a single self-contained
`App/ETCCVetteFest.html` and bumps `version.json`'s minor number (the footer's stamped
version/date reflect when the artifact was actually built). `ftp-deploy.sh` then uploads
that file as `app-bundle.html` alongside the PHP.

The script reads credentials from `deploy/.ftp-credentials` (gitignored — copy
`.ftp-credentials.example`) or from `FTP_HOST`/`FTP_USER`/`FTP_PASS` environment
variables, which take precedence. It retries each upload up to three times and clears
ProFTPd's stale `.in.<filename>.` hidden temp file on a 550, which is the usual cause of
a repeat failure on this host.

## First deploy

1. **hPanel → Files → FTP Accounts** — create an account whose directory is
   `public_html/vettefest`.
2. Copy `.ftp-credentials.example` → `.ftp-credentials` and fill in the real host, user
   and password.
3. Copy `secrets.example.php` → `secrets.php` and fill in both password hashes and the
   SMTP mailbox (hPanel → Emails).
4. `node App/build.js && bash App/deploy/ftp-deploy.sh`
5. Upload `secrets.php` once, by hand (see the comment at the bottom of `ftp-deploy.sh`).
6. Visit the site, sign in, and click **+ New Vette Fest** to create the first event.
7. Developer → Import Registrations, and load the CSV pair.
