# ETCC Vette Fest App — Project Status

Last updated: 2026-09-14 (end of a third session that day). **Two user-reported bugs
fixed, both verified live**: restore couldn't offer or restore an event that had just
been created with no data yet (a real gap in v2.44's own logic, not a stale assumption —
see follow-up items below for what changed), and Logout redirected off-site to the club's
main website instead of returning to this app's own login screen. Checkpoint v2.45
(`0455b7c`). See "This session's work (2026-09-14 — restore fix + logout fix)".

Previous update: 2026-09-14 (end of a later session that day). **Added database restore to
the Setup tab's Backups panel** — restore everything, or just one event, from any
successful backup, modeled on the sibling SilentAuctionManager app's restore feature.
Shipped v2.44 (`8a719f2`). Verified against the live server: both scope kinds (a specific
event, and everything) tested for real, each correctly preceded by an automatic safety
backup; a real bug in the per-event name/status merge was caught and fixed before this was
called done — see "This session's work (2026-09-14 — Backup restore)".

Previous update: 2026-09-14 (end of session). **No app code changed.** The
`/ETCCVetteFestBackup` skill now writes **two** zips per run to `Z:\Backup\websites\VF\Backup`
(live `data/` tree + the whole local repo folder, same timestamp, no log file), and a
bump-only checkpoint shipped v2.42 (`7d03767`). See "This session's work (2026-09-14 —
backup skill)".

Previous update: 2026-09-13 (end of a later session that day). **Both Setup tab schedule
panels (Import Schedule, Backups) now auto-save** — every field saves itself on
blur/change, no more Save button, prompted by a real UX gap found while auto-import
times were being checked (a removed time only persisted on a separate Save click).
Shipped v2.40 (`c3ba7b3`), checkpoint v2.41 (`fbc2695`). Not independently verified in a
live browser session (only by build success + code review) — see "This session's work
(2026-09-13 — Setup tab autosave)".

Previous update: 2026-09-13 (end of session). **Added a Backups panel to the Setup tab**
— a "Backup Now" button, a permanent color-coded run log, and an auto-backup schedule,
ported from the sibling CarShow app and piggybacked on the existing Import Schedule poll
(no new scheduled task needed). Shipped v2.37 (`cd5e482`), checkpoint v2.38 (`75760b0`).
Verified directly against the live server (real backup run/list/download/delete/schedule
round-trips) — **auto-backup is now enabled in production** as a side effect of that
testing (window 2026-09-13→2026-10-13); this was later confirmed visually and the
schedule left to the user's own management — see "This session's work (2026-09-13 —
Backups panel)" and the auto-import/auto-backup follow-ups below.

Previous update: 2026-09-12 (end of a sixth session that day). **Deleted the stale
`vettefest-sync-registrations` Claude Code scheduled task**, which had been left polling
every 15 minutes alongside the Windows task that actually does the import — two pollers
racing on the same read-only `check`. Confirmed in the process that the import pipeline
itself has **no Claude dependency at all**. Checkpoint v2.34 (`bd7f70d`, build-artifact
only; no source changed). Note: this document had already claimed that task was gone, and
it had come back once — see that session's entry, §3.

Previous update: 2026-09-12 (end of a third session that day). **The ClubExpress import no
longer depends on Claude.** `deploy/sync-registrations.js` (Playwright) now does the whole
unattended import, run by a Windows Task Scheduler task; the Claude Code scheduled task
is gone. Getting it to work needed three live-site discoveries (host-only auth cookie,
popup form, postback replay) — see "This session's work (2026-09-12 — third session)".
Shipped v2.28 (`c6d9bbe`), installer `25b43c5`, checkpoints v2.29 (`3d2d7cf`) and v2.30
(`17feee8`, bump-only).
Then CarShow's port of the sync fed four fixes back here — v2.31 (`f97d1d7`).
Last: the registration detail form's action buttons were pinned to the top — v2.32
(`87dafae`), checkpoint v2.33 (`b2df0de`).

Previous update: 2026-09-12 (end of a second session that day). **The app footer was
collapsed to a single auto-shrinking line** (v2.27, `ffb776c`), this file was brought back
in sync with the code after two undocumented days (`4343e9d`), and a **correction** was
recorded: the live auto-import schedule is *not* the enabled-hourly-unbounded one the
commits describe — see "This session's work (2026-09-12 — later session)" below.

