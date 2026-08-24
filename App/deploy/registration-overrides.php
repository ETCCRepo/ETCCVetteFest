<?php
// Field-level edit overrides for registration rows — registration-overrides.json
// is a flat object, csvRegKey(rec) -> patch (see app.js), NOT a list of full
// records. Every registration comes from the CSV pair, so a row has no
// server record of its own to update — this patch map, keyed by the row's
// stable csvRegKey(), is what makes an officer's edit survive the next
// re-import of the same export.
//
// A CSV row has no per-row server record of its own — registrations-data.json
// is wholly replaced by every fresh import — so persisting an edit means
// storing just the changed fields, keyed by the row's stable Reg-Date+name
// identity, and re-applying that patch on top of the freshly-parsed CSV every
// page load. Same architecture as deleted-registrations.json, but a patch
// object per key instead of a bare exclusion list.
//
// Actions: list (default), upsert.
//
// Auth via lib.php's vettefest_authed() — same PHP-session-or-password dual
// check every endpoint here uses.
session_start();
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

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

// Per-show data: every request must name the event year it belongs to.
// index.php appends ?year= to this endpoint's URL in window.__vettefestSite;
// callers with no query string (upload-registrations.js) may send it in the
// JSON body instead. An invalid/missing year is a hard 400 rather than a
// default, because guessing would write one event's data into another's.
$year = vettefest_valid_year($_GET['year'] ?? ($input['year'] ?? ''));
if ($year === null) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Missing or invalid event year.']);
    exit;
}
$file = vettefest_show_file($year, 'registration-overrides.json');
if ($file === null) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Could not open the data directory for ' . $year . '.']);
    exit;
}
$action = (string)($input['action'] ?? 'list');

function ro_read_map($file) {
    if (!is_file($file)) return [];
    $raw = file_get_contents($file);
    $decoded = $raw ? json_decode($raw, true) : [];
    return is_array($decoded) ? $decoded : [];
}

if ($action === 'list') {
    echo json_encode(['ok' => true, 'overrides' => ro_read_map($file)]);
    exit;
}

if ($action === 'upsert') {
    $key = (string)($input['key'] ?? '');
    $patch = $input['patch'] ?? null;
    if ($key === '' || !is_array($patch)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Missing key or patch.']);
        exit;
    }
    $map = ro_read_map($file);
    $map[$key] = $patch; // full replace for this key — the form always submits every editable field together
    if (!vettefest_write_json($file, $map)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Could not save.']);
        exit;
    }
    echo json_encode(['ok' => true, 'overrides' => $map]);
    exit;
}

// Drops this row's stored edits entirely, so regenerate() re-derives it
// straight from the CSV again — the "Revert to CSV" escape hatch for a row
// whose override holds bad data.
if ($action === 'delete') {
    $key = (string)($input['key'] ?? '');
    if ($key === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Missing key.']);
        exit;
    }
    $map = ro_read_map($file);
    unset($map[$key]);
    // Force object shape — an emptied map would otherwise serialize as [],
    // which ro_read_map()/the app would then read back as a list, not a map.
    if (!vettefest_write_json($file, (object)$map)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Could not save.']);
        exit;
    }
    echo json_encode(['ok' => true, 'overrides' => $map]);
    exit;
}

http_response_code(400);
echo json_encode(['ok' => false, 'error' => 'Unknown action.']);
