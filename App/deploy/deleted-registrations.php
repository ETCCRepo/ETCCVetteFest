<?php
// Tracks which CSV-derived registration rows have been removed via the
// Registration tab's checkbox/bulk-delete — deleted-registrations.json is
// just a flat array of csvRegKey() strings (see app.js), not full records.
// CSV rows have no per-row server record of their own (registrations-data.json
// is wholly replaced by every fresh import), so "deleting" one means
// excluding its key from every future page load's regenerate() — including a
// later re-import that still contains the same row. Every registration in
// this app is CSV-derived, so this tombstone list is the ONLY deletion
// mechanism — there is no per-row server record to remove instead.
//
// Actions: list (default), add.
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
$file = vettefest_show_file($year, 'deleted-registrations.json');
if ($file === null) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Could not open the data directory for ' . $year . '.']);
    exit;
}
$action = (string)($input['action'] ?? 'list');

if ($action === 'list') {
    echo json_encode(['ok' => true, 'keys' => vettefest_read_json_list($file)]);
    exit;
}

if ($action === 'add') {
    $incoming = $input['keys'] ?? null;
    if (!is_array($incoming)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Missing keys.']);
        exit;
    }
    $existing = vettefest_read_json_list($file);
    $merged = array_values(array_unique(array_merge($existing, array_map('strval', $incoming))));
    if (!vettefest_write_json($file, $merged)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Could not save.']);
        exit;
    }
    echo json_encode(['ok' => true, 'keys' => $merged]);
    exit;
}

http_response_code(400);
echo json_encode(['ok' => false, 'error' => 'Unknown action.']);
