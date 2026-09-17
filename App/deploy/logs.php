<?php
// Server-side archive of ETCCVetteFestImportData's per-run log files, so the
// History tab's log link works for anyone logged into the site rather than
// only on the machine that happened to run the import. Automatically purged
// after a week so this doesn't grow forever. Ported from the sibling CarShow
// app's logs.php — keep the two in sync.
//
// Actions:
//   store          (script, site-password auth) — upload one run's log text.
//   list           (browser or script, session-or-password) — recent log filenames + size/time.
//   get            (browser or script, session-or-password) — raw text content of one log.
//   report_failure (script, separate $HEARTBEAT_TOKEN auth) — records a
//                  one-line failure for a run that couldn't authenticate
//                  with the site password at all (see its own comment below).
//                  Ported from the sibling CarShow app, which added this
//                  first — keep the two in sync.
session_start();

require __DIR__ . '/secrets.php';
require __DIR__ . '/lib.php';

define('VETTEFEST_LOG_PURGE_DAYS', 7);
// Strict allowlist for log filenames — the only shape ETCCVetteFestImportData
// ever names them, and the only shape 'get'/'store' will ever act on. Anything
// else is rejected outright rather than risk a path-traversal via ?name=.
define('VETTEFEST_LOG_NAME_PATTERN', '/^sync-\d{8}-\d{6}\.log$/');

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) $input = [];

$action = (string)($input['action'] ?? ($_GET['action'] ?? ''));
$year = vettefest_valid_year($_GET['year'] ?? ($input['year'] ?? ''));
if ($year === null) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['ok' => false, 'error' => 'Missing or invalid event year.']);
    exit;
}

$showDir = vettefest_show_dir($year);
if ($showDir === null) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['ok' => false, 'error' => 'Could not open the data directory for ' . $year . '.']);
    exit;
}
$logsDir = $showDir . '/logs';
if (!is_dir($logsDir) && !@mkdir($logsDir, 0755, true) && !is_dir($logsDir)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['ok' => false, 'error' => 'Could not create the logs directory.']);
    exit;
}
// Deny-all like every other data/ subdirectory, in case the parent's
// .htaccess is ever lost/overridden — access here is still gated by
// vettefest_authed() regardless, this is defense in depth.
$deny = $logsDir . '/.htaccess';
if (!is_file($deny)) {
    @file_put_contents($deny,
        "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n" .
        "<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n");
}

// "Purged every week": every store/list call opportunistically deletes any
// log file older than VETTEFEST_LOG_PURGE_DAYS — no separate cron job needed.
function vettefest_logs_purge($logsDir) {
    $cutoff = time() - VETTEFEST_LOG_PURGE_DAYS * 86400;
    foreach ((glob($logsDir . '/*.log') ?: []) as $f) {
        if (@filemtime($f) < $cutoff) @unlink($f);
    }
}

// Deliberately separate auth from every other action here: this exists
// SPECIFICALLY for the case where sync-registrations.js can't authenticate
// with the normal site password (missing/wrong VETTEFEST_SITE_PASSWORD, or
// import-schedule.php's own 'check' call failing) and would otherwise have
// no way to report that at all — those failures used to only ever reach a
// local file on the machine that ran the import, invisible from the site.
// $HEARTBEAT_TOKEN is a fixed, unrelated credential (see secrets.example.php)
// so a broken site password can't also silently break this reporting path.
// Writes a normal archived log file — same directory, same naming pattern,
// same View Logs list as a real run's log — so nothing else needs to change
// to surface it.
if ($action === 'report_failure') {
    if (empty($HEARTBEAT_TOKEN) || !hash_equals((string)$HEARTBEAT_TOKEN, (string)($input['token'] ?? ''))) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['ok' => false, 'error' => 'Invalid token.']);
        exit;
    }
    $reason = trim((string)($input['reason'] ?? ''));
    if ($reason === '') $reason = 'Unknown startup failure.';
    if (strlen($reason) > 500) $reason = substr($reason, 0, 500) . '...(truncated)';
    $name = 'sync-' . gmdate('Ymd-His') . '.log';
    $line = gmdate('c') . '  FAILED (could not authenticate/start): ' . $reason . "\n";
    $line .= gmdate('c') . '  RESULT: FAILED: ' . $reason . "\n";
    if (@file_put_contents($logsDir . '/' . $name, $line) === false) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['ok' => false, 'error' => 'Could not save the log.']);
        exit;
    }
    vettefest_logs_purge($logsDir);
    header('Content-Type: application/json');
    echo json_encode(['ok' => true]);
    exit;
}

