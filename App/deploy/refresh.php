<?php
// Lets an already-open tab pull the latest server data without a full page
// reload — every tab (Summary, Registration, T-Shirts, Setup, History)
// re-fetches this on selection (see app.js's refreshShowData()) so a
// scheduled/manual import — or another officer's edit — that landed after
// this page was opened shows up right away instead of only after a reload.
//
// Returns exactly what vettefest_boot_data() (lib.php) assembles — the same
// function index.php's own boot script serializes at page load — so this
// endpoint can never drift out of sync with what a fresh page load would
// show. See that function's own comment for why ingestion order matters when
// the client applies this.
session_start();
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Content-Type: application/json');

require __DIR__ . '/secrets.php';
require __DIR__ . '/lib.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) $input = [];

if (!vettefest_authed($PASSWORD_HASH, $input['password'] ?? ($_GET['password'] ?? ''))) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Incorrect password.']);
    exit;
}

$year = vettefest_valid_year($_GET['year'] ?? ($input['year'] ?? ''));
if ($year === null) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Missing or invalid event year.']);
    exit;
}

echo json_encode(array_merge(['ok' => true], vettefest_boot_data($year)));
