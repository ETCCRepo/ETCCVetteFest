<?php
// Authenticated endpoint that stores the current Registration/Activity CSV
// pair server-side (registrations-data.json, gitignored, contains PII).
// index.php reads this file fresh on every request, so uploading here makes
// the hosted site's registration data live for the very next page load —
// no node build.js / ftp-deploy.sh cycle needed just to refresh data (that
// flow still applies for actual code changes).
//
// Meant to be called by deploy/upload-registrations.js after exporting
// fresh CSVs from ClubExpress (see that script and README.md), not by the
// browser app directly. Same dual auth as every other endpoint here: PHP
// session (same-origin) or password in the request body.
session_start();
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Content-Type: application/json');

require __DIR__ . '/secrets.php';
require __DIR__ . '/lib.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) $input = [];

if (!vettefest_authed($PASSWORD_HASH, $input['password'] ?? '')) {
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
$regFile = vettefest_show_file($year, 'registrations-data.json');
if ($regFile === null) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Could not open the data directory for ' . $year . '.']);
    exit;
}
$regCsv = (string)($input['regCsv'] ?? '');
$actCsv = (string)($input['actCsv'] ?? '');
if ($regCsv === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'regCsv is required.']);
    exit;
}

$generatedAt = isset($input['generatedAt']) ? (int)$input['generatedAt'] : (int)(microtime(true) * 1000);

$data = [
    'regCsv' => $regCsv,
    'actCsv' => $actCsv,
    'generatedAt' => $generatedAt,
    'uploadedAt' => gmdate('c'),
];

if (!vettefest_write_json($regFile, $data)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Could not save.']);
    exit;
}

vettefest_record_import_history($year, vettefest_csv_data_row_count($regCsv), vettefest_csv_data_row_count($actCsv));

echo json_encode(['ok' => true]);
