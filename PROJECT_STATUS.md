# ETCC Vette Fest App — Project Status

Last updated: 2026-08-27 (end of session). **The git push problem from 2026-08-24 is
resolved** — the user supplied a personal access token and pushes now work (with a
one-time-per-session credential-helper override, see below). Added a favicon to the
login page (the main app bundle already had one), shipped as v2.2, and confirmed the
regression suite is still 85/85.

Previous update: 2026-08-24 (end of session). **The app went live for the first time** —
first deploy completed, two Registration-tab filter bugs fixed, the Summary tab was made
to always show the full dataset, and a Total row was added to the Car Show matrix.

Earlier update: 2026-08-23 (end of session). No prior PROJECT_STATUS.md existed for this
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

**Regression suite: 85/85 passing**, confirmed freshly on 2026-08-27 with an explicit
`node App/test/run-tests.js` run (covering fixture-based generation — registrations,
attendees, funds, judges, shirt buckets, generation tally, Reg #, event-title fallback
chain, show-year validation — and an Excel export round-trip).

**Version:** `App/version.json` — stamped **2.2** in the currently-live
`App/ETCCVetteFest.html` / `app-bundle.html` on the server (deployed 2026-08-27). The file
itself now reads `{major:2, minor:3}`, since `build.js` bumps-and-stores the *next*
version on every run — the next build will stamp "2.3".

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

**Deployed** — `App/deploy/secrets.php` and `App/deploy/.ftp-credentials` both exist on
disk (gitignored, never committed), the `vettefest` FTP account exists, and
`App/deploy/ftp-deploy.sh` has successfully uploaded code multiple times. The first live
event (2026) already has 70 real registrations imported and has been used to verify the
filter fixes below against real data.

**Git: pushed and working**, as of 2026-08-27 — see that session's entry below for the
one gotcha (a global credential helper that must be worked around on every push from this
machine).

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
   nothing beyond literal HTML `placeholder=` attributes.
3. Only the 2026 event has been exercised on the live site (70 real registrations
   imported and used to verify the filter fixes in the 2026-08-24 entry below). No second
   event/year has been created yet, so per-year data isolation (`vettefest_valid_year()`
   etc.) is unverified against more than one year's worth of real data — this mirrors a
   similar open item the CarShow app had after ITS multi-year work landed.

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
