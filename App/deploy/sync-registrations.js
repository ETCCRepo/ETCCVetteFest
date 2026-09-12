// The unattended import loop for the Vette Fest app -- a drop-in replacement
// for the `vettefest-sync-registrations` Claude Code scheduled task, driven by
// Windows Task Scheduler instead. Requires no Claude subscription.
//
//   node deploy/sync-registrations.js [--force] [--headed]
//
// The server side is UNCHANGED: this speaks exactly the same
// check/mark_start/mark_run contract to import-schedule.php that the Claude
// task did, uploads through the same registrations-upload.php (by reusing
// upload-registrations.js verbatim), and archives its log through the same
// logs.php. The Setup tab's Import Schedule panel and the History tab keep
// working with no modification at all.
//
// This POLLS. Fired every 15 minutes, it does a cheap `check` first and exits
// silently -- no log, no browser, no files -- unless something is actually due.
// That is the common case and it costs a fraction of a second.
//
// Flags:
//   --force   run the import regardless of what `check` says (manual testing).
//             Reports itself to the server as reason "manual".
//   --headed  show the Chrome window instead of running it hidden.
//
// Environment:
//   VETTEFEST_SITE_PASSWORD  (required) the live site's login password, set as
//                            a persistent Windows *user* environment variable.
//   VETTEFEST_YEAR           (optional) defaults to the current calendar year.
const fs = require("fs");
const path = require("path");
const https = require("https");
const { spawn } = require("child_process");
const { exportRegistrationCsvs, LoginError } = require("./clubexpress");

const BASE_URL = "https://etccapps.com/apps/vettefest";
const EXPORTS_DIR = "Z:/Backup/ETCC/Document Library/Restricted/Events/Vette Fest/Exports";
// Kept on disk purely so Task Scheduler runs can be debugged after the fact;
// the authoritative per-run log still goes to the server via logs.php.
const LOCAL_LOG = path.join(__dirname, "sync-registrations.local.log");

const FORCE = process.argv.includes("--force");
const HEADED = process.argv.includes("--headed");

const password = process.env.VETTEFEST_SITE_PASSWORD;
const year = process.env.VETTEFEST_YEAR || String(new Date().getFullYear());

// ---------------------------------------------------------------- log buffer
// Built up in memory and shipped to logs.php at the end of the run, under the
// filename decided up front (step 1 of the old skill) so the name the History
// tab's log icon links to always matches the name the log is stored under.
const logLines = [];
function log(msg) {
  const line = new Date().toISOString() + "  " + msg;
  logLines.push(line);
  console.log(line);
}
function logText(result) {
  return [new Date().toISOString() + "  START", ...logLines, result].join("\n") + "\n";
}
function logFileName(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return (
    "sync-" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
    "-" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + ".log"
  );
}

// ------------------------------------------------------------------ HTTP glue
function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
        timeout: 30000,
      },
      (res) => {
        let text = "";
        res.on("data", (c) => (text += c));
        res.on("end", () => {
          let json = null;
          try { json = JSON.parse(text); } catch (_) { /* non-JSON body */ }
          resolve({ status: res.statusCode, json, text });
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("request timed out")));
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

const scheduleUrl = BASE_URL + "/import-schedule.php?year=" + year;

function markStart(reason) {
  return postJson(scheduleUrl, { action: "mark_start", password, reason });
}
function markRun(reason, status, error, file) {
  return postJson(scheduleUrl, {
    action: "mark_run", password, reason, status, error: error || "", logFile: file || "",
  });
}
async function storeLog(name, text) {
  const res = await postJson(BASE_URL + "/logs.php?year=" + year, {
    action: "store", password, name, text,
  });
  // A failed archive is NOT a failed run -- note it and carry on, exactly as
  // the skill's step 8 specified.
  if (res.status !== 200) console.error("Log archive failed (" + res.status + "): " + res.text);
  return res.status === 200;
}

// --------------------------------------------------------------- upload step
// Shells out to upload-registrations.js rather than duplicating its logic, so
// the manual path and the automated path can never drift apart.
function runUpload(eventUrl, file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, "upload-registrations.js")], {
      cwd: path.dirname(__dirname),
      env: {
        ...process.env,
        VETTEFEST_SITE_PASSWORD: password,
        VETTEFEST_YEAR: year,
        VETTEFEST_EVENT_URL: eventUrl || "",
        VETTEFEST_LOG_FILE: file,
      },
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ code, out: out.trim() }));
  });
}

// ------------------------------------------------------------------- failures
// Replaces the Claude task's PushNotification. Task Scheduler surfaces the
// non-zero exit code as the task's "Last Run Result", and the Setup tab's
// "Last run" line plus the History tab already carry the human-readable story.
function recordFailure(reason) {
  const line = new Date().toISOString() + "  FAILED: " + reason + "\n";
  try { fs.appendFileSync(LOCAL_LOG, line); } catch (_) { /* best effort */ }
  console.error("Vette Fest import FAILED -- " + reason);
}

