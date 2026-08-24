# ETCC Vette Fest App — Project Status

Last updated: 2026-08-24 (end of session). **The app is now live** — first deploy
completed, two Registration-tab filter bugs fixed, the Summary tab now always shows the
full dataset, and a Total row was added to the Car Show matrix. A first git commit was
also made (repo had never been initialized before this session) but **is not yet pushed**
— see "Known follow-ups" below, this needs the user to resolve a permissions problem.

Previous update: 2026-08-23 (end of session). No prior PROJECT_STATUS.md existed for this
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

**Regression suite: 85/85 passing** as of the last time it was run this session (`node
App/test/run-tests.js`), covering fixture-based generation (registrations, attendees,
funds, judges, shirt buckets, generation tally, Reg #, event-title fallback chain,
show-year validation) and an Excel export round-trip. It was run mid-session, right after
the filter/Summary changes below — this session's later checkpoint step did not re-run it
per its own documented scope.

**Version:** `App/version.json` — stamped **2.0** in the currently-live
`App/ETCCVetteFest.html` / `app-bundle.html` on the server (deployed 2026-08-24). The file
itself now reads `{major:2, minor:1}`, since `build.js` bumps-and-stores the *next*
version on every run — the next build will stamp "2.1".

**Live URL:** https://etccapps.com/apps/vettefest/ — site password and Developer password
were both set this session (the user supplied plaintext values in chat, which were hashed
and written to `App/deploy/secrets.php` — gitignored, never committed). Neither password
is recorded in this file; check with the user or `secrets.php` on a machine that has it.

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

**Deployed** as of this session — `App/deploy/secrets.php` and `App/deploy/.ftp-credentials`
both exist on disk (gitignored, never committed), the `vettefest` FTP account exists, and
`App/deploy/ftp-deploy.sh` has successfully uploaded code multiple times this session. The
first live event (2026) already has 70 real registrations imported and has been used to
verify the filter fixes below against real data.

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

**Push failed and is still failing**: `git push -u origin main` returns
`remote: Permission to ETCCRepo/ETCCVetteFest.git denied to BWERepo` / HTTP 403. The
git credentials configured on this machine authenticate as a GitHub account/token called
**BWERepo**, which has no write access to the **ETCCRepo** org's `ETCCVetteFest` repo.
This was surfaced to the user, who replied "push to https://github.com/ETCCRepo/ETCCVetteFest"
confirming the URL is correct — but the retry failed with the identical 403, meaning the
problem is account permissions, not a wrong remote. **This is unresolved** — see "Known
follow-ups".

## Known follow-ups / next steps

1. **Git push is blocked on a permissions problem, not a code problem.** Commit `82e09ec`
   (and this session's PROJECT_STATUS.md update, once committed) exist only in the local
   repo at `Z:\Backup\Websites\VetteFest`. To unblock: either add the **BWERepo** GitHub
   account/token as a collaborator with write access on `ETCCRepo/ETCCVetteFest`, or
   provide different credentials (e.g. a PAT for an account that already has access), or
   confirm `ETCCRepo` is actually the intended owner at all. A future session should try
   `git push -u origin main` again after the user says this is fixed — if it still 403s,
   don't just retry silently, surface it the same way this session did.
2. Nothing in the application code itself is known-broken as of this writing — a scan for
   TODO/FIXME/placeholder markers across `App/src` and `App/deploy` earlier this session
   turned up nothing beyond literal HTML `placeholder=` attributes.
3. The regression suite was last confirmed 85/85 mid-session, right after the `app.js`
   filter/Summary changes above — it was **not** re-run as part of the checkpoint or this
   end-of-session step (both explicitly out of scope for those skills). A session that
   wants a fresh confirmation should just run `node App/test/run-tests.js`.
4. Only the 2026 event has been exercised on the live site (70 real registrations
   imported and used to verify the filter fixes above). No second event/year has been
   created yet, so per-year data isolation (`vettefest_valid_year()` etc.) is unverified
   against more than one year's worth of real data — this mirrors a similar open item the
   CarShow app had after ITS multi-year work landed.

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
