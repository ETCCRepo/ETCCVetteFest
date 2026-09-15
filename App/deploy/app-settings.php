<?php
// Small key/value settings store for one event's app-settings.json:
//  - tshirtVendorEmail: the address the T-Shirts tab's T-Shirt Order Email
//    defaults its "To" field to (Developer > Settings > T-Shirt Vendor).
//    Nothing is ever sent automatically — an officer still reviews and
//    presses Send on that screen, and can override the recipient there.
//  - tshirtOrderSubject: the default Subject for that same email.
//  - eventUrl: the ClubExpress event Admin Panels URL for this event's year,
//    read by the /ETCCVetteFestImportData skill (via import-schedule.php's
//    'check') instead of a hardcoded URL that goes stale every year.
//  - autoImportEnabled / autoImportTimes / autoImportIntervalHours /
//    autoImportStartDate / autoImportEndDate: the Setup tab's auto-import
//    schedule. autoImportTimes is a list of explicit "HH:MM" (24-hour,
//    America/New_York) times to run an import each day; autoImportIntervalHours
//    (0 = off) is a simpler "every N hours, on the hour" alternative that is
//    unioned with — not folded into — autoImportTimes, so the two stay
//    independently editable and can be used together.
//
// All are per-event on purpose: the vendor, the wording and the ClubExpress
// event URL legitimately change from one year to the next, and a past year's
// record of what was ordered from whom shouldn't be rewritten by this year's
// settings.
//
// The defaults live in ONE place (lib.php's vettefest_settings_defaults())
// rather than being repeated here, in index.php's boot script and in
// send-tshirt-order-email.php — three copies that could silently drift.
//
// Actions: get (default), save.
// Auth via lib.php's vettefest_authed() — the same PHP-session-or-password
// dual check every endpoint here uses.
session_start();
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Content-Type: application/json');

require __DIR__ . '/secrets.php';
require __DIR__ . '/lib.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) $input = [];

if (!vettefest_authed($PASSWORD_HASH, $input['password'] ?? ($_POST['password'] ?? ''))) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Incorrect password.']);
    exit;
}

// Per-event data: every request must name the event year it belongs to.
// index.php appends ?year= to this endpoint's URL in window.__vettefestSite.
// An invalid/missing year is a hard 400 rather than a default, because
// guessing would write one event's data into another's.
$year = vettefest_valid_year($_GET['year'] ?? ($input['year'] ?? ''));
if ($year === null) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Missing or invalid event year.']);
    exit;
}
$file = vettefest_show_file($year, 'app-settings.json');
if ($file === null) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Could not open the data directory for ' . $year . '.']);
    exit;
}

$action = (string)($input['action'] ?? 'get');
$defaults = vettefest_settings_defaults();

if ($action === 'get') {
    echo json_encode(['ok' => true, 'settings' => vettefest_read_settings($year)]);
    exit;
}

if ($action === 'save') {
    $incoming = $input['settings'] ?? null;
    if (!is_array($incoming)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Missing settings.']);
        exit;
    }
    // Only keys this app actually knows about are persisted — a client
    // sending anything else can't quietly grow the stored object.
    $incoming = array_intersect_key($incoming, $defaults);
    $raw = is_file($file) ? json_decode(file_get_contents($file), true) : [];
    $settings = array_merge($defaults, is_array($raw) ? $raw : [], $incoming);
    if (!vettefest_write_json($file, $settings)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Could not save.']);
        exit;
    }
    echo json_encode(['ok' => true, 'settings' => $settings]);
    exit;
}

http_response_code(400);
echo json_encode(['ok' => false, 'error' => 'Unknown action.']);