// ----------------------------------------------------------------------- main
(async () => {
  if (!password) {
    recordFailure("VETTEFEST_SITE_PASSWORD is not set on this machine.");
    process.exit(1);
  }
  if (!/^[0-9]{4}$/.test(year)) {
    recordFailure("VETTEFEST_YEAR must be a four-digit year (got: " + year + ").");
    process.exit(1);
  }

  // --- Step 1: decide the log filename before anything else.
  const file = logFileName();

  // --- Step 2: the cheap check. Silent no-op unless something is due.
  //
  // --force skips the "is anything due?" DECISION, not the call itself: the
  // check is also how this learns which ClubExpress event to open (the Setup
  // tab's Event URL). Skipping the call outright left eventUrl empty and
  // crashed the run with "page.goto: url: expected string, got undefined".
  let reason = "manual";
  let eventUrl = "";
  const check = await postJson(scheduleUrl, { action: "check", password }).catch((e) => ({
    status: 0, json: null, text: e.message,
  }));
  if (check.status === 401) {
    recordFailure("Site password rejected by import-schedule.php.");
    process.exit(1);
  }
  if (check.status !== 200 || !check.json || !check.json.ok) {
    // Under --force a hand-set env var can still carry the run; unattended it
    // cannot, so that stays a hard failure.
    if (!FORCE || !process.env.VETTEFEST_EVENT_URL) {
      recordFailure("Schedule check failed (" + check.status + "): " + check.text);
      process.exit(1);
    }
    log("Schedule check failed but --force was given; using VETTEFEST_EVENT_URL.");
  } else {
    if (!FORCE && !check.json.shouldRun) {
      // The overwhelmingly common path: nothing due. Exit clean and quiet.
      process.exit(0);
    }
    // A forced run reports itself as "manual" (same as an Import Now click)
    // rather than claiming a scheduled slot it isn't filling.
    reason = FORCE ? "manual" : (check.json.reason || "manual");
    eventUrl = check.json.eventUrl || "";
    if (FORCE) log("--force given; running regardless of the schedule.");
  }

  // Env var overrides nothing — it only fills a gap the Setup tab left.
  if (!eventUrl) eventUrl = process.env.VETTEFEST_EVENT_URL || "";
  if (!eventUrl) {
    recordFailure(
      "No ClubExpress Event URL configured — set it in the app's Setup tab (Import Schedule > Event URL), " +
      "or set VETTEFEST_EVENT_URL for a one-off run."
    );
    process.exit(1);
  }

  log("Run due: " + reason);

  // --- Step 3: announce the start so the Setup tab can show "Import started".
  await markStart(reason).catch((e) => console.error("mark_start failed: " + e.message));

  let status = "success";
  let errorLine = "";
  try {
    // --- Step 4: the two ClubExpress exports.
    const files = await exportRegistrationCsvs({
      eventUrl,
      destDir: EXPORTS_DIR,
      log,
      headless: !HEADED,
    });

    // Never partially import: exportRegistrationCsvs throws unless BOTH
    // exports landed, so reaching here means we have both.
    if (!files.registration_data || !files.activity_registrant_data) {
      throw new Error("Only one of the two exports completed -- refusing to import a partial dataset.");
    }

    // --- Step 5: upload into the live app.
    const upload = await runUpload(eventUrl, file);
    log("upload-registrations.js exited " + upload.code);
    for (const l of upload.out.split(/\r?\n/)) if (l.trim()) log("  " + l.trim());
    if (upload.code !== 0) {
      throw new Error("Upload rejected by the server (see log for the status line).");
    }
    log("Import complete.");
  } catch (err) {
    status = "failed";
    // Playwright appends a multi-line "=== logs ===" call trace to its error
    // messages; that trace belongs in the archived log, not in the one-line
    // error the Setup tab's "Last run" line and the History tab display.
    const full = err instanceof LoginError ? "ClubExpress session not logged in" : String(err.message || err);
    errorLine = full.split(/\r?\n/)[0].replace(/\s*=+\s*logs\s*=+.*$/i, "").trim().slice(0, 300);
    if (full !== errorLine) log("Error detail: " + full.replace(/\r?\n/g, " | "));
    log("FAILED: " + errorLine);
  }

  // --- Step 6: archive the log, on success AND failure.
  await storeLog(file, logText(
    new Date().toISOString() + "  RESULT: " + (status === "success" ? "SUCCESS" : "FAILED: " + errorLine)
  )).catch((e) => console.error("Log archive failed: " + e.message));

  // --- Step 7: mark handled either way, so a persistent failure does not
  // re-attempt the full browser automation on every single poll forever.
  await markRun(reason, status, errorLine, file).catch((e) =>
    console.error("mark_run failed: " + e.message)
  );

  if (status === "failed") {
    recordFailure(errorLine);
    process.exit(1);
  }
  process.exit(0);
})().catch((err) => {
  recordFailure("Unexpected error: " + err.message);
  process.exit(1);
});