Previous update: 2026-09-12 (end of the earlier session that day). **Setup and History
were brought to full CarShow parity and the ClubExpress import loop was automated end to
end** — an Import Schedule panel on Setup, a `vettefest-sync-registrations` Windows
scheduled task polling it every 15 minutes, an auto-import schedule wired up on the live
2026 event (see the correction in the later session's §2), and a History tab that logs
every import (success or failure). Two CarShow bug fixes were also ported (the
Registration table under-filling the viewport; tabs not re-pulling server data on
selection). Shipped across **v2.11 → v2.23**, nine commits, all built, deployed and
pushed. See "This session's work (2026-09-12 — earlier session)" and "(2026-09-11)"
below.

> **How those two entries were written — read this before trusting their detail.** The
> 09-11 and 09-12 sessions both ended without running `/ETCCVetteFestEnd`, so this file sat
> at v2.8 while the app moved to v2.23. Both entries were reconstructed on 2026-09-12 from
> git history (`0cb6398..ba448cb`) and the working tree, **not** from conversation memory.
> The commit messages in that range are unusually detailed and are the primary source, but
> anything not recorded there — dead ends, options weighed and rejected, verbal decisions
> — is lost. Where this summary and the code/commits disagree, the code wins.

Previous update: 2026-09-10 (end of session). **Added a "Setup" tab** (after Reports) that
holds Import Registrations (moved out of the Developer menu) and a brand-new **Import
Flyer** feature, plus a **Print Flyer** button on the Reports tab and a new
`App/deploy/flyer.php` endpoint. Two checkpoints shipped, **v2.7** (feature) then **v2.8**
(bump-only). See "This session's work (2026-09-10)" below.

Previous update: 2026-09-09 (end of session). **The Developer password was changed to
match the site password** (config-only, no code touched) and a routine checkpoint shipped
**v2.6** (build-artifact-only commit — no source diff beyond the version bump).

Previous update: 2026-08-28 (end of session). **Fixed the favicon not showing on iOS**
(iPhone/iPad) — needed `apple-touch-icon`, not just `<link rel="icon">` — across the main
app and every standalone deploy page, and while in there also fixed a real leftover bug:
four password-reset pages still said "ETCC Car Show" (copy-pasted from the sibling app,
never updated). Two checkpoints shipped, v2.4 then v2.5, both pushed.

Previous update: 2026-08-27 (end of session). The git push problem from 2026-08-24 was
resolved — the user supplied a personal access token and pushes now work (with a
one-time-per-session credential-helper override, see "Known follow-ups"). Added a
favicon to the login page (the main app bundle already had one at the time), shipped as
v2.2.

Earlier update: 2026-08-24 (end of session). **The app went live for the first time** —
first deploy completed, two Registration-tab filter bugs fixed, the Summary tab was made
to always show the full dataset, and a Total row was added to the Car Show matrix.

Earliest update: 2026-08-23 (end of session). No prior PROJECT_STATUS.md existed for this
project before that — it was the first one, written after the fact by inspecting the repo
rather than from session memory, since the app was already substantially built when that
session began.

## Current state: live in production

The app is a single-page registration manager for ETCC's Vette Fest car show, closely
modeled on the sibling **ETCC Car Show** app (`Z:\Backup\Websites\CarShow`) but with a
materially different event model (see `App/src/config.js`'s header comment for the full
list of deliberate differences — unisex shirts in 12 buckets not 24, four priced
admissions that drive both Reg Type and attendee count, a `26-01`-style per-event Reg #,
no sponsorship concept at all).

**Regression suite: 85/85 passing**, last re-run on 2026-09-12 after the CarShow-parity
port (covering fixture-based generation — registrations, attendees, funds, judges, shirt
buckets, generation tally, Reg #, event-title fallback chain, show-year validation — and
an Excel export round-trip). The suite is logic-only (`test/run-tests.js` +
`src/regression-tests.js`) and does not exercise any UI/tab code. **That gap is now large:**
none of the Setup tab, Import Schedule, History tab, flyer or scheduled-task work has any
automated coverage — all of it was verified by hand against the live 2026 event instead
(see the session entries below). The count stays at 85 because none of that work touched
`logic.js`.

**Version:** `App/version.json` — stamped **2.45** in the currently-live
`App/ETCCVetteFest.html` / `app-bundle.html` on the server (built and deployed 2026-09-14
15:55, commit `0455b7c`). The file itself now reads `{major:2, minor:46}`, since
`build.js` bumps-and-stores the *next* version on every run — the next build will stamp
"2.46". **Gaps in the version sequence are normal, not lost work:** `build.js` bumps
on *every* run, including rebuilds that were never committed or deployed, which is why the
shipped history reads 2.11, 2.12, 2.13, 2.15, 2.17, 2.18, 2.20, 2.22, 2.23, 2.27, 2.34,
2.37, 2.38, 2.40, 2.41.

**Live URL:** https://etccapps.com/apps/vettefest/ — as of 2026-09-09, **the Developer
password is the same as the site password** (`$DEV_PASSWORD_HASH` in `secrets.php` was set
to the same hash as `$PASSWORD_HASH`, at the user's request). Neither password is recorded
in this file; check with the user or `App/deploy/secrets.php` on a machine that has it.

### Front end (`App/src/`)
- `app.js` — the SPA (~145KB; it was ~109KB before the 09-11/09-12 Setup/History work),
  `logic.js` — pure business logic (~17KB, mirrors `lib.php`'s server-side validation
  rules), `config.js` — the single place to adapt the tool to a different event,
  `excel.js` — export, `styles.css` (~27KB), `regression-tests.js`.
- **Six tabs, in this order: Summary, Registration, T-Shirts, Reports, Setup, History**
  (`buildTabs()`). As of 2026-09-12 selecting *any* tab calls `refreshShowData()` so the
  event's server data is re-pulled on every tab click; Setup additionally calls
  `loadRunStatus()` for the persisted "Last run" line, which is not part of the general
  data refresh.
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
`upload-registrations.js`. Plus, added 2026-09-10: **`flyer.php`** — per-event event-flyer
store (`POST` uploads an image/PDF, `GET` serves it, `GET ?meta=1` returns metadata),
backing the Setup tab's Import Flyer and the Reports tab's Print Flyer.

Four more endpoints were added 2026-09-11/12, all ported from CarShow:
- **`import-history.php`** — refresh + delete rows of the per-event import log.
- **`import-schedule.php`** — the bridge between the app and the Windows scheduled task.
  Five actions: `request` (Setup's "Import Now" writes a pending request), `check` (the
  task polls this; answers "is an import due?" from either a pending request or the
  auto-import schedule), `mark_start`, `mark_run`, and `run_status` (what Setup's "Last
  run" line reads). The app never invokes the task; the task always pulls.
- **`logs.php`** — a 7-day server-side archive of per-run import logs (store/list/get),
  so a failed run leaves something readable behind.
- **`refresh.php`** — returns the same payload `index.php`'s boot script emits, so any
  tab can re-pull live event data without a page reload. Both call the single shared
  `vettefest_boot_data($year)` in `lib.php`, deliberately, so the boot path and the
  refresh path cannot drift apart.

`ftp-deploy.sh` uploads an **explicit hand-maintained list** of files (not a `*.php`
glob) — a new deploy/*.php file MUST be added to that list or it silently never ships
(this bit the flyer.php work on 2026-09-10: the first deploy ran clean but flyer.php
wasn't on the server until it was added to the script). All four endpoints added since
then — `refresh.php`, `import-schedule.php`, `import-history.php`, `logs.php` — **are**
on the list; verified 2026-09-12.

Data model: one JSON dataset per event year under `data/<year>/` on the server, plus a
global `data/shows.json` registry — never a flat single-event layout, so there's no
migration step needed for a fresh install. The per-event file list lives in
`vettefest_show_files()` in `lib.php`, and is now nine files:
`registrations-data.json`, `deleted-registrations.json`, `registration-overrides.json`,
`app-settings.json`, `flyer.json` (the flyer bytes stored base64 inside it so it sits
under the same `*.json` deny rule), and — added 2026-09-11/12 — `import-history.json`,
`import-request.json`, `import-schedule-state.json`, `import-run-status.json`.
**Anything new that is written per-event has to be added to that function**, or it will be
missed by the event delete/archive paths that enumerate it.

**Deployed** — `App/deploy/secrets.php` and `App/deploy/.ftp-credentials` both exist on
disk (gitignored, never committed), the `vettefest` FTP account exists, and
`App/deploy/ftp-deploy.sh` has successfully uploaded code multiple times. The first live
event (2026) is the only one in use; as of the last verified scheduled import on
2026-09-12 it held **74 registration rows and 108 activity rows** of real ClubExpress
data (it was 70 registrations back on 2026-08-24). That live event is what the hand
verification described in the session entries below was run against — there is no staging
copy.

**Git: pushed and working**, as of 2026-08-27 — see that session's entry below for the
one gotcha (a global credential helper that must be worked around on every push from this
machine).

## This session's work (2026-09-14 — restore fix + logout fix)

Two fixes, both reported by the user against the live site and both verified live before
being called done. No feature work — this session only fixed things. Checkpoint **v2.45**
(`0455b7c`).

### 1. Restore couldn't offer or restore a just-created event with no data yet (`a43483f`)

**User report:** "11:43 backup does not restore for the 2027 Vette Fest." Investigated
directly against production rather than assumed: the 2027 event had been created via
`shows.php`'s `create` action (which only ever touches `data/shows.json`) minutes before
that backup ran, and nothing else had been saved to it yet — so the backup genuinely had
zero `data/2027/*` files. Confirmed via `get_backup_years` on that exact backup: only 2026
was listed.

That much is expected — but two real bugs followed from it, both in code from the
restore feature shipped earlier the same day (v2.44):

1. **`vettefest_backup_years_in_zip()`** (`lib.php`) derived its year list purely from
   `data/<year>/` file entries in the zip, so a zero-file event never appeared in the
   Restore modal's dropdown *at all* — not offered, not refused, just invisible.
2. **`vettefest_restore_backup()`**'s "nothing to restore" guard checked only `$writes`
   (the set of files to write), which deliberately excludes `data/shows.json` for a
   scoped restore — so even called directly with `year=2027`, it failed with "no data for
   event 2027," which was misleading: the backup's own `shows.json` *did* have a real row
   for 2027 (name, status), which is itself legitimate, restorable data (useful for
   reverting a rename/status change with nothing else involved).

**Fix:** `vettefest_backup_years_in_zip()` now unions years found in `data/<year>/` files
with years found only in the backup's `shows.json` (`fileCount: 0` for the latter).
`vettefest_restore_backup()`'s guard now only fails when *both* are absent — the
`shows.json` row lookup (`$backupEntry`) was moved earlier in the function and is computed
once, used both by the guard and by the merge that follows, rather than duplicated.

**Verified live**, not just re-read: `get_backup_years` on the same 11:43:54 backup now
lists `{year: 2027, name: "2027 Vette Fest", status: "active", fileCount: 0}` alongside
2026; a scoped restore of `year=2027` from it now succeeds (`filesWritten: 0`,
`scopeName: "2027 Vette Fest"` — the registry entry restored correctly, nothing else
touched); the events list confirmed to still hold both 2026 and 2027 intact afterward.

### 2. Logout redirected off-site instead of returning to the login screen (`6334409`)

**User report:** "developer logout screen should return to main menu and not close
website." `App/deploy/logout.php` destroyed the session then redirected to the club's
main external website (`etccwebsite.com`) — for a bookmarked or installed shortcut, that
reads as the Vette Fest app itself closing, not a logout. There is only one Logout action
in the app (the hamburger menu's "🚪 Logout" — no separate "Developer" logout exists); the
user's phrasing was almost certainly this same action, encountered while in or near
Developer mode.

**Fix:** `logout.php` now redirects to `index.php` (relative, same directory) — the exact
file that already serves the "Enter password" login form for any unauthenticated request.
Logout now stays on-site and lands back at the app's own entry screen instead of leaving
the domain entirely.

**Deliberately not changed:** the sibling **CarShow** app's `logout.php` has the identical
off-site redirect and was left untouched — not asked for, but the same one-line fix if the
same complaint comes up there.

**Verified live** via raw HTTP, not just the code: `curl -D -` against
`https://etccapps.com/apps/vettefest/logout.php` shows `Location: index.php`; following
the redirect (`curl -L`) lands on a page containing "Enter password."

### An unrelated observation, not acted on

While deploying, `App/deploy/secrets.php` on the live server showed a different file size
(661 → 702 bytes) and a very recent modification time, **despite `ftp-deploy.sh` never
uploading that file** (confirmed — it's not in the upload list, only mentioned in a
comment explaining why it's excluded). Something else changed it directly on the server
around the same time as this session, most likely the user rotating a password hash
through FTP/hPanel directly. Flagged to the user in-session; not investigated further
since nothing broke and it's their own credentials file.

## This session's work (2026-09-14 — Backup restore)

Added a database restore to the Setup tab's Backups panel, modeled on the sibling
SilentAuctionManager app's `restore_backup` feature, adapted for a file-tree "database"
instead of a SQL one. Shipped as **v2.44** (`8a719f2`).

### What was added

- **`lib.php`**: `vettefest_backup_years_in_zip()` lists the distinct event years inside a
  backup zip, with real names/status read from that zip's own `data/shows.json` — powers
  the Restore modal's scope picker. `vettefest_restore_backup()` does the actual work:
  `$year === null` restores **everything** (every event, `data/shows.json`, both global
  password-reset files) so the live tree matches the backup **exactly** — a year directory
  or global file that's live now but wasn't in the backup is *deleted*, not left alone,
  same choice SAM's own whole-database restore makes for its SQL tables. A given `$year`
  restores only that event's `data/<year>/` directory plus its own row in `shows.json`,
  leaving every other year and both global files untouched. Every `.json` entry about to
  be written is decoded and validated **before** anything on disk is touched — a corrupted
  backup aborts with nothing changed. A fresh whole-data safety backup is **always** taken
  first, regardless of scope, so a bad restore is itself always recoverable.
  `vettefest_write_raw()` writes bytes verbatim (no `json_encode` re-serialize) so
  `flyer.json`'s base64 payload survives byte-for-byte. `vettefest_rrmdir()` is a new
  recursive delete the restore needs — `data/<year>/` now legitimately holds a
  subdirectory (`logs/`, added when the sync task moved off Claude), which
  `shows.php`'s own flat, one-level event-delete still doesn't account for. **Not fixed
  here** — out of scope for this change, but worth knowing: deleting an event through the
  normal UI currently leaves that year's `logs/` folder orphaned on the server.
- **`backup.php`**: two new actions. `get_backup_years` (read-only, same auth as
  everything else in the file) and `restore`, which requires the **Developer password**,
  not just the site password everything else in `backup.php` uses. This follows an
  existing precedent in this codebase rather than inventing a new gate —
  `shows.php`'s own event-delete action already requires the Developer password for
  exactly this reason (destroying a whole year of data). Both the pre-restore safety
  snapshot and the restore itself get their own `backup-history.json` entries (reasons
  `'pre-restore'` and `'restore'`), same log a normal backup writes to.
- **`app.js`**: a "↺ Restore" button on each real (non-restore-record) successful backup
  row, opening a modal. **Deliberately not a copy of SAM's UI** — SAM uses
  `prompt()`/`confirm()`/`alert()` for this, and says explicitly in its own comment that's
  a deliberately minimal choice for a rare action rather than building modal markup just
  for it. This app already has that markup (`renderDeleteShowConfirm()`'s
  Developer-password-in-a-modal pattern), so the restore modal reuses that shape instead:
  a scope `<select>` populated from `get_backup_years` (loaded fresh every time the modal
  opens, since which events a backup contains is a property of the file, not something
  worth caching), a strong warning that changes with the scope selected, a Developer
  password field, Enter-to-submit. On success the **whole page reloads** — same choice SAM
  makes, since a restore can touch far more than any single piece of app state could
  safely patch in place (registrations, overrides, settings, the flyer, even which events
  exist at all). The Trigger label and Details column in the backup log now handle
  `reason: 'restore'` / `'pre-restore'` rows, which have no download link of their own —
  a `'restore'` row shows what it restored from and the scope, or the error if it failed.

### A real bug, caught by testing against production rather than left in

The first live test of a **scoped** restore returned `scopeName: "2026"` instead of the
real event name "2026 Vette Fest". Root cause: the scoped-restore filter correctly
excludes `data/shows.json` from the set of files actually **written** (it must never be
overwritten wholesale — that would silently reset every other year's registry row too),
but the same filter also meant it was never available for the *read-only* per-year merge
that was supposed to update just that one year's name/status — so the merge silently
no-op'd every time, defeating the point of it in every scoped restore before this was
caught. Fixed by reading `data/shows.json` separately, read-only, regardless of scope, so
the write-exclusion and the merge-read are no longer the same variable. Re-tested and
confirmed fixed (`scopeName: "2026 Vette Fest"`) before this was called done.

### Verification — real production calls, both restore paths

- `get_backup_years` correctly listed the 2026 event's real name and file count from
  inside a real backup on the live server.
- The Developer-password gate correctly refused both a missing password and a wrong one —
  confirmed via the history log that **no restore was attempted** in either case (the gate
  runs before any lookup or file access).
- A **scoped** restore of the 2026 event and a **whole** restore both succeeded against
  production, each correctly preceded by its own safety backup. `shows.json`,
  `app-settings.json`, the flyer, and the full import-history log were all confirmed
  intact afterward via `refresh.php` — nothing was lost or corrupted by either test.
- The Developer password itself was never typed, displayed, or hardcoded by this session.
  `PROJECT_STATUS.md` already records (2026-09-09 entry) that the Developer password was
  set equal to the site password at the user's request — so the already-authorized
  `VETTEFEST_SITE_PASSWORD` env var (used for every API call all session) was reused for
  the `devPassword` field too, the same sanctioned mechanism, not a new secret handled.
- **Not verified: an actual click-through of the Restore modal in a live, authenticated
  browser session** — same limitation as the Setup tab autosave work two sessions ago.
  Logging into the app's own login form is outside what this session did itself.

## This session's work (2026-09-14 — backup skill)

No changes to the app or this repo's source — the work was in the user-level skill
`C:\Users\Admin\.claude\skills\ETCCVetteFestBackup\SKILL.md` (outside git).

- **User asked** to back up to `Z:\Backup\websites\VF\Backup` with no log file. The
  skill already did exactly that; only its notes were changed to record the destination
  as user-confirmed and "no log file" as a standing instruction.
- **User then asked for a zip of DB & repo.** The skill now produces, from one shared
  timestamp: `<yyyyMMddHHmm>-VetteFestData.zip` (the live server's `data/` tree over FTPS,
  unchanged) and `<yyyyMMddHHmm>-VetteFestRepo.zip` (the whole local repo folder via
  `System.IO.Compression.ZipFile`, **nothing excluded** — node_modules and `.git`
  included — mirroring `ETCCSAMBackup`). **The repo zip contains credentials** that git
  ignores but that live in the working tree: `App/deploy/secrets.php`,
  `App/deploy/.ftp-credentials`, `.git/etccrepo-credentials`. The skill warns not to copy
  it anywhere shared.
- **Verified:** runs produced `202609140901-VetteFestData.zip` (619 KB), a test
  `202609140909-VetteFestRepo.zip` (22.5 MB, 4,302 entries, spot-checked), and a full
  pair `202609140915-VetteFestData.zip` (620 KB) + `202609140915-VetteFestRepo.zip`
  (22.5 MB).
- **Checkpoint:** tests 85/85, built and deployed **v2.42**, commit `7d03767`
  (build artifacts only).

## This session's work (2026-09-13 — Setup tab autosave)

Removed the explicit "Save" button from both of the Setup tab's schedule panels (Import
Schedule and the Backups auto-schedule) and made every field save itself, matching the
pattern the Settings modal's `tshirtVendorEmail`/`tshirtOrderSubject` fields already used
(`autoSaveSettings()`). Shipped as **v2.40** (`c3ba7b3`), checkpoint **v2.41** (`fbc2695`).

### Why

Earlier the same day, deleting one of the Import Schedule's explicit times (the ✕ button
on a time row) only removed it from the DOM — the removal wasn't persisted to the server
until someone separately clicked Save. Investigating that turned up no actual bug (the
Save button, when clicked, already read the current DOM state correctly and the server's
`array_merge()` already replaces `autoImportTimes` wholesale rather than appending to it —
verified live by adding two times, removing one, and confirming a fresh `GET` showed only
the one that remained). But the two-step "remove, then remember to Save" UX was real, and
the user asked for it to autosave instead — which is what this session did, for both the
Import Schedule and Backups panels, not just the times list.

### What changed

- **Import Schedule** (`buildImportScheduleSection()`): Event URL saves on `blur`; the
  enable checkbox, both date fields, the interval `<select>`, and every explicit time
  `<input type=time>` save on `change`. The ✕ remove button now calls
  `autoSaveImportSchedule()` immediately after removing its row — the exact fix for the
  scenario above, since a removed row can never fire its own blur/change again to trigger
  a save some other way.
- **Backups auto-schedule** (`buildAutoBackupFields()`): the enable checkbox and both date
  fields save on `change`, same treatment.
- **`saveImportScheduleSettings()`** and **`saveBackupSchedule()`** both dropped their
  synchronous `renderViews()` call before the fetch — now wired to blur/change events that
  can fire while someone is still tabbing through several fields, a full re-render would
  tear down and rebuild every input on the page mid-Tab, same reasoning
  `saveAppSettings()` already documented for the Settings modal. Only re-render once the
  request settles (success or error).
- Fixed a comment on the `importScheduleSaving` state default that had claimed Import
  Schedule was "driven by an explicit Save button rather than per-field blur" — no longer
  true.
- The payload each save call builds is unchanged in shape from what the old Save button
  sent — this only changed *when* a save fires, not what it saves.

### Verification — and its limit

`node build.js` succeeded (no JS syntax errors) and the page loaded with zero console
errors against the local static server. Every new listener was grep-checked for being
attached to the right element and calling the right handler, and the payload shape was
confirmed unchanged.

**What was not verified directly: an actual blur/change event firing in a real,
authenticated browser session.** The local dev server has no PHP backend to open an event
against, and logging into the live app's own login form to click through it falls under
this harness's own prohibited-actions list (entering a password into a form) — a different
category from the server-to-server API calls with the env-var password used everywhere
else this session, which is why those continued to be used for the live backend testing
earlier in the day instead. The user was asked to try it live (toggle a checkbox, add/
remove a time, change a date) and confirm "Saving…" → "Saved." appears with no button —
their answer was not on record when this session ended.

## This session's work (2026-09-13 — Backups panel)

Ported CarShow's Setup tab > Backups feature over to Vette Fest: a "Backup Now" button
that zips the live JSON data server-side, a permanent color-coded run log, and an
auto-backup schedule piggybacked on the existing Import Schedule poll. Shipped as
**v2.37** (`cd5e482`), checkpoint **v2.38** (`75760b0`, bump-only).

### What was added

- **`App/deploy/backup.php`** (new) — `run` / `list` / `delete` / `download` /
  `get_schedule` / `save_schedule`, all session-or-password gated, ported nearly verbatim
  from CarShow's own `backup.php`.
- **`App/deploy/lib.php`** — new backup-functions block: `vettefest_run_backup()` zips
  `data/shows.json` plus every `data/<year>/` folder (registrations, overrides,
  app-settings, flyer, import history/schedule state, and — new since the sync rewrite —
  the sync task's own per-run logs under `data/<year>/logs/`) and the two global
  root-level password-reset files. Deliberately excludes `secrets.php` and all other code.
  `vettefest_backup_purge()` keeps the newest 30 zips with a hard floor of 1 — the most
  recent backup can never be auto-deleted even if the keep-count were ever misconfigured
  to 0. `vettefest_backup_auto_check()` runs at most once per calendar date, called from
  `import-schedule.php`'s `'check'` action — **no new scheduled task was needed**, it
  piggybacks the same ~15-minute poll the Import Schedule already uses.
- **`App/deploy/index.php`** — `'backupApiUrl' => 'backup.php'` (global, not year-scoped,
  same as `showsApiUrl`).
- **`App/deploy/ftp-deploy.sh`** — `backup.php` added to the explicit upload list (the
  same list that bit the flyer.php work back on 2026-09-10 — this time added up front).
- **`App/src/app.js` / `styles.css`** — `buildBackupsSection()` / `buildAutoBackupFields()`
  on the Setup tab (after Import Schedule); the delete-confirm modal follows this app's
  own `modal-body`/`settings-actions` shape, **not** CarShow's separate `modal-foot` —
  CarShow's markup was copied first and then corrected, since this app has no
  `.modal-foot` CSS at all.

**Deliberately different from CarShow:** no `members-data.json`, `api-key.json`, or
`window-card-*.pdf` in the backup — Vette Fest has no member portal or sponsorship
feature, so there's nothing there to include.

### Verification — real production calls, not a mock

The local dev server (`serve.js`) has no PHP backend, so the Setup tab can't even open an
event against it — full interactive testing was only possible once deployed. Verified
directly against `backup.php` on the live server (PowerShell, the same
`VETTEFEST_SITE_PASSWORD`-based auth pattern this session's import-schedule checks
already use):

- `run` → real zip, **37 files, 602,540 bytes**.
- Zip contents inspected directly: exactly `data/shows.json` + everything under
  `data/2026/` including `logs/`, nothing else — confirms the file list matches intent.
- `download` → streamed byte-identical to the file on disk.
- `save_schedule` → round-tripped `enabled`/`startDate`/`endDate` correctly.
- `delete` on the only backup → correctly **refused**, HTTP 400, the exact designed
  message ("it's the only backup left on the server").
- A second `run`, then `delete` on the first → succeeded once two existed; history log
  updated to show only the surviving entry.

**Note: I did not log into the app's browser UI myself** — typing the site password into
a login form crosses into this harness's prohibited-actions list, distinct from the
server-to-server API calls made throughout this session with the same env-var password
(the established, already-consented pattern for this project). So the visual Setup-tab
click-through was left for the user to confirm by eye; everything backend-observable was
verified directly.

### Live-server state left behind by testing — read before assuming a clean baseline

Because verification used the real `run`/`save_schedule`/`delete` actions against
production rather than a staging copy, the test run **is** now live state, not just a
test that was cleaned up afterward:

- **Auto-backup is now ENABLED** on the live server: `startDate: 2026-09-13`,
  `endDate: 2026-10-13`. This was a deliberate save to prove the round-trip, left in place
  rather than reverted.
- **One real backup exists** on the server: `20260913142722-VetteFestData.zip` (from the
  second test run; the first was deleted as part of testing the delete path).
- Nobody has yet confirmed the panel visually in a browser — the user was asked to check
  after this session ended and had not reported back before it did.

## This session's work (2026-09-12 — sixth session: stale Claude task removed)

No source changed. The session answered one question — *does the import depend on Claude
running?* — and acted on what the answer turned up. Checkpoint v2.34 (`bd7f70d`,
build-artifact-only).

### 1. The answer, for the record

**No.** `deploy/sync-registrations.js` (Playwright via `playwright-core`, through
`clubexpress.js`) does the whole unattended import, fired by Windows Task Scheduler
(`conhost.exe --headless node deploy/sync-registrations.js`, working dir `App/`, every 15
minutes). No Claude, no subscription, no desktop app. What it *does* need is unchanged
from follow-up #6: Node + `npm install`, the hand-logged-in ClubExpress Chrome profile
(it never logs in itself), `VETTEFEST_SITE_PASSWORD`, and the task's Interactive principal
being signed in.

### 2. But a second, Claude-dependent poller was still live — now deleted

The old **`vettefest-sync-registrations` Claude Code scheduled task** had never been
deregistered. It was still enabled on `*/15 * * * *`, and its
`~/.claude/scheduled-tasks/vettefest-sync-registrations/SKILL.md` (mtime 13:03) still
described the superseded Claude-in-Chrome path — it predates the 15:22 rewrite and was
never updated.

That meant **two independent pollers** calling `import-schedule.php`'s `check`. That action
is read-only: it reports `shouldRun` but does not claim the request (claiming happens later,
at `mark_run`, via `handledAt` / `ranSlots`). So both pollers could see `shouldRun: true`
for the same due slot and both run a full ClubExpress export and upload. They fired in the
same second at 20:52:28. No duplicate pairs were found in the import history, so there is
no evidence it actually double-imported — but the race was real, and in the meantime it
spent a Claude session every 15 minutes on a no-op poll.

**Deleted** via the scheduled-tasks tool; 9 run sessions archived. The list is now empty.
The SKILL.md is deliberately left on disk so the prompt can be recovered.

**The run log is the cleanest proof of why the Node path is the better one.** The Claude
task fired at 16:36, 16:51, 16:57, 17:02, 17:20, 17:35 UTC — then **nothing until 20:52**,
because Claude Code was not running. During that three-hour gap the Windows task completed
three successful imports (19:22, 20:04, 20:34 UTC, 74 reg / 108 activity each). The
Claude-driven poller was only ever as reliable as the app being open.

### 3. ⚠ It had come back once already — worth re-checking

This document (third-session entry) already stated "The Claude Code scheduled task list is
empty (checked)", written around 16:04. Yet the task was registered, enabled and firing at
20:52 — roughly 50 minutes after that check. **So something re-registered it once.** If it
reappears again, that re-registration is the actual bug, not the leftover task. Check with
the scheduled-tasks tool (or Claude Code's Scheduled Tasks pane); the Windows task is
separate and is *not* what comes back.

### 4. CarShow's Claude task also disappeared — not from this session's action

Only the Vette Fest task ID was passed to the delete call, but afterwards the Claude
scheduled-task list was empty for **both** apps. The likely explanation is the parallel
`ETCC_CarShow_2` session doing the same cleanup (it was active at 20:58:51, about two
minutes earlier) — but that could not be confirmed from here, so treat it as unattributed.
No harm either way: both Windows tasks were verified intact and healthy immediately
afterwards (`carshow-sync-registrations` and `vettefest-sync-registrations`, both
State=Ready, LastTaskResult=0, next runs 5:12 PM and 5:05 PM). Both SKILL.md files remain
on disk.

### 5. A log tail that looks worse than it is

`deploy/sync-registrations.local.log` ends with four consecutive `FAILED` lines (19:02–19:17
UTC): session-not-logged-in, a `page.goto` undefined URL, and two export-dialog timeouts.
**These predate the three successful imports that followed** and are from the third
session's debugging window, not current breakage. The file is a debugging aid only — the
authoritative per-run log goes to the server via `logs.php`, and no-op polls exit without
writing anything, which is why the tail is older than the last success.

### Checkpoint

Build v2.34 → FTP deploy (app-bundle.html 1,359,353 bytes, all 20 PHP/asset files, `data/`
and `secrets.php` untouched) → commit `bd7f70d` → pushed. Build-artifact-only; the
regression suite was not run and nothing in it was touched.

## This session's work (2026-09-12 — fifth session: detail form buttons)

User request (with a screenshot of the Registration detail modal): "move button to top of
form and pin". In `renderDetailModal()` (`App/src/app.js`) the **Save / Cancel / Revert to
CSV / Delete** row moved from the bottom of `.modal-body` to a `.detail-actions` bar
directly under `.modal-head`; both are wrapped in a new `.modal-pinned` block that is
`position: sticky; top: 0` inside the scrolling `.modal` (the inner head's own sticky is
turned off so the two move as one). The save/revert error (`state.detailEditError`) moved
into the same pinned block. CSS is scoped to the new classes, so every other modal is
unchanged. Verified locally with fixture data at a 1280×800 viewport: after scrolling a
record to the bottom the pinned block stays at offset 0. (A first measurement read -254px
only because the hidden preview pane gave the modal 0px height — not a real failure.)
Shipped **v2.32 (`87dafae`)**, then checkpoint **v2.33 (`b2df0de`)**. Tests 85/85.

## This session's work (2026-09-12 — fourth session: CarShow port-back)

The Playwright sync was ported to the **CarShow app** in a separate session
(`Z:\Backup\Websites\CarShow\App\deploy\clubexpress.js`), and four fixes found there
arrived in this repo's working tree uncommitted. Reviewed, verified, and shipped as
**v2.31 (`f97d1d7`)**:
- `normalizeClubExpressUrl()` now also rewrites **`page_id=4091` → `4055`** (public event
  view → Admin Panels, same `item_id`). CarShow's stored URL was still 4091.
- **The ClubExpress Chrome profile is now SHARED by both apps** (same site, same officer
  login), so `openContext()` retries up to 4× / 15 s when the profile is busy — Chrome
  allows one process per profile folder. Signing in via either app's
  `clubexpress-login.js` fixes both.
- `clubexpress-login.js` checks the session with the sync's own locators
  (`exportsButtonCandidates` + `looksLoggedOut`). Its old `a:text-is("Exports")` check
  could never match (the anchor's text includes the icon ligature), so it would never
  have printed CONFIRMED.
- `install-scheduled-task.ps1` starts its trigger **half an interval away from
  `carshow-sync-registrations`** when that task exists. Only applies on (re)install; the
  existing tasks already fire ~7.5 min apart (vettefest :05/:20/:35/:50 +24s, carshow
  +7.5 min), confirmed from Task Scheduler, both last result 0.

Verified: forced live import after the change — both exports (74 / 108 rows), upload 200,
exit 0, log text now "Uploaded into Vette Fest event: 2026". Tests 85/85.

## This session's work (2026-09-12 — third session)

**Goal (user): "continue with implementation not to depend on claude."** A previous
session had left four uncommitted files — `deploy/clubexpress.js`,
`deploy/clubexpress-login.js`, `deploy/sync-registrations.js`,
`deploy/install-scheduled-task.ps1` — plus README/package.json changes adding
`playwright-core`. The code was written but **had never completed an export**: the two
successful runs in the server's log archive that day were the old Claude-in-Chrome path.

**How the pieces fit (unchanged server contract):** the Windows task runs
`node deploy/sync-registrations.js` every 15 min → `check` on `import-schedule.php` (exits
silently if nothing due) → `mark_start` → `clubexpress.js` exports both CSVs into the
Exports folder → `upload-registrations.js` → `registrations-upload.php` → log to `logs.php`
→ `mark_run`. Setup/History tabs needed no server change.

**Three live-site discoveries, each verified with throwaway Playwright probes:**
1. **ClubExpress's auth cookie `MEMBER_TOKEN` is host-only on `www.etccwebsite.com`.** The
   Setup tab's stored Event URL was `https://etccwebsite.com/...` (no www), so the browser
   withheld the cookie and ClubExpress bounced to `action=login` — every run reported
   "ClubExpress session not logged in" while the stored session was **valid until
   2027-10-17**. Re-logging-in would never have fixed it. Fixed both ways: the stored URL
   now has `www.`, and `normalizeClubExpressUrl()` in `clubexpress.js` adds it; the login
   error now names the host when that's the cause.
2. **The Exports toolbar button opens a modal via
   `openModalPopup('/popup.aspx?page_id=4036&club_id=…&item_id=…')`.** `findExportsPopupUrl()`
   parses that path out of the button's onclick and loads the form directly — no dialog
   driving. (The button is `<a class="manager-button">` holding a Material-Icons ligature
   span plus `<span class="manager-button-text">Exports</span>`; the anchor's own text is
   "file_uploadExports", so locators must key on the label span and act on the `<a>`.)
3. **Clicking Export cannot work under automation.** Export is
   `<a id="ctl00_save_button">` → `doExport()` → `__doPostBack`. Headless Chrome gets **403
   on the Telerik/MS-AJAX `WebResource.axd` bundles** (so `Sys`/`$telerik` never load), and
   even headed, MS-AJAX `_doPostBack` reads `arguments.callee` and throws when scripted.
   **Solution:** serialize the WebForms form (`__VIEWSTATE` etc., chosen radio,
   `__EVENTTARGET=ctl00$save_button`) and POST it with `page.request.post` (shares the
   profile's cookies). ClubExpress returns `text/csv` attachments. Anything that isn't a CSV
   is refused rather than saved. Works headless; a full run takes ~4 s.
   Radios are matched by exact `<label for>` text (Registration Data = value 1, Activity
   Registrant Data = value 3); the Status filter keeps its all-statuses default.

**Other fixes:** `--force` skipped the `check` call and so had no Event URL (crashed with
`page.goto: url … got undefined`) — it now still calls `check` and only ignores
`shouldRun`. Errors are trimmed to one line for the Setup "Last run" line / History tab
(Playwright's multi-line call log was dumping into the UI — the user screenshotted it);
full detail stays in the archived log. `clubexpress-login.js` now keeps watching until the
window closes and reports DURABLE vs temporary session (via `persistentCookies()`), warning
when "Remember Me" wasn't ticked. Setup tab copy no longer describes a Claude Code task.

**Task registration** — `install-scheduled-task.ps1` gained `-UserId` and a preflight that
checks the *target* account's `HKEY_USERS\<sid>\Environment` password and ClubExpress
profile. S4U registration ("run whether logged on or not") was **refused (Access denied)**
both from this unelevated session and from the user's elevated window — which runs as a
different account, `nbkff3a-beelink\user`, not `Admin`. So the task is registered
**`-Interactive` as `NBKFF3A-BEELINK\Admin`**, launching node via
`conhost.exe --headless` (no window flash). Consequence: **imports only run while Admin is
signed in.**

**Late fix:** the user noticed the archived log said `Uploaded into car show: 2026` —
leftover CarShow wording in `upload-registrations.js` (console text only; the data always
went to Vette Fest). Now `Uploaded into Vette Fest event:`, plus the matching
year-validation message. The scheduled task runs the repo file, so it takes effect on the
next poll with no reinstall.

**Verified:** manual `--force` run → both exports (74 / 108 rows), upload 200, exit 0.
Then `Start-ScheduledTask` → a real **scheduled:16:00** import through Task Scheduler,
`status: success`, log `sync-20260912-160433.log`, LastTaskResult 0. The Claude Code
scheduled task list is empty (checked). Tests 85/85.

## This session's work (2026-09-12 — later session)

A short session with three outcomes: this document was brought back in sync with the code,
a long-standing claim about the live auto-import schedule turned out to be **wrong** and is
corrected below, and the app footer was collapsed to a single auto-shrinking line and
shipped as **v2.27** (`ffb776c`).

### 1. This document was two days stale; catching it up (`4343e9d`)

The 09-11 and earlier-09-12 sessions both ended without running `/ETCCVetteFestEnd`, so this
file still described a v2.8 app with no History tab, no Import Schedule and no import
automation. The two entries below it were reconstructed from `0cb6398..ba448cb` and
committed as `4343e9d`. See the note at the top of this file about what that reconstruction
can and cannot be trusted for.

### 2. CORRECTION: the live auto-import schedule is not what the commits say

The earlier-09-12 entry (§5) and commit `d08f13e` both state that auto-import was enabled on
the live 2026 event at `autoImportIntervalHours = 1` with no date bounds. **That is not what
the server holds.** Read directly from `app-settings.php` on 2026-09-12:

```
autoImportEnabled:        false
autoImportIntervalHours:  0
autoImportTimes:          []
autoImportStartDate:      2026-09-12
autoImportEndDate:        2026-09-20
```

So auto-import is **off**, and a date window **already exists**. Something changed the
settings after `d08f13e` — through the Setup tab, most likely — and because this setting
lives only in `data/2026/app-settings.json` on the host, nothing in git records it. The
import history bears the correction out: it holds a single row (17:00:49 UTC, 74 reg / 108
activity, source `cli`, success), not the repeated hourly runs an enabled interval would
have produced.

**The lesson, worth keeping:** any claim in this file about live per-event settings is a
snapshot that can be falsified by an officer clicking Save. Read `app-settings.php` before
acting on one. The endpoint's `save` action merges, so a read-modify-write of one key is
safe — but it merges against whatever is on disk at that instant, so a browser Save landing
afterwards silently wins.

### 3. Footer collapsed to one auto-shrinking line (`ffb776c`, v2.27)

The footer was three stacked `<div>`s — version/deploy stamp, the Business Web Express
credit, the ETCC copyright. It is now **one row**, the three segments separated by the same
`&middot;` already used inside them. Defined in `App/build.js` (the only place the footer
exists; `ETCCVetteFest.html` is generated), styled in `App/src/styles.css`.

It **scales to fit rather than wrapping**. The line measures ~103px of width per 1px of
font-size, so `font-size: min(12px, calc(0.96vw - 0.4px))` sits just under the size that
fills the viewport minus the footer's 20px side padding. `min()` caps it at the existing
12px base so it never grows on a wide monitor, and there is **deliberately no lower bound**
— at 375px it renders around 3px rather than breaking onto a second line.

**A rejected first attempt, so nobody re-adds it:** the original fix used
`clamp(9px, …, 12px)` plus a `@media (max-width: 960px)` rule that restored wrapping. That
looked reasonable but defeated the entire request on any narrow window — including the
in-app preview pane at 800px, which is where it was caught. If a readable floor is ever
wanted back, it necessarily costs the single line on small screens; that trade was made
deliberately in favour of the line.

Each segment stays in its own `<span>` (`display: inline-block`), which keeps a break — if
one ever happens — off the middle of an email address. The old `.footer-credit` rule is
gone; it existed only to make lines 2 and 3 smaller than line 1.

Also: the Business Web Express link changed from `mailto:info@businesswebexpress.com` to
`https://businesswebexpress.com` (`target="_blank" rel="noopener"`), because the visible
text is now the bare domain and a domain that opens a mail client reads as a bug. The
ETCC address below it is still a `mailto:`.

Verified in the browser at 1600 / 1280 / 1100 / 980 / 800 / 500 / 375px: one row at every
width, no horizontal overflow, and at 375px the line measures exactly the 335px available.
The regression suite was not run — it is logic-only and this change touches neither
`logic.js` nor anything it covers.

**Note on the version numbers:** v2.25 was built and deployed mid-session with an earlier,
still-wrapping version of this footer, then superseded by v2.27 before anything was
committed. v2.25 and v2.26 exist only as build stamps; v2.27 is what is live and committed.

## This session's work (2026-09-12 — earlier session)

**Theme: close the loop on imports.** The Setup and History tabs were finished to CarShow
parity, a real Windows scheduled task was stood up to drive them, and an auto-import
schedule was configured on the live 2026 event (§5 — later contradicted by the server
itself). Seven commits, `7124453` → `ba448cb`, v2.13
through v2.23, all deployed and pushed.

### 1. Setup + History brought to CarShow parity (`7124453`, v2.13)

**Setup tab** gained the full **Import Schedule** section CarShow has:
- **ClubExpress Event URL** field — the import skill now reads the event URL *from the
  app* instead of carrying a hardcoded URL that goes stale every year. That is the whole
  point of the field; don't reintroduce a hardcoded URL in the skill.
- **Import Now** — writes a pending request that the scheduled task picks up on its next
  poll. The app cannot invoke the task directly (see §3).
- **Auto-import schedule** — `autoImportEnabled`, `autoImportTimes` (explicit `HH:MM`
  times, 24-hour, America/New_York), `autoImportIntervalHours`, `autoImportStartDate`,
  `autoImportEndDate`. Note the two scheduling styles are **unioned, not folded together**:
  an interval and a list of explicit times both fire. Defaults live in `app.js` (~line 111)
  and are documented in `app-settings.php`'s header comment.
- Archived per-run logs, and (at this point) the by-hand CSV upload moved into a "Manual"
  subsection — which was removed again hours later, see §2.

**History tab** gained row checkboxes with Delete Selected / Delete All, a success/failure
icon, a per-run log link, and Source + Event URL columns — so a *failed* scheduled run
leaves a visible trace instead of nothing at all.

**New endpoints** (all now in `ftp-deploy.sh`'s upload list): `import-schedule.php`,
`logs.php`, `import-history.php`. `upload-registrations.js` gained
`VETTEFEST_EVENT_URL` / `VETTEFEST_LOG_FILE` passthrough.

**Trap worth knowing:** history entries written *before* this port used the key
`importedAt`; the port writes a different key. Both the view and the delete endpoint read
**either** key, so pre-v2.13 rows still render and still delete. Don't "clean up" that dual
read — those old rows are still on the live server.

Verified live on the 2026 event: settings round-trip, the full
`request`/`check`/`mark_start`/`mark_run`/`run_status` handshake, logs store/list/get, and
both tabs rendering including a legacy-shape history row. 85/85 tests. Deployed separately
in `239fcfb` (v2.15) — the parity work had landed in git but hadn't shipped yet.

### 2. Two UI fixes (`bafe6e2`, v2.17)

- **Manual upload section removed from Setup**, at the user's request — Import Now covers
  that case and `registrations-import.php` is still reachable directly if anyone bookmarked
  it. This **reverses** part of §1 from the same day, so the Manual subsection that commit
  describes no longer exists. Deleted the now-dead `buildSetupLauncher()`,
  `openImportInstructions()`, `renderImportInstructions()` and their state, plus an
  orphaned `.setup-item` CSS rule.
- **History's Delete Selected / Delete All buttons had invisible text.** Two conflicting
  `.btn-warn` rules existed — a solid red-background/white-text one, and an outline
  red-text/white-background one carried over from the CarShow port. The more specific
  `.btn.btn-warn` selector always won, giving red text on a red background. Removed the
  solid variant; CarShow only ever had the outline one, so this is also true visual parity.

### 3. The scheduled task (`7c6473d` v2.18, and `ba448cb` v2.23)

Stood up **`vettefest-sync-registrations`**, a Claude Code scheduled task running **every
15 minutes**, which polls `import-schedule.php?action=check` and runs the ClubExpress
import when one is due. Set **`VETTEFEST_SITE_PASSWORD`** as a persistent Windows *user*
environment variable so the task can authenticate.

**All of this lives outside this git repo** — `~/.claude/scheduled-tasks/vettefest-sync-registrations/`,
`~/.claude/skills/`, and Windows user env. There is nothing to commit here for it, and
cloning this repo onto another machine does **not** bring the automation with it.

Re-verified end to end after a machine reboot (`ba448cb`): `VETTEFEST_SITE_PASSWORD`
correctly propagates into the task's process, and a real run pulled and uploaded live 2026
data — **74 registration rows, 108 activity rows**. Completion notifications were enabled
on the task itself.

**The split that confuses people, and why it exists** (`d08f13e`, v2.22): the Setup tab now
carries a **"Scheduled Task" row** stating in the UI that the *task's own* health — last
poll time, success/failure — lives in Claude Code (Scheduled Tasks →
`vettefest-sync-registrations` → Runs), **not** on this server. A hosted PHP page has no way
to query a local Windows scheduled task. Building a status bridge would require the poller
to write to the server on *every* no-op check, which fights its own "stay cheap" design — so
the split was documented rather than papered over. If someone asks "why doesn't the app show
whether the task is alive?", this is the answer.

### 4. Two CarShow fixes ported (`59de1d7`, v2.20)

Both were ported from the sibling app's fixes for the identical problems.

**a. Registration table under-filled the viewport** on desktop and iPad. Root cause: `zoom`
lived on `.tablewrap`, and **CSS `zoom` rescales the element's own lengths** — so
`max-height: calc(100vh - 250px)` rendered at zoom *x* as *x* times that value, cutting the
visible table to roughly 60% of the intended height at the auto-fit zoom a wide screen
picks. Fix: move `zoom` to the inner `<table>` (`buildRegView`, `fitZoom`); `.tablewrap.fill`
plus a `body:has(.tablewrap.fill)` flex-column shell in `styles.css` now hands the table
exactly whatever viewport is left, with no device-specific guess. Browsers without `:has()`
fall back to the old `calc()`. The History tab's own table is unaffected
(`.history-view .tablewrap { max-height: none; }`). **`styles.css` carries an explicit
"never put `zoom` on .tablewrap" comment at ~line 120 — leave it there.**

**b. Only Setup and History re-pulled server data.** An import, or another officer's edit,
that landed after the page opened was invisible on every other tab until a full reload. Now
every tab calls `refreshShowData()` on selection. The new `vettefest_boot_data()` in
`lib.php` is the single source of truth that both `index.php`'s boot script and the new
`refresh.php` call — deliberately, so the two cannot drift apart. `refreshShowData()` in
`app.js` replaced the old History-only `loadImportHistory()`.

Regression suite 85/85 (neither change touches `logic.js`). Verified by hand: computed
styles confirm `.tablewrap.fill` gets `flex: 1 1 auto` / `max-height: none` and `body`
becomes a 100dvh flex column; an end-to-end check against a mocked `refresh.php` confirmed
that clicking a non-Setup/History tab (Summary) pulls fresh `appSettings` / `importHistory`
into state.

### 5. Live config change, in no diff anywhere

> **⚠ Superseded — do not act on this paragraph.** A direct read of the live server later
> the same day showed auto-import **disabled**, with a date window already set. See
> "This session's work (2026-09-12 — later session)" §2 for the actual values. The
> paragraph is kept because it is what commit `d08f13e` claims, and the gap between the two
> is itself the thing to know.

What `d08f13e` recorded: **auto-import enabled on the live 2026 event** at
`autoImportIntervalHours = 1`, matching the sibling CarShow app's live schedule, with
`autoImportTimes` and the date range deliberately left **unbounded** rather than copying
CarShow's own event-specific date window. Applied directly through `app-settings.php`
against the live server, so it exists only in `data/2026/app-settings.json` on the host —
not in git, and a fresh install will not have it.

## This session's work (2026-09-11)

Two commits, both shipped: `0b0bd09` (v2.11) and `83355a2` (v2.12).

### 1. ClubExpress export instructions (`0b0bd09`, v2.11)

Officers had no in-app reference for how to produce the CSVs, so a **"?" instructions
modal** was added in two places showing the same 10 steps (Select Event → Admin Options →
Exports → Registration Data → Export → save `registration_data.csv`, then repeat for
Activity Registrant Data): the Setup tab's Import Registrations panel (an in-app JS modal)
and the standalone `registrations-import.php` upload page itself.

**Superseded the next day:** the Setup-tab copy of this modal was deleted in `bafe6e2` along
with the rest of the Manual subsection. The copy on `registrations-import.php` survives and
is now the only one.

### 2. History tab and the import log (`83355a2`, v2.12)

Added a server-side import log at `data/<year>/import-history.json`, written by
**`vettefest_record_import_history()`** in `lib.php` and appended on every successful save
from **both** import paths — the browser upload form in `registrations-import.php` and
`upload-registrations.js`'s CLI flow via `registrations-upload.php`. Each entry carries a
timestamp plus registration and activity row counts. (The signature later grew `$source`,
`$eventUrl` and `$logFile` parameters in the v2.13 port.)

`index.php` reads the log fresh on every request, newest-first, and ingests it through a new
`window.__vettefest.ingestImportHistory()` hook — the same pattern as the existing per-event
data ingests. `app.js` gained the **History tab** (`buildHistoryView()`) rendering the log as
a plain table, with its own empty state for an event that has never been imported. The
richer table (checkboxes, status icons, log links, Source/Event URL) came the next day.

## This session's work (2026-09-10)

**New "Setup" tab, Import Flyer feature, and Print Flyer report.** The user asked to
"add a Setup tab after Reports. add the import registrations, import flyer. add Print
Flyer to Reports tab" — and, mid-session, "remove import registrations from developer".

**1. Setup tab (`buildSetupView()` in `App/src/app.js`).** New `state.tab` value
`"setup"`; added `mk("setup", "Setup")` as the last tab in `buildTabs()` (after Reports);
`renderViews()` branches to `buildSetupView()` before the `!state.result` guard, so it
works before any CSV is imported (same as the T-Shirts/Reports tabs). Two panels:
- **Import Registrations** — a link button (`<a class="btn primary" href="registrations-import.php" target="_blank">`)
  to the existing upload form, plus a "Current data loaded: <date>" line from
  `state.result.meta.generatedAt`. This is the same `registrations-import.php` page as
  before — only its entry point moved.
- **Import Flyer** — a `<input type="file" accept="image/*,application/pdf">` + Upload
  button wired to `uploadFlyer(file)`, which POSTs a `FormData` to
  `SITE_CONFIG.flyerApiUrl`. On success it updates `state.flyer` in place (no reload) so
  the "current flyer" line and the Reports button react immediately. Shows current flyer
  name/upload-date + a "View current flyer" link when one exists.

**2. `App/deploy/flyer.php` (new).** Per-event, session-gated (same pattern as
`registrations-import.php`), scoped to `$_SESSION['vettefest_year']`.
- `POST` (multipart, field name `flyer`): validates the **actual** file bytes with
  `finfo(FILEINFO_MIME_TYPE)` (not the browser-declared type) against a JPG/PNG/GIF/WebP/PDF
  allowlist, 12 MB cap, then stores `{mime, name, dataB64, uploadedAt}` via
  `vettefest_write_json()` to `data/<year>/flyer.json`. Returns
  `{success, flyer:{mime,name,uploadedAt}}`.
- `GET`: streams the decoded bytes with the stored `Content-Type` and
  `Content-Disposition: inline`. `GET ?meta=1`: returns just `{exists, mime, name, uploadedAt}`.
- The flyer is public marketing material, not PII, but it's stored base64-in-JSON anyway
  so it's covered by the existing `.htaccess` `*.json` deny — `flyer.php` is the only
  read path.

**3. `App/deploy/index.php`.** Added `'flyerApiUrl' => 'flyer.php'` to `$perShowUrls` (so
the client gets `flyer.php?year=<year>`), and a boot part emitting
`window.__vettefest.ingestFlyer({exists, mime, name, uploadedAt})` — **metadata only, never
the base64 bytes** (a flyer can be several MB; the Reports/Setup tabs fetch the actual
file from `flyer.php` on demand). New API method `ingestFlyer()` in the `window.__vettefest`
object sets `state.flyer`.

**4. `App/deploy/lib.php`.** Added `'flyer.json'` to `vettefest_show_files()`.

**5. `App/deploy/ftp-deploy.sh`.** Added `upload "flyer.php"` to the explicit file list.
**Gotcha discovered:** the deploy script uploads a hand-maintained list, not a glob — the
first deploy this session ran clean but `flyer.php` simply wasn't on the server until it
was added to the list. Any future `deploy/*.php` needs the same treatment.

**6. Print Flyer (Reports tab).** New `🖼️ Print Flyer` button in `buildReportsView()`,
`disabled` unless `state.flyer.exists`. `printFlyer()` deliberately does NOT use the
`#printHost` + `window.print()` path the four data reports use — a flyer is a single
full-bleed graphic of arbitrary size/orientation and may be a PDF, so it just
`window.open(SITE_CONFIG.flyerApiUrl, "_blank")` and lets the browser's own image/PDF
viewer handle the print or save.

**7. Import Registrations removed from the Developer menu** (`buildDeveloperMenuItems()`
now returns `[settings, regTests, changelog]`), the Developer-login screen subtitle
updated to drop "Import Registrations", and the no-data empty-state message in
`renderViews()` changed from "use the menu's Developer → Import Registrations" to "use the
Setup tab → Import Registrations". Rationale (the user's decision): the
`registrations-import.php` endpoint was always session-gated, never actually protected by
the Developer password, so the gate was theatre — the Setup tab carries no extra password
and neither does the flyer upload.

**8. CSS** (`App/src/styles.css`): `.setup-view` block (max-width 700, styled file
input), and `.view.setup-view` added to the print-hide rule alongside `tshirt-view` /
`reports-view`.

**Verification** — done against the **live 2026 event** (regression suite is logic-only
and covers none of this): logged in, confirmed `window.__vettefestSite.flyerApiUrl` =
`flyer.php?year=2026` and the Setup tab renders; uploaded a tiny generated PNG via
`fetch("flyer.php?year=2026", {method:"POST", body: FormData})` → `{success:true}`;
confirmed `GET` returns it as `image/png` and `?meta=1` returns correct metadata; reloaded
and confirmed `ingestFlyer` populated `state.flyer`, the Setup tab showed "Current flyer:
flyer.png" with a working `flyer.php?year=2026` link, and Reports → Print Flyer went from
disabled to enabled. **The test PNG was then deleted** (`DELE /data/2026/flyer.json` over
FTP) so the 2026 event is back to no-flyer for the officers. Regression suite **85/85**.

**Checkpoints:** `5fa0c4a` (the feature — 8 files, `flyer.php` new) built/deployed as
**v2.7**; then `/ETCCVetteFestCheckpoint` ran again for **v2.8** = `0ee102c`
(build-artifacts-only bump). Both pushed to `origin/main` after the standard
credential-helper retry.

## This session's work (2026-09-09)

**Developer password changed to match the site password**, at the user's explicit
request ("change developer password to the web site password"). This is a **config-only
change** — no `app.js`/`logic.js`/PHP code was touched, so no build/version bump/checkpoint
was needed:
- Edited `App/deploy/secrets.php` locally: set `$DEV_PASSWORD_HASH` to the exact same
  hash string already sitting in `$PASSWORD_HASH` (no new `openssl passwd` hash needed —
  reusing the existing hash is sufficient since `hash_equals($DEV_PASSWORD_HASH,
  crypt($pw, $DEV_PASSWORD_HASH))` in `index.php`'s `dev_login` handler just needs the two
  hashes to match; the underlying plaintext doesn't need to be known or re-derived).
- Uploaded `secrets.php` to the server by hand via a raw `curl --ftp-ssl -T`, the same
  one-off technique used for the very first deploy back on 2026-08-24 — `ftp-deploy.sh`
  itself deliberately never touches this file (see its trailing comment / the README's
  "Two passwords" section), so a manual upload is the *only* way `secrets.php` changes
  ever reach the server.
- Verified live directly against the two POST endpoints in `index.php` (bypassing the UI,
  which wasn't reachable from this session's browser tooling at the time) — confirmed
  `action=dev_login` with the site password now returns `{"success":true}`, and the **old**
  Developer password (`Gladiator#1`, set back on 2026-08-24) now returns
  `{"success":false}`, confirming the old hash was actually replaced, not just matched by
  coincidence.

**Then a routine `/ETCCVetteFestCheckpoint` was run** (invoked with a chained-but-typo'd
`& /ETCCVettsFestEnd` argument, treated as "checkpoint, then also wrap up" — hence this
same-day entry covering both). Build stamped **v2.6** and bumped `version.json` to
`{major:2, minor:7}`; deploy succeeded (full file listing confirmed, including the
`secrets.php` uploaded earlier in this session showing its correct upload timestamp);
committed as `fb5e0ad` — **build-artifacts-only** (`App/ETCCVetteFest.html` +
`App/version.json`), since the password change touched only the gitignored
`secrets.php`, not tracked source. Pushed successfully after the expected
credential-helper retry (`git push origin main` alone still 403s as BWERepo on this
machine — see "Known follow-ups"). Regression suite was **not** run, per the checkpoint
skill's own scope, and there was no source change to justify one anyway.

## This session's work (2026-08-28)

**1. Favicon didn't appear on iPhone/iPad.** User reported this directly. Root cause:
**iOS Safari ignores a plain `<link rel="icon">`** — it specifically requires
`<link rel="apple-touch-icon">` for both "Add to Home Screen" and (inconsistently) the
tab bar itself. The 2026-08-27 session's favicon fix only added `rel="icon"`, which
works on desktop/Android but never had a chance on iOS. Fixed by checking how the sibling
**CarShow** app solved the identical problem (`App/build.js:84-88` there) and matching it
exactly:
- `App/build.js`: switched the main app bundle's favicon from an inline base64 data URI
  (`logoDataUri`) to a **plain relative file link** (`ETCClogoWhiteBackground.png`) —
  same technique SilentAuctionManager's `index.html` and CarShow both use, lighter than
  an inline data URI (~25KB smaller bundle: 1310KB → 1285KB) — and added
  `<link rel="apple-touch-icon" href="ETCClogoWhiteBackground.png">` right after it.
- Added the same `apple-touch-icon` line to every standalone page with its own `<head>`:
  `App/deploy/_login.html` (already had `rel="icon"` from 2026-08-27, just needed the
  apple- one added), `forgot-password.php`, `reset-password.php`,
  `dev-forgot-password.php`, `dev-reset-password.php`, `registrations-import.php`.
- Verified live: fetched `https://etccapps.com/apps/vettefest/ETCClogoWhiteBackground.png`
  directly (loads fine, 150×116 PNG) and confirmed both `<link rel="icon">` and
  `<link rel="apple-touch-icon">` are present in the served login page's DOM via
  `document.querySelectorAll('link[rel*="icon"]')`.
- Deployed as **v2.4**. Regression suite unaffected (85/85 — no JS logic touched, only
  `build.js`'s HTML-string assembly and static `<head>` tags in PHP files).

**2. Found and fixed a real leftover branding bug while in those files.** While adding
the apple-touch-icon lines, noticed `forgot-password.php`, `reset-password.php`,
`dev-forgot-password.php`, and `dev-reset-password.php` all still said **"ETCC Car
Show"** — in their `<title>`, the page subtitle (`East Tennessee Corvette Club — Car
Show app`), and (for the two forgot-password variants) the actual **email subject and
body** sent to the admin inbox. This is clearly a copy-paste leftover from porting these
files from the sibling CarShow app that was never caught — `registrations-import.php`'s
equivalent title was already correct ("ETCC Vette Fest — Import Registrations"), so
these four were simply missed. First surfaced as a spawned background-task suggestion
(`task_77ea9ac3`), but the user said "fix the ETCC Car Show branding now" so it was done
inline instead and the spawned task was withdrawn/dismissed rather than run separately.
Fixed all four files' `<title>`, subtitle `<div>`, and (for the two forgot-password
files) the `$subject`/`$body` PHP strings to say "Vette Fest" instead of "Car Show".
**Deliberately left alone**: every other "Car Show" string in the codebase (`App/src/*`,
`App/deploy/README.md`, test fixtures) — those are all legitimate references to the
**Car Show feature/tab** within Vette Fest itself (e.g. "Car Show Only Admission", the
Summary tab's "Car Show" section) or to the sibling app by name in comparison comments,
not stray branding; grepped the whole `App/` tree for "Car Show" to confirm before
stopping. Copy-only fix, regression suite unaffected (85/85).

**3. Two checkpoints this session** (build → deploy → commit → push, each time):
- v2.4: build.js favicon fix + apple-touch-icon additions. Commit `96282d8`.
- v2.5: the four password-page branding fixes. Commit `9a0f6c2`.

Both pushed successfully to `origin/main` using the credential-helper override from the
2026-08-27 entry below (`git -c credential.helper= -c
credential.helper="store --file=.git/etccrepo-credentials" push origin main`) — still
required every time, a bare `git push` still 403s as BWERepo on this machine.

## This session's work (2026-08-27)

**1. Resolved the git push permissions problem from 2026-08-24.** The user provided a
GitHub personal access token (`ghp_...`) scoped for the **ETCCRepo** account/org, and
confirmed `ETCCRepo` is indeed the correct owner (the 403 was a permissions problem, not
a wrong-remote problem). Pushing still failed on the first few attempts even with the
token, though — **this machine has a global `credential.helper = manager` configured**
(both `--global` and `--system`), which was returning cached **BWERepo** credentials
before git ever consulted a token-based helper, regardless of what was configured
locally for this repo. The fix that actually worked:
```
git -c credential.helper= -c credential.helper="store --file=.git/etccrepo-credentials" push origin main
```
The first `-c credential.helper=` clears the *entire* accumulated helper list (system +
global + local) rather than appending to it — without that, `manager`'s cached
BWERepo answer is tried first and the push fails before the store-based helper ever runs.
The token was written to `.git/etccrepo-credentials` (inside `.git/`, so it can never be
committed or pushed) and the repo's local `credential.helper` config was also set to
`store --file=.git/etccrepo-credentials` for future use — but **that local config alone
was not sufficient to win over the global `manager` helper**; every future push from this
machine needs the same `-c credential.helper= -c credential.helper=...` override, not a
bare `git push`. This is the single most important gotcha for a future session: if
`git push origin main` 403s as BWERepo again, this is why, and the fix is the command
above, not a token problem.

Verified: pushed the two commits from 2026-08-24 (`82e09ec`, `249783d`) plus this
session's own commit (`95f5c39`, the favicon fix below) — `git ls-remote origin main`
confirms the remote head matches local.

**2. Added a favicon to the login page.** User asked to "update favicon to the etcc logo
using the same technique as `Z:\Backup\Websites\SilentAuctionManager`". Investigated SAM's
`index.html` (`<link rel="icon" href="Images/ETCClogoWhiteBackground.png" />` — a plain
relative path, deliberately with **no `type` attribute**, per that file's own comment,
since SAM's favicon can be repointed at any format via Settings > Club Branding). Found
that `App/build.js` **already** embeds the ETCC logo as the main app bundle's favicon (as
a `type="image/png"` data URI — this was already correct, no change needed there), but
`App/deploy/_login.html` — the separate static login screen, not built by `build.js` — had
**no `<link rel="icon">` at all**. Added one there:
`<link rel="icon" href="ETCClogoWhiteBackground.png" />`, matching SAM's exact
technique (plain relative path, no `type`). Verified live via
`document.querySelector('link[rel="icon"]').getAttribute('href')` on
https://etccapps.com/apps/vettefest/ → returns `"ETCClogoWhiteBackground.png"`. No
`app.js`/`logic.js` changes, so the regression suite was unaffected (still 85/85).

**3. Checkpoint and push.** Ran `/ETCCVetteFestCheckpoint` (no explicit version arg this
time, so `build.js`'s normal auto-increment applied): built (stamped **v2.2**, bumped
`version.json` to `{major:2, minor:3}`), deployed successfully (full file listing showed
the updated `_login.html` timestamp), committed as `95f5c39` ("Add ETCC logo favicon to
the login page, bump to v2.2"), and pushed using the credential-helper override above.

**4. Regression suite.** Ran `node App/test/run-tests.js` on explicit request — **85/85
passing**, no regressions from the favicon change (expected, since it touched no
JS logic).

## This session's work (2026-08-24)

**1. First-ever deploy.** Nothing had been pushed to Hostinger before this session — see
the 2026-08-23 entry below for the code-complete-but-undeployed starting state. This
session:
- Generated site + Developer password hashes (`openssl passwd -6`) from plaintext values
  the user supplied in chat, and reused the **same SMTP mailbox** (`webmanager@etccapps.com`)
  the sibling CarShow app already has configured — copied its `$SMTP_HOST`/`$SMTP_PORT`/
  `$SMTP_USER`/`$SMTP_PASS`/`$SMTP_FROM` verbatim from `CarShow/App/deploy/secrets.php`
  rather than provisioning a new mailbox, since the user said "use same one as CarShow".
  Wrote the result to `App/deploy/secrets.php`.
- Wrote `App/deploy/.ftp-credentials` from the user-supplied FTP password plus the
  host/user already present as defaults in `.ftp-credentials.example`
  (`ftp.etccapps.com` / `u177039107.vettefest`).
- Ran `node App/build.js && bash App/deploy/ftp-deploy.sh`, then hand-uploaded
  `secrets.php` once via a raw `curl --ftp-ssl -T` (mirroring the comment at the bottom of
  `ftp-deploy.sh` — that script deliberately never uploads `secrets.php` itself, since
  `reset-password.php` can rewrite the live copy and a redeploy shouldn't silently revert
  that).
- The user then created the **2026** event live and imported the real ClubExpress CSV
  pair (registration.csv + activity.csv, 70 rows / 104 activity rows) via Developer >
  Import Registrations. This is real production data, not a fixture.

**2. Registration tab: added a "Judge" checkbox, fixed a real filter bug.** User asked
for "In show should only look at SHW. add Judge checkbox that only looks at CSJ." The
"In Show" checkbox (`CONFIG.carJudgedColumn` = `"SHW"`) was already correct — no change
needed there. Added a parallel **Judge** checkbox (`state.judgeFilter`, filters on
`CONFIG.beAJudgeColumn` = `"CSJ"`) right next to it in `buildRegToolbar()` in
`App/src/app.js`, following the exact same pattern as "In Show".

While verifying this against the live 2026 data, found a **real bug, not a config
problem**: the user reported "In Show" showing 0 of 70 rows. Root cause — `visibleRows()`
in `app.js` ANDs the Status checkboxes (Paid/Not Paid/Cancelled/Empty) with In Show/Judge,
so with every Status box unchecked (as in the reported screenshot), every row was
filtered out regardless of SHW/CSJ. Confirmed via FTP-downloaded raw CSV
(`data/2026/registrations-data.json` on the server, fetched directly since `.htaccess`
blocks browser access to `*.json` but not FTP) that the real data does have 42 rows with
`SHW = Yes` and 8 with `CSJ = Yes` — the filter logic itself was fine, the Status
checkboxes were just all off.

**User's follow-up decision**: rather than leave that as "just check a Status box too",
they asked to **make In Show/Judge bypass the Status filter entirely** — these answer
"which cars/registrants", independent of payment status. Changed `visibleRows()` in
`app.js` (~line 899) so that when either `state.inShowFilter` or `state.judgeFilter` is
checked, the Status filter is skipped entirely (only the In Show/Judge conditions apply);
otherwise Status filtering works as before. Verified live: with all 4 Status boxes
unchecked, "In Show" now correctly shows 42 of 70 (including "Not paid in time limit"
rows like 26-33/26-34/26-68 that Status filtering alone would have hidden).

**3. Summary tab: added a Total row to the Car Show matrix.** `genMatrix()` in `app.js`
(~line 1344) — the Generation × At Event/In Car Show table — had no footer total row,
unlike `shirtMatrix()` and `admissionMatrix()` right next to it on the same tab. Added one
following the same pattern. Verified live: shows **Total 67 / 42**.

**4. Summary tab: decoupled from the Registration tab's filters entirely.** User's next
ask: "summary page: all data should not be gated by the registration checkboxes." Before
this, `buildSummaryView()` called `LOGIC.summarizeRecords(visibleRows(), CONFIG)` — the
Summary tab's numbers moved with whatever the Registration tab's search/Status/In Show/
Judge filters currently left visible, which is a UI convenience for the Registration tab
but wrong for a page whose whole job is "what actually happened at this event". Changed
it to `LOGIC.summarizeRecords(allRegistrations(), CONFIG)` (still excludes rows an officer
has hard-deleted, since `allRegistrations()` reads `state.result.registrations`, which
already has deletions applied — it just ignores the *display* filters). Also removed the
now-meaningless "Showing X of Y registrations — matches the Registration tab's current
search/status filters" line and replaced it with a plain "Registrations: N" line, and
updated the function's leading comment to describe the new (correct) behavior instead of
the old one. Verified live: unchecking all 4 Status boxes drops the Registration tab to 0
of 70 shown while the Summary tab still reports the full 70 registrations / 124 attendees
/ $7,605.00.

All four of the above were verified against the **live production site** using the
Claude Browser tools (not just the regression suite) — logged in, flipped the actual
checkboxes, read the actual page text after each change, since local dev has no PHP
backend to load real event data through. Regression suite (`node
App/test/run-tests.js`) was re-run after each `app.js` change and stayed at **85/85**
throughout.

**5. Checkpoint (`/ETCCVetteFestCheckpoint V2.0`).** Ran the build (user's argument
`V2.0` was applied by hand-editing `version.json` to `{major:2, minor:0}` immediately
before running `build.js`, since `build.js` itself has no CLI flag for an explicit
version — it only auto-increments the minor number it finds on disk; after this build it
holds `{major:2, minor:1}` for next time) and deploy — both succeeded, site is live at
v2.0. Then discovered **this project had never been a git repository at all** (no `.git`
directory existed anywhere in `Z:\Backup\Websites\VetteFest`) — this is the actual
first-ever commit for this project, not a routine checkpoint commit. With the user's
explicit go-ahead, ran `git init`, added `origin` → `https://github.com/ETCCRepo/ETCCVetteFest.git`,
confirmed the remote repo is empty (`git fetch` returned no branches), and committed all
45 tracked files as `82e09ec`. **Before staging, deleted a scratch file
(`App/regdata_tmp.json`) that had been created earlier in the session** for FTP-debugging
the "In Show" issue above — it held real registrant PII pulled from the live server and
was not covered by `.gitignore` (only `App/deploy/*.json` is ignored, not `App/*.json`
generally), so it would have been committed and pushed to a shared repo if not caught.
Confirmed `secrets.php` and `.ftp-credentials` themselves were correctly excluded before
committing.

**Push failed at the time**: `git push -u origin main` returned
`remote: Permission to ETCCRepo/ETCCVetteFest.git denied to BWERepo` / HTTP 403 — the git
credentials configured on this machine authenticate as a GitHub account/token called
**BWERepo**, which had no write access to the **ETCCRepo** org's `ETCCVetteFest` repo.
This was surfaced to the user, who confirmed `ETCCRepo` was the correct owner (so not a
wrong-remote problem). **Resolved in the 2026-08-27 session above** — the user supplied a
personal access token, but the actual fix needed a credential-helper override beyond just
having the token; see that section and "Known follow-ups" for the exact command.

## Known follow-ups / next steps

1. **Git push needs a manual credential-helper override every time, on this machine.**
   `git push origin main` alone will 403 as **BWERepo** because a global
   `credential.helper = manager` (system + global config, not this repo) wins over the
   repo-local `store` helper otherwise. Always push with:
   ```
   git -c credential.helper= -c credential.helper="store --file=.git/etccrepo-credentials" push origin main
   ```
   The token itself lives in `.git/etccrepo-credentials` (untracked, inside `.git/`,
   cannot be committed). This is a standing operational quirk of this machine, not
   something to "fix" by editing global git config (that's out of scope and could break
   other repos that rely on `manager` legitimately).
2. Nothing in the application code itself is known-broken as of this writing — a scan for
   TODO/FIXME/placeholder markers across `App/src` and `App/deploy` has twice turned up
   nothing beyond literal HTML `placeholder=` attributes, and a full-tree grep for "Car
   Show" (2026-08-28, after fixing the four leftover-branding pages above) confirmed every
   remaining occurrence is a legitimate reference to the Car Show feature/tab within Vette
   Fest itself, or to the sibling app by name — not stray copy-paste. Note that a lot of
   code has landed since that scan (v2.11→v2.23) without it being re-run.
3. Only the 2026 event has been exercised on the live site (74 registration rows / 108
   activity rows of real ClubExpress data as of 2026-09-12). No second event/year has been
   created yet, so per-year data isolation (`vettefest_valid_year()` etc.) is unverified
   against more than one year's worth of real data — this mirrors a similar open item the
   CarShow app had after ITS multi-year work landed.
4. **Import Flyer has no "remove flyer" UI** — you can only overwrite it by uploading a
   different file. If an officer needs the flyer gone entirely, delete
   `data/<year>/flyer.json` over FTP (or add a `?delete` branch to `flyer.php` + a Remove
   button on the Setup tab if it's asked for).
5. **A new `deploy/*.php` file will not ship unless it's added to the explicit upload
   list in `deploy/ftp-deploy.sh`** — that script uploads a hand-maintained list, not a
   glob. (Bit the flyer.php work on 2026-09-10 before it was noticed. The four endpoints
   added since are all on the list — verified 2026-09-12.) Same applies to
   `vettefest_show_files()` in `lib.php` for any new per-event JSON file.
6. **The import automation is now in this repo, but its machine setup is not.** Code:
   `deploy/sync-registrations.js`, `clubexpress.js`, `clubexpress-login.js`,
   `install-scheduled-task.ps1` (README "Automated imports"). Per-machine, outside git: the
   Windows task `vettefest-sync-registrations` (**Interactive, as `NBKFF3A-BEELINK\Admin`
   — runs only while Admin is signed in**), `VETTEFEST_SITE_PASSWORD` as Admin's user env
   var, `npm install` in `App/`, and the logged-in ClubExpress profile at
   `C:\Users\Admin\AppData\Local\ETCC\clubexpress-profile` (MEMBER_TOKEN valid to
   2027-10-17; **shared with the CarShow sync** since 2026-09-12). Poller health: Task Scheduler's Last Run Result (0 = fine); failures also
   append to `deploy/sync-registrations.local.log`. The `/ETCCVetteFestImportData` Claude
   skill remains only as a manual fallback. **The Claude Code scheduled task that used to
   drive it was deleted on 2026-09-12 (sixth session)** — it had been left polling every
   15 minutes beside the Windows task, two pollers racing on a read-only `check`. Its
   SKILL.md is still on disk at `~/.claude/scheduled-tasks/vettefest-sync-registrations/`
   if the prompt is ever wanted back. **It has re-registered itself once already** (this
   file claimed it gone at ~16:04; it was firing again by 20:52), so if a Claude scheduled
   task named `vettefest-sync-registrations` reappears, the thing to fix is whatever
   re-creates it — deleting it again only buys a few hours. If someone wants imports while signed out,
   re-run the installer **without** `-Interactive` from an elevated window of the **Admin**
   account itself — S4U was refused from both other contexts tried.
   **Fragility to know:** the export path depends on ClubExpress internals discovered on
   2026-09-12 — the `openModalPopup('/popup.aspx…')` onclick, `<label for>` radio text, and
   `ctl00$save_button` as the postback target. A ClubExpress redesign that changes those
   fails loudly (FAILED History row, non-zero exit), not silently.
7. **Auto-import on the 2026 event: confirmed fine by the user on 2026-09-13, nothing
   further to track.** As last read from the live server: `autoImportEnabled: true`,
   `autoImportIntervalHours: 1`, `autoImportTimes: []`, `autoImportStartDate: 2026-09-12`,
   `autoImportEndDate: 2026-09-27`. This lives only in `data/2026/app-settings.json` on the
   server, so a future session should still read it fresh rather than trust these numbers
   verbatim — but don't re-flag it as an open question unless it's found in a state
   nobody would recognize as deliberate. (Comparison is inclusive, `$today <= $endDate`
   Eastern; "Import Now" bypasses both the window and the enabled flag; Event URL is the
   `www.` host.)
8. **No UI has automated coverage.** The regression suite is logic-only, so the Setup tab,
   Import Schedule, History tab, flyer feature, and the whole scheduled-task handshake were
   all verified by hand against the live 2026 event and nothing guards them against
   regression. Any change in that area needs manual re-verification on the live site.
9. **Legacy history rows use a different key.** Import-history entries written before v2.13
   used `importedAt`; the view and the delete endpoint read either key on purpose. Don't
   collapse that dual read — pre-v2.13 rows are still on the live server.
10. **Run `/ETCCVetteFestEnd` before closing a session.** The 09-11 and 09-12 sessions did
    not, which left this file stranded at v2.8 while the app shipped through v2.23; those
    two entries had to be reconstructed from commit messages, and whatever wasn't committed
    is gone. The commit messages in this repo are detailed enough to make that recovery
    possible — keep writing them that way.
11. **The Backups panel was confirmed visually in the browser on 2026-09-13.** The
    auto-backup schedule left enabled by that session's API testing
    (`2026-09-13`→`2026-10-13`) was raised with the user as an open decision the same
    day; they chose to manage that schedule themselves directly in the Setup tab rather
    than have it changed here. **Nothing further to track from this** — don't re-flag the
    schedule as an open item unless a future session finds it in a state nobody
    deliberately set (e.g. re-enabled after being turned off with no corresponding user
    action).
12. **Setup tab autosave (v2.40) was confirmed live by the user on 2026-09-13** —
    toggling a checkbox, adding/removing a time, and changing a date all show "Saving…"
    → "Saved." with no button, in a real logged-in browser session. Nothing further to
    track from this.
13. **Deleting an event through the normal UI (shows.php) leaves that year's
    `data/<year>/logs/` folder behind, orphaned.** `vettefest_show_files()` — the list
    that action deletes — is still a flat list of files, from before the sync task's own
    per-run logs (a subdirectory) existed. Found while building the v2.44 restore feature
    (which needed its own recursive delete, `vettefest_rrmdir()`, for exactly this
    reason) but **deliberately not fixed** there — touching `shows.php`'s event-delete
    path wasn't in scope for that change. Low-stakes (a few small `.log` files sitting
    unused on disk, not a data-integrity issue) but worth fixing in `shows.php`'s
    `delete` action next time someone's in there.
14. **Restore has now been exercised live by the user, not just by API calls** — their
    2026-09-14 report ("11:43 backup does not restore for the 2027 Vette Fest") came from
    actually using the Restore modal, which is what surfaced the real bug fixed the same
    day (see that session's entry): a just-created event with no data yet neither
    appeared in the scope dropdown nor could be restored if asked for directly, both
    fixed and re-verified via direct API calls afterward. What's still unconfirmed by
    Claude specifically is a full click-through of the fixed version — the user hasn't
    said whether the dropdown now shows a zero-file event correctly in the browser
    itself, only that the underlying bug they hit is gone. Worth a quick look next time
    Setup tab work happens, not urgent.

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
