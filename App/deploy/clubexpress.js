// Drives ClubExpress's event Admin Panel -> Exports dialog with Playwright and
// saves the two CSVs this app imports (Registration Data, Activity Registrant
// Data). This is the deterministic replacement for the browser-automation half
// of the /ETCCVetteFestImportData Claude skill -- everything else that skill
// did (the check/mark_start/mark_run bridge, the upload, the log archive) was
// already plain HTTP and now lives in sync-registrations.js.
//
// The CarShow app (Z:\Backup\Websites\CarShow\App\deploy\clubexpress.js) runs
// a port of this file. Two fixes found while porting were ported back here on
// 2026-09-12 -- the page_id=4091 repair in normalizeClubExpressUrl() and the
// busy-profile retry in openContext() -- so keep the two copies in sync.
//
// Auth model, deliberately identical to the skill's: this NEVER logs in. It
// drives a dedicated, persistent Chrome profile that an officer logged into
// ClubExpress once by hand (see clubexpress-login.js). If that session has
// lapsed the run fails with a clear message rather than touching a login form.
// That keeps ClubExpress admin credentials off this machine entirely and out
// of reach of any automation bug.
//
// THE THING THAT MAKES OR BREAKS THIS: ClubExpress authenticates with an
// ASP.NET session cookie, which is non-persistent -- Chrome drops it the moment
// the browser exits, however correctly you signed in. Only ticking "Remember
// Me" at login issues a cookie with an actual expiry date, and only that
// survives to the next scheduled run. persistentCookies() below is what tells
// an officer whether they got a durable session or a throwaway one -- a login
// that "worked" but left no persistent cookie is the single most likely reason
// for an unattended run to report "session not logged in" the next morning.
//
// Why a DEDICATED profile and not the officer's everyday Chrome: Chrome allows
// only one process per user-data-dir, so reusing the default profile would
// fail whenever they happened to have Chrome open -- which, on a task that
// fires every 15 minutes, is most of the day.
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright-core");

// Lives outside the repo: it is ~50MB of browser state, not source, and it
// must survive the repo being moved or re-cloned.
//
// SHARED with the CarShow app's sync. Both events live on the same ClubExpress
// site under the same officer login, so one signed-in profile serves both --
// but the two scheduled tasks can then collide on it; see openContext().
const PROFILE_DIR = path.join(
  process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || ".", "AppData", "Local"),
  "ETCC", "clubexpress-profile"
);

// The two exports, in the order the skill did them. `label` is the visible
// text of the radio button in the Event Exports dialog; `prefix` is the
// filename convention upload-registrations.js's newestMatching() scans for.
const EXPORTS = [
  { label: "Registration Data", prefix: "registration_data" },
  { label: "Activity Registrant Data", prefix: "activity_registrant_data" },
];

class LoginError extends Error {}

// ClubExpress issues its auth cookie (MEMBER_TOKEN) HOST-ONLY on
// www.etccwebsite.com -- not on the apex domain, and not as a wildcard
// .etccwebsite.com. So a URL missing the "www." is silently unauthenticated:
// the browser withholds the cookie, ClubExpress bounces to action=login, and
// every symptom looks exactly like an expired session. That cost a real
// debugging cycle (2026-09-12) -- the Setup tab's stored Event URL had no
// "www.", so the sync reported "session not logged in" while the session was
// in fact valid for another year.
//
// Normalizing here rather than only fixing the stored setting: an officer
// pasting a URL out of the address bar should not be able to break auth in a
// way that misreports itself as a login problem.
//
// Same reasoning for page_id: 4091 is the PUBLIC "Event View" (no Exports
// button; it even renders "Member Login" to a signed-in admin), and it's what
// you get copying the URL from the public event page. 4055 is "(Admin Panels)"
// for the SAME item_id, which the export needs. The CarShow app's stored URL
// was still 4091 when this sync was ported there, and its first live run only
// succeeded because of this repair. Only 4091 is rewritten -- any other
// page_id is left alone so a genuinely different page still fails loudly.
function normalizeClubExpressUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (/^etccwebsite\.com$/i.test(u.hostname)) u.hostname = "www." + u.hostname;
    if (/etccwebsite\.com$/i.test(u.hostname) && u.searchParams.get("page_id") === "4091") {
      u.searchParams.set("page_id", "4055");
    }
    return u.toString();
  } catch (_) {
    return rawUrl; // not parseable -- let the caller's navigation report it
  }
}

