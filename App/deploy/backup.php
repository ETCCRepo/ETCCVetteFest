<?php
// Setup tab > Backups — a "Backup Now" button that zips this app's live
// JSON "database" (the data/ tree, plus the two root-level global
// password-reset files — see vettefest_run_backup() in lib.php for the
// exact list) into deploy/backups/, and a permanent log of every run
// (backup-history.json) so officers can see backups are actually happening
// and catch a run that failed. This is a point-in-time snapshot kept ON
// this server; the ETCCVetteFestBackup Claude Code skill pulls the same
// underlying data down to a Windows machine over FTP for off-server
// redundancy — different transport, same data, kept for a different
// failure mode (this server itself going away).
//
// Also holds the auto-backup schedule (enable + active date range, same UX
// as the Import Schedule's own auto-import settings) — the actual daily
// trigger lives in lib.php's vettefest_backup_auto_check(), called from
// import-schedule.php's 'check' action (see that function's own comment for
// why it's wired there instead of a schedule task of its own).
//
// Ported from the sibling CarShow app's own backup.php — keep the two in
// sync for connection/shape reasons; Vette-Fest-only differences (no
// members/sponsorship files) obviously don't need to cross over.
//
// Actions: run (POST, session-or-password), list (GET/POST,
// session-or-password), download (GET, session-or-password),
// delete (POST, session-or-password), get_schedule (GET/POST,
// session-or-password), save_schedule (POST, session-or-password).
session_start();
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

require __DIR__ . '/secrets.php';
require __DIR__ . '/lib.php';

// Matches import-schedule.php's own timezone — "today" here (save_schedule's
// date-range check, surfaced via lastAutoRunDate) must agree with what
// vettefest_backup_auto_check() considers "today" when it's called from there.
date_default_timezone_set('America/New_York');

define('VETTEFEST_BACKUP_NAME_PATTERN', '/^[0-9]{14}-VetteFestData\.zip$/');

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) $input = [];
$action = (string)($input['action'] ?? ($_GET['action'] ?? 'list'));

if (!vettefest_authed($PASSWORD_HASH, $input['password'] ?? ($_GET['password'] ?? ''))) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['ok' => false, 'error' => 'Incorrect password.']);
    exit;
}

$historyFile = vettefest_backup_history_file();

if ($action === 'run') {
    $result = vettefest_run_backup();
    $entry = ['timestamp' => gmdate('c'), 'status' => $result['ok'] ? 'success' : 'failed', 'reason' => 'manual'];
    if ($result['ok']) {
        $entry['fileName'] = $result['fileName'];
        $entry['sizeBytes'] = $result['sizeBytes'];
        $entry['fileCount'] = $result['fileCount'];
    } else {
        $entry['error'] = $result['error'];
    }
    vettefest_append_json_list($historyFile, $entry);
    header('Content-Type: application/json');
    echo json_encode(['ok' => $result['ok'], 'error' => $result['ok'] ? null : $result['error'], 'entry' => $entry]);
    exit;
}

if ($action === 'list') {
    header('Content-Type: application/json');
    echo json_encode(['ok' => true, 'history' => vettefest_read_json_list($historyFile)]);
    exit;
}

if ($action === 'delete') {
    // Identity is the timestamp (second-precision ISO 8601), same convention
    // import-history.json's own delete already uses — two backups never
    // actually complete in the same second.
    $timestamp = (string)($input['timestamp'] ?? '');
    $history = vettefest_read_json_list($historyFile);
    $target = null;
    foreach ($history as $e) {
        if (is_array($e) && ($e['timestamp'] ?? null) === $timestamp) { $target = $e; break; }
    }
    if ($target === null) {
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(['ok' => false, 'error' => 'Backup log entry not found.']);
        exit;
    }

    $dir = vettefest_backups_dir();
    $fileName = (string)($target['fileName'] ?? '');
    if ($fileName !== '' && preg_match(VETTEFEST_BACKUP_NAME_PATTERN, $fileName) && $dir !== null) {
        $path = $dir . '/' . $fileName;
        if (is_file($path)) {
            // Never delete the last remaining backup zip on the server —
            // same guarantee vettefest_backup_purge()'s floor gives the
            // automatic purge, enforced here too for a manual delete.
            if (vettefest_backup_zip_count($dir) <= 1) {
                http_response_code(400);
                header('Content-Type: application/json');
                echo json_encode(['ok' => false, 'error' => 'Can\'t delete this — it\'s the only backup left on the server. Run a new backup first.']);
                exit;
            }
            @unlink($path);
        }
    }

    $kept = array_values(array_filter($history, function ($e) use ($timestamp) {
        return !(is_array($e) && ($e['timestamp'] ?? null) === $timestamp);
    }));
    if (!vettefest_write_json($historyFile, $kept)) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['ok' => false, 'error' => 'Could not save.']);
        exit;
    }
    header('Content-Type: application/json');
    echo json_encode(['ok' => true, 'history' => $kept]);
    exit;
}

if ($action === 'get_schedule') {
    header('Content-Type: application/json');
    echo json_encode(['ok' => true, 'schedule' => vettefest_read_backup_schedule()]);
    exit;
}

if ($action === 'save_schedule') {
    $schedule = [
        'enabled' => !empty($input['enabled']),
        'startDate' => (string)($input['startDate'] ?? ''),
        'endDate' => (string)($input['endDate'] ?? ''),
        // Server-owned bookkeeping — preserve whatever's already there so a
        // settings save can't wipe today's "already ran" marker and cause an
        // extra same-day run.
        'lastAutoRunDate' => vettefest_read_backup_schedule()['lastAutoRunDate'],
    ];
    if (!vettefest_write_backup_schedule($schedule)) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['ok' => false, 'error' => 'Could not save.']);
        exit;
    }
    header('Content-Type: application/json');
    echo json_encode(['ok' => true, 'schedule' => $schedule]);
    exit;
}

if ($action === 'download') {
    $name = (string)($_GET['name'] ?? ($input['name'] ?? ''));
    $dir = vettefest_backups_dir();
    $path = $dir === null ? null : $dir . '/' . $name;
    if (!preg_match(VETTEFEST_BACKUP_NAME_PATTERN, $name) || $path === null || !is_file($path)) {
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(['ok' => false, 'error' => 'Backup file not found — it may have aged past the retention limit (newest ' . VETTEFEST_BACKUP_KEEP . ' kept).']);
        exit;
    }
    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="' . $name . '"');
    header('Content-Length: ' . filesize($path));
    readfile($path);
    exit;
}

http_response_code(400);
header('Content-Type: application/json');
echo json_encode(['ok' => false, 'error' => 'Unknown action.']);
