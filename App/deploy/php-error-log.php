<?php
// Setup tab > Error Log > "View PHP Error Log" — a plain link (not a
// fetch+JSON action like the rest of this app's Setup tab), same technique
// flyer.php's "View current flyer" link and logs.php's own 'get' action
// already use: session-or-site-password auth via vettefest_authed(), so a
// signed-in officer's existing session cookie is enough for a bare <a> click
// with no password in the URL.
//
// Streams data/php-error.log — the file lib.php's own top-of-file ini_set()
// call routes every PHP runtime error/warning/notice into (see that
// comment). Distinct from vettefest_log_security_event()'s own separate
// security-log.json: that's application-level events this app writes
// deliberately (failed passwords); this is PHP's OWN unplanned runtime
// errors, which is what "view the website error log" meant.
session_start();

require __DIR__ . '/secrets.php';
require __DIR__ . '/lib.php';

if (!vettefest_authed($PASSWORD_HASH, $_GET['password'] ?? ($_POST['password'] ?? ''))) {
    http_response_code(401);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Incorrect password.';
    exit;
}

header('Content-Type: text/plain; charset=utf-8');

$root = vettefest_data_root();
$file = $root === null ? null : $root . '/php-error.log';
if ($file === null || !is_file($file) || filesize($file) === 0) {
    echo "No PHP errors have been logged.";
    exit;
}

// This file grows for as long as the app runs and is never purged (unlike
// the sync-run logs or the security event log, neither of which fits this
// data — a raw PHP error stream has no natural "one entry" boundary to key
// a purge or cap off). Show only the most recent slice rather than
// potentially megabytes on every view.
$maxBytes = 500000;
$size = filesize($file);
if ($size > $maxBytes) {
    $fh = fopen($file, 'r');
    if ($fh) {
        fseek($fh, -$maxBytes, SEEK_END);
        echo "...(truncated — showing the most recent " . round($maxBytes / 1024) . " KB of " . round($size / 1024) . " KB total)\n\n";
        echo stream_get_contents($fh);
        fclose($fh);
    }
} else {
    readfile($file);
}