// Opens the persistent profile using the system's real Google Chrome
// (channel: "chrome") rather than a Playwright-downloaded Chromium -- same
// browser the officer logged in with, so the stored session is valid and
// ClubExpress sees a browser it has already seen.
//
// Retries because PROFILE_DIR is shared with the CarShow sync (see above) and
// Chrome allows one process per profile folder. The two tasks poll on
// independent 15-minute clocks (CarShow's installer staggers itself 7.5 min
// away from this task) and a full run takes a few seconds, so a genuine
// collision is rare -- but an unattended job shouldn't fail on it. Chrome's
// error for a locked profile isn't a stable string across versions, so any
// launch failure is retried; a real launch problem just costs ~45s.
async function openContext({ headless = true, attempts = 4, waitMs = 15000 } = {}) {
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  let lastErr = null;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await chromium.launchPersistentContext(PROFILE_DIR, {
        channel: "chrome",
        headless,
        acceptDownloads: true,
        viewport: { width: 1440, height: 900 },
      });
    } catch (err) {
      lastErr = err;
      if (i < attempts) await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw new Error(
    "Could not open the ClubExpress Chrome profile after " + attempts + " tries (it may be in use by the " +
    "CarShow sync or an open clubexpress-login.js window): " + String(lastErr && lastErr.message).split(/\r?\n/)[0]
  );
}

// Returns the cookies that will actually still exist after Chrome restarts --
// i.e. those with a real expiry. Playwright reports a session cookie's
// `expires` as -1. An empty result after a successful login means the officer
// did not tick "Remember Me", and the next scheduled run will find itself
// logged out.
async function persistentCookies(context, domainPattern = /etccwebsite\.com$/i) {
  const cookies = await context.cookies();
  return cookies.filter(
    (c) => c.expires && c.expires > 0 && domainPattern.test((c.domain || "").replace(/^\./, ""))
  );
}