if ($action === 'store') {
    // Called by the scheduled task / ETCCVetteFestImportData, not the browser
    // — same site-password auth as upload-registrations.js.
    if (!vettefest_authed($PASSWORD_HASH, $input['password'] ?? '')) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['ok' => false, 'error' => 'Incorrect password.']);
        exit;
    }
    $name = (string)($input['name'] ?? '');
    $text = (string)($input['text'] ?? '');
    if (!preg_match(VETTEFEST_LOG_NAME_PATTERN, $name)) {
        http_response_code(400);
        header('Content-Type: application/json');
        echo json_encode(['ok' => false, 'error' => 'Invalid log filename.']);
        exit;
    }
    // Defensive cap — these are meant to be short; anything wildly larger than
    // expected gets truncated rather than accepted whole.
    if (strlen($text) > 200000) $text = substr($text, 0, 200000) . "\n...(truncated)";
    if (@file_put_contents($logsDir . '/' . $name, $text) === false) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['ok' => false, 'error' => 'Could not save the log.']);
        exit;
    }
    vettefest_logs_purge($logsDir);
    header('Content-Type: application/json');
    echo json_encode(['ok' => true]);
    exit;
}

if ($action === 'list') {
    if (!vettefest_authed($PASSWORD_HASH, $input['password'] ?? ($_GET['password'] ?? ''))) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['ok' => false, 'error' => 'Incorrect password.']);
        exit;
    }
    vettefest_logs_purge($logsDir);
    $files = [];
    foreach ((glob($logsDir . '/*.log') ?: []) as $f) {
        $files[] = ['name' => basename($f), 'size' => filesize($f), 'mtimeRaw' => filemtime($f), 'mtime' => gmdate('c', filemtime($f))];
    }
    // Sort by the file's actual save time (this server's own clock), not the
    // filename string — the filename's timestamp is decided client-side by
    // whatever machine ran the import, and isn't guaranteed to sort correctly
    // as plain text (e.g. across a machine-clock/timezone quirk).
    usort($files, function ($a, $b) { return $b['mtimeRaw'] - $a['mtimeRaw']; });
    foreach ($files as &$f) unset($f['mtimeRaw']);
    unset($f);
    header('Content-Type: application/json');
    echo json_encode(['ok' => true, 'files' => $files, 'purgeDays' => VETTEFEST_LOG_PURGE_DAYS]);
    exit;
}

if ($action === 'get') {
    if (!vettefest_authed($PASSWORD_HASH, $input['password'] ?? ($_GET['password'] ?? ''))) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['ok' => false, 'error' => 'Incorrect password.']);
        exit;
    }
    $name = (string)($_GET['name'] ?? ($input['name'] ?? ''));
    $path = $logsDir . '/' . $name;
    if (!preg_match(VETTEFEST_LOG_NAME_PATTERN, $name) || !is_file($path)) {
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(['ok' => false, 'error' => 'Log not found — it may have aged past the ' . VETTEFEST_LOG_PURGE_DAYS . '-day retention window.']);
        exit;
    }
    header('Content-Type: text/plain; charset=utf-8');
    echo file_get_contents($path);
    exit;
}

http_response_code(400);
header('Content-Type: application/json');
echo json_encode(['ok' => false, 'error' => 'Unknown action.']);
