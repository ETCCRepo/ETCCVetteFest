<?php
// Setup tab > Error Log — a read-only view onto the global security event
// log vettefest_log_security_event() (lib.php) writes to: every failed
// attempt against any of this app's four password gates (site login,
// Developer login, event delete, backup restore), plus anything a future
// vettefest_log_error() call records. Global, not per-event — login
// failures happen before any event is even selected — so unlike logs.php
// (the ClubExpress sync-run archive, scoped to one event's data/<year>/logs/)
// this reads data/security-log.json directly.
//
// Never exposes the attempted password — the log itself never stores it
// (see lib.php's own comment on vettefest_log_security_event()), only that
// an attempt failed, against which gate, when, and from what IP.
//
// Actions: list (session-or-password, same as everywhere else in this app —
// viewing is not destructive, so this doesn't require the Developer
// password the way triggering an event-delete or restore does).
session_start();

require __DIR__ . '/secrets.php';
require __DIR__ . '/lib.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) $input = [];
$action = (string)($input['action'] ?? ($_GET['action'] ?? 'list'));

if (!vettefest_authed($PASSWORD_HASH, $input['password'] ?? ($_GET['password'] ?? ''))) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['ok' => false, 'error' => 'Incorrect password.']);
    exit;
}

if ($action === 'list') {
    $path = vettefest_security_log_path();
    $entries = ($path !== null && is_file($path)) ? json_decode(file_get_contents($path), true) : null;
    if (!is_array($entries)) $entries = [];
    header('Content-Type: application/json');
    echo json_encode(['ok' => true, 'entries' => $entries, 'keep' => VETTEFEST_SECURITY_LOG_KEEP]);
    exit;
}

http_response_code(400);
header('Content-Type: application/json');
echo json_encode(['ok' => false, 'error' => 'Unknown action.']);
