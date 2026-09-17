<?php
// Event (year) registry API for data/shows.json.
//
// Each Vette Fest gets its own directory of data under data/<year>/ — this
// file manages the list of those events and which one is "current". The app's
// Events picker screen (buildShowsPage() in app.js) is the only UI for it;
// index.php reads the registry directly on every page load rather than
// calling this.
//
// Actions: list (default), create, rename, archive, unarchive, set_current, delete.
//
// "current" marks the live event — the one an officer should normally be
// working in. It is deliberately independent of which event a given session
// happens to have open (that's the session's year), so reviewing last year's
// numbers never changes what everyone else considers current.
//
// Auth via lib.php's vettefest_authed(), same as every other endpoint here.
// delete additionally requires the Developer password, since it destroys a
// whole year of data.
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

if (vettefest_data_root() === null) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Could not create the data directory on the server.']);
    exit;
}

$action = (string)($input['action'] ?? 'list');
$registry = vettefest_read_shows();

// Newest year first, so the list the app renders needs no sorting of its own.
function shows_sorted($shows) {
    usort($shows, function ($a, $b) {
        return (int)($b['year'] ?? 0) - (int)($a['year'] ?? 0);
    });
    return array_values($shows);
}

function shows_respond($registry) {
    echo json_encode([
        'ok' => true,
        'shows' => shows_sorted($registry['shows']),
        'current' => $registry['current']
    ]);
    exit;
}

function shows_fail($message, $code = 400) {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $message]);
    exit;
}

// Index of $year within $registry['shows'], or -1.
function shows_index($registry, $year) {
    foreach ($registry['shows'] as $i => $s) {
        if (vettefest_valid_year($s['year'] ?? '') === $year) return $i;
    }
    return -1;
}

if ($action === 'list') {
    shows_respond($registry);
}

$year = vettefest_valid_year($input['year'] ?? '');
if ($year === null) {
    shows_fail('A four-digit event year is required.');
}

if ($action === 'create') {
    if (shows_index($registry, $year) !== -1) {
        shows_fail('An event already exists for ' . $year . '.');
    }
    // Creating the directory up front means a brand-new event behaves
    // identically to an existing one from its very first page load — no
    // endpoint has to special-case "the folder isn't there yet".
    if (vettefest_show_dir($year) === null) {
        shows_fail('Could not create the data directory for ' . $year . '.', 500);
    }
    $name = trim((string)($input['name'] ?? ''));
    if ($name === '') $name = $year . ' Vette Fest';
    $registry['shows'][] = [
        'year' => (int)$year,
        'name' => $name,
        'status' => 'active',
        'created' => date('c')
    ];
    // The very first event created on a fresh install becomes current, so
    // there is always exactly one live event without a separate step.
    if ($registry['current'] === null) $registry['current'] = $year;
    if (!vettefest_write_shows($registry)) shows_fail('Could not save the event list.', 500);
    shows_respond($registry);
}

$idx = shows_index($registry, $year);
if ($idx === -1) {
    shows_fail('No event found for ' . $year . '.', 404);
}

if ($action === 'rename') {
    $name = trim((string)($input['name'] ?? ''));
    if ($name === '') shows_fail('An event name is required.');
    $registry['shows'][$idx]['name'] = $name;
    if (!vettefest_write_shows($registry)) shows_fail('Could not save the event list.', 500);
    shows_respond($registry);
}

if ($action === 'archive' || $action === 'unarchive') {
    $registry['shows'][$idx]['status'] = $action === 'archive' ? 'archived' : 'active';
    if (!vettefest_write_shows($registry)) shows_fail('Could not save the event list.', 500);
    shows_respond($registry);
}

if ($action === 'set_current') {
    $registry['current'] = $year;
    if (!vettefest_write_shows($registry)) shows_fail('Could not save the event list.', 500);
    shows_respond($registry);
}

if ($action === 'delete') {
    // Second credential required: this throws away an entire year of
    // registrations and officer edits, and there is no undo.
    $devPw = (string)($input['devPassword'] ?? '');
    $devOk = !empty($DEV_PASSWORD_HASH) && $devPw !== '' &&
             hash_equals($DEV_PASSWORD_HASH, crypt($devPw, $DEV_PASSWORD_HASH));
    if (!$devOk) {
        vettefest_log_security_event('dev_password_failed', 'event delete (year ' . $year . ')');
        shows_fail('The Developer password is required to delete an event.', 401);
    }
    $dir = vettefest_show_dir($year);
    if ($dir !== null) {
        // Flat one-level delete, not a recursive walk: vettefest_show_dir()
        // only ever puts plain files in here, so a directory turning up
        // would mean something unexpected, and silently recursing into it
        // is not a risk worth taking.
        foreach (vettefest_show_files() as $name) {
            $f = $dir . '/' . $name;
            if (is_file($f)) @unlink($f);
        }
        @rmdir($dir);
    }
    array_splice($registry['shows'], $idx, 1);
    if ($registry['current'] === $year) {
        // Fall back to the newest surviving event so there is always a live
        // one; null only if nothing is left at all.
        $remaining = shows_sorted($registry['shows']);
        $registry['current'] = $remaining ? vettefest_valid_year($remaining[0]['year'] ?? '') : null;
    }
    if (!vettefest_write_shows($registry)) shows_fail('Could not save the event list.', 500);
    shows_respond($registry);
}

shows_fail('Unknown action.');
