<?php
session_start();

// Belt-and-suspenders against browser/proxy caching of the gate itself —
// this page's content depends on session state AND on server-side data that
// can change between requests (registrations-import.php, a detail-modal
// edit), so a cached copy is always liable to be wrong. Relying on PHP's
// default session cache limiter wasn't enough on this host.
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

// $PASSWORD_HASH is defined in secrets.php (gitignored, not committed — see
// secrets.example.php for the template). Generate a new hash with:
//   openssl passwd -6 -salt "$(openssl rand -hex 8)" 'the-password'
// crypt() verifies SHA-512-crypt ($6$) hashes natively, no PHP needed locally.
require __DIR__ . '/secrets.php';
require __DIR__ . '/lib.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'login') {
    header('Content-Type: application/json');
    $pw = (string)($_POST['password'] ?? '');
    $ok = hash_equals($PASSWORD_HASH, crypt($pw, $PASSWORD_HASH));
    if ($ok) {
        session_regenerate_id(true);
        $_SESSION['vettefest_authenticated'] = true;
        echo json_encode(['success' => true]);
    } else {
        http_response_code(401);
        echo json_encode(['success' => false]);
    }
    exit;
}

// Separate "Developer" password (app.js's Developer Login screen) — a
// distinct credential from the main site login above, checked against
// $DEV_PASSWORD_HASH (secrets.php). This purely reveals the Developer
// submenu items client-side; it does NOT touch
// $_SESSION['vettefest_authenticated'] — Import Registrations is still
// independently session-gated server-side using the MAIN login session (you
// already have to be logged into the app to reach this prompt at all), so
// there's no separate server session to grant here.
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'dev_login') {
    header('Content-Type: application/json');
    if (empty($_SESSION['vettefest_authenticated'])) {
        http_response_code(401);
        echo json_encode(['success' => false]);
        exit;
    }
    $pw = (string)($_POST['password'] ?? '');
    $ok = !empty($DEV_PASSWORD_HASH) && hash_equals($DEV_PASSWORD_HASH, crypt($pw, $DEV_PASSWORD_HASH));
    echo json_encode(['success' => $ok]);
    if (!$ok) http_response_code(401);
    exit;
}

if (empty($_SESSION['vettefest_authenticated'])) {
    readfile(__DIR__ . '/_login.html');
    exit;
}

header('Content-Type: text/html; charset=utf-8');

// ---------------------------------------------------------------------------
// Which Vette Fest (year) is this request for?
// ---------------------------------------------------------------------------
$registry = vettefest_read_shows();

// ?year=NNNN selects an event and remembers it in the session, so a plain
// reload stays on the same one. ?year= with an empty value deselects —
// that's the menu's "Change Event" item, which sends the officer back to the
// picker.
//
// Switching events is a full page load rather than a client-side refetch: the
// boot script below already re-inlines every dataset from scratch on each
// request, so a reload gets the new year's data for free, with no chance of
// one event's records lingering in memory alongside another's.
if (isset($_GET['year'])) {
    $requested = vettefest_valid_year($_GET['year']);
    if ($requested !== null && vettefest_show_exists($requested, $registry)) {
        $_SESSION['vettefest_year'] = $requested;
    } else {
        // Covers both the deliberate deselect (?year=) and a stale link to an
        // event that has since been deleted.
        unset($_SESSION['vettefest_year']);
    }
}

// Re-validate on every request, not just when ?year= is present: an event
// deleted from another browser tab must not stay open in this one.
$year = vettefest_valid_year($_SESSION['vettefest_year'] ?? '');
if ($year !== null && !vettefest_show_exists($year, $registry)) {
    unset($_SESSION['vettefest_year']);
    $year = null;
}

// app-bundle.html is a plain copy of the built ETCCVetteFest.html, uploaded
// by ftp-deploy.sh whenever App/src/ changes — it carries NO baked-in data.
// The registration/activity CSVs and every stored edit are stitched in fresh
// below on every request, so a registrations-import.php upload is live for
// the very next page load with no rebuild/redeploy step. See README.md.
$bundle = @file_get_contents(__DIR__ . '/app-bundle.html');
if ($bundle === false) {
    http_response_code(500);
    echo 'app-bundle.html is missing on the server — run deploy/ftp-deploy.sh (after node build.js) to upload it.';
    exit;
}