// ---------------------------------------------------------------- locators
// ClubExpress is ASP.NET WebForms with generated ids, so everything anchors on
// visible text and role rather than on any id. Every lookup sweeps ALL frames:
// admin panels are routinely rendered inside an iframe, and a main-frame-only
// locator would silently never find them.
async function firstVisibleInAnyFrame(page, buildCandidates, timeout = 8000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      let candidates;
      try {
        candidates = buildCandidates(frame);
      } catch (_) {
        continue; // frame detached mid-sweep
      }
      for (const locator of candidates) {
        const el = locator.first();
        if (await el.isVisible().catch(() => false)) return el;
      }
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

// The event toolbar's buttons are <a class="manager-button"> wrappers holding a
// Material-Icons ligature span AND a label span, so the anchor's own textContent
// is the icon's ligature name glued to the label ("outputExports" on both the
// Vette Fest and CarShow event pages, verified live 2026-09-12) -- matching on
// the anchor's text fails, and
// matching the label span alone finds an element whose click does nothing
// (the handler is on the anchor). Anchor on the label span, act on the <a>.
function exportsButtonCandidates(frame) {
  return [
    frame.locator('a.manager-button:has(span.manager-button-text:text-is("Exports"))'),
    frame.locator('span.manager-button-text:text-is("Exports")').locator("xpath=ancestor::a[1]"),
    frame.getByRole("link", { name: /exports/i }),
  ];
}

// True when this page is showing ClubExpress's login screen, in any frame.
async function looksLoggedOut(page) {
  if (/action=login/i.test(page.url())) return true;
  const marker = await firstVisibleInAnyFrame(
    page,
    (frame) => [
      frame.locator('input[type="password"]'),
      frame.getByRole("link", { name: /member login/i }),
    ],
    1500
  );
  return !!marker;
}

// Distinguishes the two ways this page can be "wrong", because the fixes are
// completely different and the symptom is identical (no Exports button):
//   - session lapsed  -> an officer needs to log back in (clubexpress-login.js)
//   - page_id is 4091 -> the URL points at the PUBLIC event view, which renders
//     logged-out-looking even for an authenticated admin. Must be 4055.
async function assertAdminPanelsPage(page, eventUrl) {
  const exportsBtn = await firstVisibleInAnyFrame(page, exportsButtonCandidates, 12000);
  if (exportsBtn) return exportsBtn;

  if (await looksLoggedOut(page)) {
    // Before blaming the session, rule out the host trap: the auth cookie is
    // host-only on www.etccwebsite.com, so landing anywhere else looks
    // identical to being logged out. exportRegistrationCsvs() normalizes the
    // URL it is given, but a redirect (or a hand-run caller) can still end up
    // on the apex, and "go log in again" would be flatly wrong advice.
    let host = "";
    try { host = new URL(page.url()).hostname; } catch (_) { /* keep "" */ }
    if (host && !/^www\./i.test(host) && /etccwebsite\.com$/i.test(host)) {
      throw new Error(
        `Landed on ${host} instead of www.etccwebsite.com. ClubExpress's auth cookie is ` +
        `host-only on the www host, so this page is unauthenticated even though the stored ` +
        `session is fine -- fix the Event URL in the Setup tab to start with https://www.`
      );
    }
    throw new LoginError(
      "ClubExpress session not logged in -- re-run clubexpress-login.js and sign in WITH \"Remember Me\" ticked."
    );
  }
  if (/page_id=4091/.test(eventUrl)) {
    throw new Error(
      "Event URL points at the public event view (page_id=4091), not the Admin Panels page -- change it to page_id=4055 in the Setup tab."
    );
  }
  throw new Error(
    "No Exports button on the event page -- the ClubExpress layout may have changed, or the event URL is wrong (it must be the Admin Panels page, page_id=4055)."
  );
}

// The Exports toolbar button doesn't render the form inline -- its onclick is
//   openModalPopup('/popup.aspx?page_id=4036&club_id=...&item_id=...', 400, 350, '')
// which loads that URL into a modal iframe. Reading the path out of the onclick
// and navigating to it DIRECTLY is far more robust than driving the modal:
// no iframe hunting, no waiting on a JS dialog, and the form is a plain page.
// The ids are read from the live page rather than hardcoded, so this follows
// the event/club automatically.
async function findExportsPopupUrl(page) {
  const popupPath = await page.evaluate(() => {
    const span = [...document.querySelectorAll("span.manager-button-text")]
      .find((e) => (e.textContent || "").trim() === "Exports");
    const a = span && span.closest("a");
    const m = a && /openModalPopup\(\s*['"]([^'"]+)['"]/.exec(a.getAttribute("onclick") || "");
    return m ? m[1] : null;
  });
  if (!popupPath) {
    throw new Error(
      'Could not read the Exports popup URL from the toolbar button -- the ClubExpress layout may have changed.'
    );
  }
  return new URL(popupPath, page.url()).toString();
}

// One export attempt: load the popup form fresh, pick the report type, click
// Export, catch the download. Any step failing throws, and the caller retries.
async function attemptExport(page, popupUrl, label, destPath, log) {
  // Always reload the form rather than reusing a half-used one: it's an ASP.NET
  // WebForms page whose __VIEWSTATE is consumed by each postback.
  await page.goto(popupUrl, { waitUntil: "domcontentloaded", timeout: 60000 });

  // WHY NOT JUST CLICK EXPORT: the Export control runs doExport() ->
  // __doPostBack(), and under automation that chain is broken two ways
  // (both confirmed 2026-09-12):
  //   - headless Chrome gets 403 on the Telerik/MS-AJAX script bundles
  //     (WebResource.axd), so "Sys"/"$telerik" never exist;
  //   - even headed, MS-AJAX's _doPostBack reads arguments.callee, which throws
  //     when driven by script, so the click silently does nothing.
  // A WebForms postback is only an HTTP form POST, though. So serialize the
  // form exactly as the browser would -- __VIEWSTATE and all, with the chosen
  // radio and __EVENTTARGET set -- and POST it through page.request, which
  // shares the profile's cookies. ClubExpress answers with the CSV as an
  // attachment. No page JavaScript runs at all, and it works headless.
  //
  // Exact label match matters: "Registrant Data" vs "Registrant Data
  // w/Emergency Contact" differ only by a suffix, so a loose match could
  // silently export the wrong report. The Status filter keeps its default
  // (every status), which is what the app's importer expects.
  const form = await page.evaluate((lbl) => {
    const f = document.forms[0];
    if (!f) return { error: "no form on the Event Exports page" };
    const radio = [...f.querySelectorAll('input[type="radio"]')].find((r) => {
      const l = document.querySelector(`label[for="${r.id}"]`);
      return l && l.innerText.trim() === lbl;
    });
    if (!radio) return { error: `Could not find the "${lbl}" option in the Event Exports form.` };
    const fields = {};
    for (const el of f.elements) {
      if (!el.name || el.disabled) continue;
      if ((el.type === "radio" || el.type === "checkbox") && !el.checked) continue;
      if (el.type === "button" || el.type === "submit" || el.type === "file") continue;
      fields[el.name] = el.value;
    }
    fields[radio.name] = radio.value;
    fields.__EVENTTARGET = "ctl00$save_button";
    fields.__EVENTARGUMENT = "";
    return { action: new URL(f.getAttribute("action") || location.href, location.href).toString(), fields };
  }, label);
  if (form.error) throw new Error(form.error);

  // ClubExpress generates the file server-side, which can take a few seconds.
  const res = await page.request.post(form.action, { form: form.fields, timeout: 90000 });
  const ctype = res.headers()["content-type"] || "";
  const body = await res.body();
  // Anything but a CSV attachment is an HTML page -- a login redirect, an
  // error page, or a layout change. Refuse it rather than save HTML as .csv
  // and let the importer choke on it downstream.
  if (res.status() !== 200 || !/text\/csv|application\/(vnd\.ms-excel|octet-stream)/i.test(ctype)) {
    const snippet = body.toString("utf8").replace(/\s+/g, " ").slice(0, 120);
    throw new Error(`Export returned ${res.status()} ${ctype || "(no content-type)"} instead of a CSV: ${snippet}`);
  }
  fs.writeFileSync(destPath, body);
  const rows = countDataRows(destPath);
  log(`Exported "${label}" -> ${path.basename(destPath)} (${rows} data rows)`);
  return rows;
}

function countDataRows(file) {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  return Math.max(0, lines.length - 1); // minus the header row
}

// Runs both exports into destDir using the dated filenames
// upload-registrations.js expects. Hard cap of 3 attempts per file, carried
// over from the skill: an unattended run with no upper bound can loop for many
// minutes on a problem a person would have spotted instantly.
async function exportRegistrationCsvs({ eventUrl, destDir, log, headless = true }) {
  if (!fs.existsSync(destDir)) {
    throw new Error(`Exports folder does not exist: ${destDir}`);
  }
  const stamp = dateStamp();
  const originalUrl = eventUrl;
  eventUrl = normalizeClubExpressUrl(eventUrl);
  const context = await openContext({ headless });
  try {
    const page = await context.newPage();
    if (eventUrl !== originalUrl) {
      log(`Event URL normalized (www host / Admin Panels page_id=4055): ${eventUrl}`);
    }
    log(`Opening ${eventUrl}`);
    await page.goto(eventUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await assertAdminPanelsPage(page, eventUrl);
    log("Event Admin Panels page confirmed (Exports button present).");

    const popupUrl = await findExportsPopupUrl(page);
    log(`Exports form: ${popupUrl}`);

    const results = {};
    for (const { label, prefix } of EXPORTS) {
      const destPath = path.join(destDir, `${prefix}${stamp}.csv`);
      let lastErr = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const rows = await attemptExport(page, popupUrl, label, destPath, log);
          results[prefix] = { path: destPath, rows };
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          log(`Attempt ${attempt}/3 for "${label}" failed: ${err.message}`);
          // attemptExport() reloads the form itself, so there's nothing to
          // clear between tries; just don't hammer it instantly.
          if (attempt < 3) await page.waitForTimeout(2000);
        }
      }
      if (lastErr) throw new Error(`Export of "${label}" failed after 3 attempts: ${lastErr.message}`);
    }
    return results;
  } finally {
    await context.close().catch(() => {});
  }
}

function dateStamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

module.exports = {
  PROFILE_DIR,
  LoginError,
  openContext,
  exportRegistrationCsvs,
  dateStamp,
  normalizeClubExpressUrl,
  findExportsPopupUrl,
  persistentCookies,
  looksLoggedOut,
  firstVisibleInAnyFrame,
  exportsButtonCandidates,
};
