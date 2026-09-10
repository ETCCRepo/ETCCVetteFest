# ETCC Vette Fest App — Project Status

Last updated: 2026-09-10 (end of session). **Added a "Setup" tab** (after Reports) that
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

**Regression suite: 85/85 passing**, re-run explicitly on 2026-09-10 after the Setup-tab
work (covering fixture-based generation — registrations, attendees, funds, judges, shirt
buckets, generation tally, Reg #, event-title fallback chain, show-year validation — and
an Excel export round-trip). The suite is logic-only (`test/run-tests.js` +
`src/regression-tests.js`) and does not exercise any UI/tab code, so the Setup tab / flyer
feature was instead verified by hand against the live 2026 event (see the session entry
below).

**Version:** `App/version.json` — stamped **2.8** in the currently-live
`App/ETCCVetteFest.html` / `app-bundle.html` on the server (deployed 2026-09-10). The file
itself now reads `{major:2, minor:9}`, since `build.js` bumps-and-stores the *next*
version on every run — the next build will stamp "2.9".

**Live URL:** https://etccapps.com/apps/vettefest/ — as of 2026-09-09, **the Developer
password is the same as the site password** (`$DEV_PASSWORD_HASH` in `secrets.php` was set
to the same hash as `$PASSWORD_HASH`, at the user's request). Neither password is recorded
in this file; check with the user or `App/deploy/secrets.php` on a machine that has it.

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
`upload-registrations.js`. Plus, added 2026-09-10: **`flyer.php`** — per-event event-flyer
store (`POST` uploads an image/PDF, `GET` serves it, `GET ?meta=1` returns metadata),
backing the Setup tab's Import Flyer and the Reports tab's Print Flyer.

`ftp-deploy.sh` uploads an **explicit hand-maintained list** of files (not a `*.php`
glob) — a new deploy/*.php file MUST be added to that list or it silently never ships
(this bit the flyer.php work mid-session: the first deploy ran clean but flyer.php wasn't
on the server until it was added to the script).

Data model: one JSON dataset per event year under `data/<year>/` on the server
(registrations, deleted-registrations, overrides, settings, **and as of 2026-09-10 the
flyer** — `flyer.json`, the flyer bytes stored base64 inside it so it sits under the same
`*.json` deny rule), plus a global `data/shows.json` registry — never a flat single-event
layout, so there's no migration step needed for a fresh install. The per-event file list
lives in `vettefest_show_files()` in `lib.php`.

**Deployed** — `App/deploy/secrets.php` and `App/deploy/.ftp-credentials` both exist on
disk (gitignored, never committed), the `vettefest` FTP account exists, and
`App/deploy/ftp-deploy.sh` has successfully uploaded code multiple times. The first live
event (2026) already has 70 real registrations imported and has been used to verify the
filter fixes below against real data.

**Git: pushed and working**, as of 2026-08-27 — see that session's entry below for the
one gotcha (a global credential helper that must be worked around on every push from this
machine).

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
   Fest itself, or to the sibling app by name — not stray copy-paste.
3. Only the 2026 event has been exercised on the live site (70 real registrations
   imported and used to verify the filter fixes in the 2026-08-24 entry below). No second
   event/year has been created yet, so per-year data isolation (`vettefest_valid_year()`
   etc.) is unverified against more than one year's worth of real data — this mirrors a
   similar open item the CarShow app had after ITS multi-year work landed.
4. **Import Flyer has no "remove flyer" UI** — you can only overwrite it by uploading a
   different file. If an officer needs the flyer gone entirely, delete
   `data/<year>/flyer.json` over FTP (or add a `?delete` branch to `flyer.php` + a Remove
   button on the Setup tab if it's asked for). Also: the flyer/Setup-tab code has **no
   regression-suite coverage** (the suite is logic-only and doesn't touch tab/UI code) —
   it was verified by hand against the live site.
5. **A new `deploy/*.php` file will not ship unless it's added to the explicit upload
   list in `deploy/ftp-deploy.sh`** — that script uploads a hand-maintained list, not a
   glob. (Bit the flyer.php work this session before it was noticed.)

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