// Must run BEFORE the bundled app.js so its init() (which fires on
// DOMContentLoaded — after every inline script in the document, including
// this one, has already run) sees window.__vettefestSite already set.
//
// Every per-event endpoint URL carries ?year=<year>. That single decision is
// what keeps the client simple: app.js's fetch() call sites never had to
// learn about years — the URL they already use is year-scoped. shows.php is
// deliberately NOT year-scoped (it manages the list of years itself).
$yearQuery = $year !== null ? '?year=' . rawurlencode($year) : '';
$perShowUrls = [
    'appSettingsApiUrl' => 'app-settings.php',
    'deletedRegistrationsApiUrl' => 'deleted-registrations.php',
    'registrationOverridesApiUrl' => 'registration-overrides.php',
    'sendTshirtOrderEmailApiUrl' => 'send-tshirt-order-email.php',
    'flyerApiUrl' => 'flyer.php'
];
$siteConfig = [];
foreach ($perShowUrls as $key => $file) {
    $siteConfig[$key] = $file . $yearQuery;
}
$siteConfig['showsApiUrl'] = 'shows.php';
$siteConfigScript = "<script>window.__vettefestSite = " . vettefest_safe_inline_json($siteConfig) . ";</script>\n";
$bundle = str_replace('<head>', '<head>' . "\n" . $siteConfigScript, $bundle);

$bootParts = [];

// MUST be first: until the app knows the event list and which one (if any) is
// open, it can't decide whether to render the picker or the tabs — and
// ingestShows also sets CONFIG.title from the event's name and the open year
// that regenerate() builds Reg # from, both of which ingestRows below relies on.
$bootParts[] = "    window.__vettefest.ingestShows(" .
    vettefest_safe_inline_json($registry['shows']) . ", " .
    vettefest_safe_inline_json($registry['current']) . ", " .
    vettefest_safe_inline_json($year) . ");\n";

// With no event open the app renders the picker and nothing else, so there is
// no point reading — or shipping to the browser — any event's data.
if ($year !== null) {

    // Per-event settings. Defaults come from lib.php, the same single source
    // app-settings.php and send-tshirt-order-email.php read.
    $bootParts[] = "    window.__vettefest.ingestAppSettings(" .
        vettefest_safe_inline_json(vettefest_read_settings($year)) . ");\n";

    // Event flyer METADATA only (mime/name/uploadedAt) — never the base64
    // bytes, which can be several MB. The Setup tab shows the "current flyer"
    // state from this; the Reports tab's Print Flyer fetches the actual file
    // from flyer.php on demand.
    $flyerFile = vettefest_show_file($year, 'flyer.json');
    $flyerRaw = ($flyerFile !== null && is_file($flyerFile)) ? json_decode(file_get_contents($flyerFile), true) : null;
    $flyerMeta = (is_array($flyerRaw) && !empty($flyerRaw['dataB64']))
        ? ['exists' => true, 'mime' => $flyerRaw['mime'] ?? 'application/octet-stream',
           'name' => $flyerRaw['name'] ?? 'flyer', 'uploadedAt' => $flyerRaw['uploadedAt'] ?? null]
        : ['exists' => false];
    $bootParts[] = "    window.__vettefest.ingestFlyer(" . vettefest_safe_inline_json($flyerMeta) . ");\n";

    // MUST run before the ingestRows() call below — regenerate() (triggered
    // by ingestRows) excludes deleted keys from the freshly-parsed CSV the
    // moment it runs, not just after the fact.
    $deletedKeys = vettefest_read_json_list(vettefest_show_file($year, 'deleted-registrations.json'));
    $bootParts[] = "    window.__vettefest.ingestDeletedRegistrations(" . vettefest_safe_inline_json($deletedKeys) . ");\n";

    // Same ordering requirement — regenerate() applies these field-edit
    // patches to the freshly-parsed rows immediately.
    $overridesFile = vettefest_show_file($year, 'registration-overrides.json');
    $overridesRaw = is_file($overridesFile) ? json_decode(file_get_contents($overridesFile), true) : [];
    $overrides = is_array($overridesRaw) ? $overridesRaw : [];
    $bootParts[] = "    window.__vettefest.ingestRegistrationOverrides(" . vettefest_safe_inline_json($overrides) . ");\n";

    $regFile = vettefest_show_file($year, 'registrations-data.json');
    if (is_file($regFile)) {
        $reg = json_decode(file_get_contents($regFile), true);
        if (is_array($reg) && !empty($reg['regCsv'])) {
            $bootParts[] =
                "    var REG_CSV = " . vettefest_safe_inline_json($reg['regCsv']) . ";\n" .
                "    var ACT_CSV = " . vettefest_safe_inline_json($reg['actCsv'] ?? '') . ";\n" .
                "    var GENERATED_AT = new Date(" . (int)($reg['generatedAt'] ?? 0) . ");\n" .
                "    var regRows = Papa.parse(REG_CSV, { header: true, skipEmptyLines: true }).data;\n" .
                "    var actRows = ACT_CSV ? Papa.parse(ACT_CSV, { header: true, skipEmptyLines: true }).data : [];\n" .
                "    window.__vettefest.ingestRows(regRows, actRows, GENERATED_AT);\n";
        }
    }

}

$bootScript = "\n<script>\n(function(){\n  function boot(){\n" . implode('', $bootParts) .
    "  }\n  if (document.readyState === \"loading\") document.addEventListener(\"DOMContentLoaded\", boot);\n  else boot();\n})();\n</script>\n";
$bundle = str_replace('</body>', $bootScript . '</body>', $bundle);

echo $bundle;
