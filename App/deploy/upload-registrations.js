// Uploads the newest exported CSVs straight to the live site's
// registrations-upload.php, so the hosted page (etccapps.com) reflects them
// on the very next load. Replaces the old build-snapshot.js + ftp-deploy.sh
// dance for a pure DATA refresh — code changes (App/src/*) still go out via
// `node build.js` + `ftp-deploy.sh` as before, since those change
// app-bundle.html, not the data.
//
// Usage:
//   VETTEFEST_SITE_PASSWORD=... node deploy/upload-registrations.js [regCsvPath] [actCsvPath] [url]
// With no path args, picks the newest registration_data*.csv /
// activity_registrant_data*.csv in the Exports folder.
//
// The app holds one dataset per Vette Fest year, so the upload has to name
// the year it's for. Set VETTEFEST_YEAR (e.g. VETTEFEST_YEAR=2026); it defaults to
// the current calendar year, which is right for an in-season refresh and
// wrong only if you're backfilling a past event — in which case set it
// explicitly. The server rejects an unknown/invalid year outright rather
// than filing the CSVs under the wrong event.
var fs = require("fs");
var path = require("path");
var https = require("https");

var EXPORTS_DIR = "Z:/Backup/ETCC/Document Library/Restricted/Events/Vette Fest/Exports";
var DEFAULT_URL = "https://etccapps.com/apps/vettefest/registrations-upload.php";

function newestMatching(dir, prefix) {
  var files = fs.readdirSync(dir)
    .filter(function (f) { return f.indexOf(prefix) === 0 && f.endsWith(".csv"); })
    .map(function (f) { return { name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }; })
    .sort(function (a, b) { return b.mtime - a.mtime; });
  if (!files.length) throw new Error("No " + prefix + "*.csv found in " + dir);
  return path.join(dir, files[0].name);
}

var regCsvPath = process.argv[2] || newestMatching(EXPORTS_DIR, "registration_data");
var actCsvPath = process.argv[3] || newestMatching(EXPORTS_DIR, "activity_registrant_data");
var url = process.argv[4] || DEFAULT_URL;
var password = process.env.VETTEFEST_SITE_PASSWORD;
var year = process.env.VETTEFEST_YEAR || String(new Date().getFullYear());

if (!password) {
  console.error("Set VETTEFEST_SITE_PASSWORD to the site's login password before running this.");
  process.exit(1);
}
if (!/^[0-9]{4}$/.test(year)) {
  console.error("VETTEFEST_YEAR must be a four-digit car show year (got: " + year + ").");
  process.exit(1);
}

var regCsv = fs.readFileSync(regCsvPath, "utf8");
var actCsv = fs.readFileSync(actCsvPath, "utf8");

// Same "when was this actually exported" logic build-snapshot.js used —
// the newer of the two files' mtimes, not upload time.
var generatedAtMs = Math.max(fs.statSync(regCsvPath).mtimeMs, fs.statSync(actCsvPath).mtimeMs);

var payload = JSON.stringify({ regCsv: regCsv, actCsv: actCsv, generatedAt: generatedAtMs, password: password, year: year });
var u = new URL(url);

var req = https.request({
  hostname: u.hostname,
  path: u.pathname + u.search,
  method: "POST",
  headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
}, function (res) {
  var body = "";
  res.on("data", function (chunk) { body += chunk; });
  res.on("end", function () {
    console.log("Status: " + res.statusCode);
    console.log(body);
    console.log("Uploaded into car show: " + year);
    console.log("Uploaded from:");
    console.log("  " + regCsvPath);
    console.log("  " + actCsvPath);
    console.log("CSVs loaded time will show: " + new Date(generatedAtMs).toString());
    if (res.statusCode !== 200) process.exitCode = 1;
  });
});
req.on("error", function (err) {
  console.error("Upload failed:", err.message);
  process.exitCode = 1;
});
req.write(payload);
req.end();
