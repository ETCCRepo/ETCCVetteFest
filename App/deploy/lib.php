<?php
// Shared helpers for the deploy/ PHP endpoints (index.php, shows.php,
// app-settings.php, deleted-registrations.php, registration-overrides.php,
// registrations-upload.php, registrations-import.php,
// send-tshirt-order-email.php). Centralizes the auth check, lock-guarded
// JSON read/write, safe-inline-script embedding, SMTP sending, and the
// per-event data paths that would otherwise be copy-pasted across all of them.

// The site login accepts more than one password — $PASSWORD_HASH plus an
// optional second one, $PASSWORD_HASH_2 (both in secrets.php; the second is
// unset/empty by default, so a site with only one configured behaves exactly
// as before). Read as globals rather than threaded through every call site,
// since secrets.php is already require()'d before any of them run.
function vettefest_password_hashes() {
    global $PASSWORD_HASH, $PASSWORD_HASH_2;
    $hashes = [$PASSWORD_HASH];
    if (!empty($PASSWORD_HASH_2)) $hashes[] = $PASSWORD_HASH_2;
    return $hashes;
}

// True if either the current PHP session is already authenticated (the
// normal case for same-origin calls made from the hosted page itself, e.g.
// a detail-modal edit saved while logged in) or the request supplied a
// password matching one of secrets.php's site-password hashes (the normal
// case for calls with no shared session, e.g. upload-registrations.js's
// automated CSV push). $passwordHash is kept as the first parameter for
// every existing call site (they all pass $PASSWORD_HASH) but is no longer
// the only hash checked — vettefest_password_hashes() adds the second one.
function vettefest_authed($passwordHash, $providedPassword) {
    if (!empty($_SESSION['vettefest_authenticated'])) return true;
    $pw = (string)$providedPassword;
    if ($pw === '') return false;
    foreach (vettefest_password_hashes() as $hash) {
        if ($hash && hash_equals($hash, crypt($pw, $hash))) return true;
    }
    return false;
}

function vettefest_read_json_list($file) {
    if ($file === null || !is_file($file)) return [];
    $raw = file_get_contents($file);
    $decoded = $raw ? json_decode($raw, true) : [];
    return is_array($decoded) ? $decoded : [];
}

// Lock-guarded overwrite so a public form submission and an officer's edit
// landing at nearly the same moment can't clobber each other.
function vettefest_write_json($file, $value) {
    if ($file === null) return false;
    $fh = fopen($file, 'c+');
    if (!$fh || !flock($fh, LOCK_EX)) {
        if ($fh) fclose($fh);
        return false;
    }
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($value, JSON_PRETTY_PRINT));
    fflush($fh);
    flock($fh, LOCK_UN);
    fclose($fh);
    return true;
}

// Appends one record to a JSON-array file under the same lock (read +
// modify + write as one atomic step, so a concurrent append can't be lost).
function vettefest_append_json_list($file, $record) {
    if ($file === null) return false;
    $fh = fopen($file, 'c+');
    if (!$fh || !flock($fh, LOCK_EX)) {
        if ($fh) fclose($fh);
        return false;
    }
    $size = filesize($file) ?: 0;
    $raw = $size > 0 ? fread($fh, $size) : '';
    $list = $raw ? json_decode($raw, true) : [];
    if (!is_array($list)) $list = [];
    $list[] = $record;
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($list, JSON_PRETTY_PRINT));
    fflush($fh);
    flock($fh, LOCK_UN);
    fclose($fh);
    return true;
}

// Counts data rows in a CSV string (header line excluded, blank trailing
// lines excluded) — the same rule registrations-import.php's upload form
// uses to report "Imported N registration rows", now shared so the History
// tab's counts always mean the same thing regardless of which import path
// (browser form or upload-registrations.js) produced them.
function vettefest_csv_data_row_count($csvText) {
    if (!is_string($csvText) || $csvText === '') return 0;
    $lines = preg_split('/\r\n|\r|\n/', $csvText);
    if (!$lines) return 0;
    $count = 0;
    foreach (array_slice($lines, 1) as $line) {
        if (trim($line) !== '') $count++;
    }
    return $count;
}

// Appends one entry to this event's import-history.json — called by both
// registrations-import.php (the browser upload form) and
// registrations-upload.php (upload-registrations.js's CLI flow) right after
// a successful save, so the History tab has one continuous log regardless of
// which path officers use to refresh the data. Best-effort: a failure here
// never blocks the import itself (the registration data is already saved by
// the time this runs), it just means that one import goes unlogged.
// $source is 'cli' (upload-registrations.js / the import skill) or 'browser'
// (the manual registrations-import.php file picker); $eventUrl/$logFile are
// best-effort provenance shown by the History tab (the ClubExpress URL the
// export came from, and the logs.php filename its 📄 link opens).
//
// Writes 'timestamp' rather than the older 'importedAt' key this used before
// the CarShow-parity port — buildHistoryView() reads either, so entries
// written by the previous version still render instead of showing a blank
// date.
function vettefest_record_import_history($year, $regRows, $actRows, $source = 'browser', $eventUrl = '', $logFile = '') {
    $file = vettefest_show_file($year, 'import-history.json');
    if ($file === null) return false;
    return vettefest_append_json_list($file, [
        'timestamp' => gmdate('c'),
        'regRows' => $regRows === null ? null : (int)$regRows,
        'actRows' => $actRows === null ? null : (int)$actRows,
        'source' => $source,
        'eventUrl' => (string)$eventUrl,
        'outcome' => 'success',
        'logFile' => (string)$logFile,
    ]);
}

// Encodes a PHP value as JSON safe to embed inside an inline <script> block:
// guards the two line-terminator code points JSON leaves unescaped but that
// choke some JS engines inside string literals, and neutralizes "</script"
// so real data containing that literal substring (e.g. a pasted comment)
// can't prematurely close the tag.
function vettefest_safe_inline_json($value) {
    $json = json_encode($value);
    $json = str_replace(["\xE2\x80\xA8", "\xE2\x80\xA9"], ['\\u2028', '\\u2029'], $json);
    $json = str_ireplace('</script', '<\\/script', $json);
    return $json;
}

// Minimal SMTP client (AUTH LOGIN, implicit TLS on 465 or STARTTLS on 587) —
// used instead of PHP's raw mail(), which was observed returning success
// while silently failing to actually deliver to Gmail from this Hostinger
// account (no SPF/DKIM behind mail()'s local sendmail path; mail()'s return
// value only confirms local hand-off, not delivery). No external
// library/Composer — self-contained, matching every other deploy/ endpoint.
// Credentials come from secrets.php's $SMTP_* vars; returns false (caller
// should show an error) if they're not configured or sending fails at any
// step of the conversation.
// Splits a comma/semicolon-separated string into validated email addresses,
// silently dropping anything that fails FILTER_VALIDATE_EMAIL. Used for
// settings-driven To/CC/BCC fields that may hold multiple addresses (e.g.
// a To/CC/BCC field on the T-Shirt Order Form).
function vettefest_parse_addr_list($raw) {
    if (!is_string($raw) || trim($raw) === '') return [];
    $out = [];
    foreach (preg_split('/[,;]+/', $raw) as $part) {
        $part = trim($part);
        if ($part !== '' && filter_var($part, FILTER_VALIDATE_EMAIL)) $out[] = $part;
    }
    return $out;
}

function vettefest_send_mail($to, $subject, $body, $cc = '', $bcc = '', $html = false) {
    // Plain require (not require_once): require_once tracks inclusion by
    // resolved file path regardless of scope, so if some other code in this
    // request already required secrets.php, require_once here would
    // silently no-op and leave these locals undefined. secrets.php is just
    // variable assignments, so re-running it is harmless.
    $secretsFile = __DIR__ . '/secrets.php';
    if (is_file($secretsFile)) require $secretsFile;
    if (empty($SMTP_HOST) || empty($SMTP_USER) || empty($SMTP_PASS)) return false;

    $port = !empty($SMTP_PORT) ? (int)$SMTP_PORT : 465;
    $from = !empty($SMTP_FROM) ? $SMTP_FROM : $SMTP_USER;
    $target = ($port === 465 ? 'ssl://' : '') . $SMTP_HOST . ':' . $port;

    $sock = @stream_socket_client($target, $errno, $errstr, 15);
    if (!$sock) return false;
    stream_set_timeout($sock, 15);

    // Reads a full (possibly multi-line) reply: SMTP marks the final line of
    // a multi-line response with a space in the 4th column (e.g. "250 OK"
    // vs "250-continues"); anything else means keep reading.
    $read = function () use ($sock) {
        $data = '';
        while (($line = fgets($sock, 515)) !== false) {
            $data .= $line;
            if (strlen($line) < 4 || $line[3] === ' ') break;
        }
        return $data;
    };
    $write = function ($cmd) use ($sock) { fwrite($sock, $cmd . "\r\n"); };
    $expect = function ($code) use ($read) { return strpos($read(), (string)$code) === 0; };
    $fail = function () use ($sock) { fclose($sock); return false; };

    $read(); // server greeting
    $write('EHLO etccapps.com');
    $read();

    if ($port !== 465) {
        $write('STARTTLS');
        if (!$expect(220)) return $fail();
        if (!stream_socket_enable_crypto($sock, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) return $fail();
        $write('EHLO etccapps.com');
        $read();
    }

    $write('AUTH LOGIN');
    if (!$expect(334)) return $fail();
    $write(base64_encode($SMTP_USER));
    if (!$expect(334)) return $fail();
    $write(base64_encode($SMTP_PASS));
    if (!$expect(235)) return $fail();

    $write('MAIL FROM:<' . $from . '>');
    if (!$expect(250)) return $fail();
    // $to may be a single address (every pre-existing caller) or a
    // comma/semicolon-separated list (settings-driven callers).
    $toList = vettefest_parse_addr_list($to);
    if (!$toList && filter_var(trim((string)$to), FILTER_VALIDATE_EMAIL)) $toList = [trim($to)];
    if (!$toList) return $fail();
    foreach ($toList as $toEmail) {
        $write('RCPT TO:<' . $toEmail . '>');
        if (!$expect(250)) return $fail();
    }

    // Add CC recipients
    if (!empty($cc)) {
        $ccList = array_map('trim', explode(',', $cc));
        foreach ($ccList as $ccEmail) {
            if (!empty($ccEmail)) {
                $write('RCPT TO:<' . $ccEmail . '>');
                if (!$expect(250)) return $fail();
            }
        }
    }

    // Add BCC recipients
    if (!empty($bcc)) {
        $bccList = array_map('trim', explode(',', $bcc));
        foreach ($bccList as $bccEmail) {
            if (!empty($bccEmail)) {
                $write('RCPT TO:<' . $bccEmail . '>');
                if (!$expect(250)) return $fail();
            }
        }
    }

    $write('DATA');
    if (!$expect(354)) return $fail();

    $headers = "From: {$from}\r\nTo: " . implode(', ', $toList) . "\r\n";
    if (!empty($cc)) $headers .= "Cc: {$cc}\r\n";
    $contentType = $html ? 'text/html' : 'text/plain';
    $headers .= "Subject: {$subject}\r\n" .
        "MIME-Version: 1.0\r\nContent-Type: {$contentType}; charset=UTF-8\r\n";
    // Dot-stuffing: a line starting with "." in the body must be escaped to
    // ".." or the SMTP server reads it as the end-of-DATA terminator.
    $safeBody = preg_replace('/^\./m', '..', $body);
    $write($headers . "\r\n" . $safeBody . "\r\n.");
    $ok = $expect(250);
    $write('QUIT');
    fclose($sock);
    return $ok;
}

// ---------------------------------------------------------------------------
// Multi-event (per-year) data paths
// ---------------------------------------------------------------------------
// Every Vette Fest year gets its own directory under data/, so 2026's
// registrations, edits and settings are completely independent of 2027's.
// Nothing outside these helpers is allowed to build a data path — a single
// choke point is what keeps a bad ?year= from ever reaching the filesystem.

// Strict 4-digit validation. Returns the year as a string, or null. A caller
// that gets null MUST fail the request outright: silently defaulting to some
// other year would write one event's data into another event's files, which
// is far worse than a visible 400. Mirrored client-side by logic.js's
// LOGIC.validShowYear(), but THIS is the real gate.
function vettefest_valid_year($raw) {
    $y = trim((string)$raw);
    return preg_match('/^[0-9]{4}$/', $y) === 1 ? $y : null;
}

// data/ itself. Created on demand, with a deny-all .htaccess dropped in the
// first time — so the JSON under it is protected even if the parent
// directory's .htaccess rules are ever lost or overridden by the host.
function vettefest_data_root() {
    $root = __DIR__ . '/data';
    if (!is_dir($root) && !@mkdir($root, 0755, true) && !is_dir($root)) return null;
    $deny = $root . '/.htaccess';
    if (!is_file($deny)) {
        @file_put_contents($deny,
            "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n" .
            "<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n");
    }
    return $root;
}

// data/<year>/, created on demand. Returns null if the year is invalid or the
// directory can't be created (e.g. no write permission on the FTP root) —
// callers surface that as an error rather than writing somewhere unexpected.
function vettefest_show_dir($year) {
    $y = vettefest_valid_year($year);
    if ($y === null) return null;
    $root = vettefest_data_root();
    if ($root === null) return null;
    $dir = $root . '/' . $y;
    if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) return null;
    return $dir;
}

// Full path to one per-year data file, e.g.
// vettefest_show_file('2026', 'registrations-data.json').
function vettefest_show_file($year, $name) {
    $dir = vettefest_show_dir($year);
    return $dir === null ? null : $dir . '/' . $name;
}

// The event registry: { "current": 2026, "shows": [ {year,name,status,created}, ... ] }.
// An object rather than a list, so it gets its own reader (same reason
// registration-overrides.php has one). Absent until the first event is
// created — vettefest_read_shows() returns an empty registry for that case,
// which is what puts the app on its "no events yet" empty state.
function vettefest_shows_path() {
    $root = vettefest_data_root();
    return $root === null ? null : $root . '/shows.json';
}

function vettefest_read_shows() {
    $path = vettefest_shows_path();
    $raw = ($path !== null && is_file($path)) ? json_decode(file_get_contents($path), true) : null;
    if (!is_array($raw)) $raw = [];
    $shows = isset($raw['shows']) && is_array($raw['shows']) ? array_values($raw['shows']) : [];
    $current = vettefest_valid_year($raw['current'] ?? '');
    return ['shows' => $shows, 'current' => $current];
}

function vettefest_write_shows($registry) {
    $path = vettefest_shows_path();
    if ($path === null) return false;
    return vettefest_write_json($path, [
        'current' => $registry['current'] ?? null,
        'shows'   => array_values($registry['shows'] ?? [])
    ]);
}

// True if $year names an event that actually exists in the registry. Opening a
// year that was never created (or was deleted) must not silently conjure an
// empty one, so index.php checks this before honouring ?year=.
function vettefest_show_exists($year, $registry = null) {
    $y = vettefest_valid_year($year);
    if ($y === null) return false;
    if ($registry === null) $registry = vettefest_read_shows();
    foreach ($registry['shows'] as $s) {
        if (vettefest_valid_year($s['year'] ?? '') === $y) return true;
    }
    return false;
}

// ---------------------------------------------------------------------------
// Per-event settings
// ---------------------------------------------------------------------------
// The single definition of what app-settings.json holds. index.php's boot
// script, app-settings.php and send-tshirt-order-email.php all read it from
// here rather than each carrying their own copy — three hand-synced copies
// is exactly how a default silently drifts from what the UI shows.
function vettefest_settings_defaults() {
    return [
        'tshirtVendorEmail'  => '',
        'tshirtOrderSubject' => 'ETCC Vette Fest — T-Shirt Order',
        // --- Reports tab report builders (app.js's openGenReportPage()) ---
        // Per report: the chosen column keys in print order, the sort column
        // and direction, and (<id>ReportSorts) the multi-column sort levels
        // [{key, dir}] -- SortCol/SortDir mirror its first level. An empty column list / sort column means "never
        // customized" — app.js falls back to that report's own defaults, so the
        // default layout can change in one place without saved settings
        // pinning the old one. MUST be listed here: app-settings.php drops any
        // key missing from these defaults.
        'regReportColumns' => [],
        'regReportSortCol' => '',
        'regReportSortDir' => 'asc',
        'regReportSorts' => [],
        'carShowReportColumns' => [],
        'carShowReportSortCol' => '',
        'carShowReportSortDir' => 'asc',
        'carShowReportSorts' => [],
        'tshirtReportColumns' => [],
        'tshirtReportSortCol' => '',
        'tshirtReportSortDir' => 'asc',
        'tshirtReportSorts' => [],
        // --- Setup tab > Import Schedule (see import-schedule.php) ---
        // eventUrl: the ClubExpress event Admin Panels URL for this event's
        // year, read by the /ETCCVetteFestImportData skill instead of a
        // hardcoded URL that goes stale every year.
        'eventUrl' => '',
        // autoImportTimes is a list of explicit "HH:MM" (24-hour, America/
        // New_York) times to run an import each day. autoImportIntervalHours
        // (0 = off) is a simpler "every N hours, on the hour" alternative;
        // import-schedule.php's 'check' unions both into one slot list rather
        // than letting one override the other, so they stay independently
        // editable and can be used together.
        'autoImportEnabled' => false,
        'autoImportTimes' => [],
        'autoImportIntervalHours' => 0,
        'autoImportStartDate' => '',
        'autoImportEndDate' => ''
    ];
}

// One event's settings, defaults filled in. Returns the defaults untouched
// for a missing/invalid year, so a caller that only wants a fallback address
// doesn't have to special-case "no event open".
function vettefest_read_settings($year) {
    $defaults = vettefest_settings_defaults();
    $file = vettefest_show_file($year, 'app-settings.json');
    if ($file === null || !is_file($file)) return $defaults;
    $raw = json_decode(file_get_contents($file), true);
    return array_merge($defaults, is_array($raw) ? $raw : []);
}

// Everything one event's page load needs, in one place. index.php's boot
// script and refresh.php's "re-check this tab's data without a full reload"
// endpoint both call this — so the two can never quietly drift apart the way
// two hand-maintained copies of the same set of file reads eventually would.
// Ported from the sibling CarShow app's carshow_boot_data() — keep the two in
// sync structurally; the actual per-event file set differs (no sponsors/
// walk-ins/dash-numbers here, but a flyer, which CarShow doesn't have).
function vettefest_boot_data($year) {
    $flyerFile = vettefest_show_file($year, 'flyer.json');
    $flyerRaw = ($flyerFile !== null && is_file($flyerFile)) ? json_decode(file_get_contents($flyerFile), true) : null;
    $flyerMeta = (is_array($flyerRaw) && !empty($flyerRaw['dataB64']))
        ? ['exists' => true, 'mime' => $flyerRaw['mime'] ?? 'application/octet-stream',
           'name' => $flyerRaw['name'] ?? 'flyer', 'uploadedAt' => $flyerRaw['uploadedAt'] ?? null]
        : ['exists' => false];

    $overridesFile = vettefest_show_file($year, 'registration-overrides.json');
    $overridesRaw = is_file($overridesFile) ? json_decode(file_get_contents($overridesFile), true) : [];

    $data = [
        'appSettings' => vettefest_read_settings($year),
        'flyer' => $flyerMeta,
        // Shipped in FILE order (oldest first, i.e. append order);
        // buildHistoryView() reverses it for display — don't sort here, or
        // that reverse() would flip it back to oldest-first.
        'importHistory' => vettefest_read_json_list(vettefest_show_file($year, 'import-history.json')),
        'deletedRegistrations' => vettefest_read_json_list(vettefest_show_file($year, 'deleted-registrations.json')),
        'registrationOverrides' => is_array($overridesRaw) ? $overridesRaw : [],
        'regCsv' => '',
        'actCsv' => '',
        'generatedAt' => 0,
        'hasRegistrations' => false,
    ];

    $regFile = vettefest_show_file($year, 'registrations-data.json');
    if (is_file($regFile)) {
        $reg = json_decode(file_get_contents($regFile), true);
        if (is_array($reg) && !empty($reg['regCsv'])) {
            $data['regCsv'] = (string)$reg['regCsv'];
            $data['actCsv'] = (string)($reg['actCsv'] ?? '');
            $data['generatedAt'] = (int)($reg['generatedAt'] ?? 0);
            $data['hasRegistrations'] = true;
        }
    }

    return $data;
}

// ---------------------------------------------------------------------------
// The per-event data files
// ---------------------------------------------------------------------------
// This list is the definition of "what belongs to an event". Auth state
// (password-reset.json / dev-password-reset.json) is global and deliberately
// absent — a password reset isn't an artifact of any one year's event.
function vettefest_show_files() {
    return [
        'registrations-data.json',
        'deleted-registrations.json',
        'registration-overrides.json',
        'app-settings.json',
        'flyer.json',
        'import-history.json',
        'import-request.json',
        'import-schedule-state.json',
        'import-run-status.json'
    ];
}

// ---------------------------------------------------------------------------
// Backups (Setup tab > Backups; see backup.php)
// ---------------------------------------------------------------------------
// Ported from the sibling CarShow app's own backup.php/lib.php pair — same
// mechanics, adapted to Vette Fest's own data shape (see vettefest_run_backup()
// below for exactly what that means). Shared here (rather than living only in
// backup.php) so import-schedule.php can call vettefest_backup_auto_check()
// from its own 'check' action without requiring the whole of backup.php
// (which would also execute that file's top-level action dispatch).

// Keep at most this many zip files on disk — see vettefest_backup_purge().
define('VETTEFEST_BACKUP_KEEP', 30);

// backups/ itself. Created on demand, deny-all like every other data
// directory in this app — defense in depth even though every caller already
// gates on vettefest_authed() before reaching any of this.
function vettefest_backups_dir() {
    $dir = __DIR__ . '/backups';
    if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) return null;
    $deny = $dir . '/.htaccess';
    if (!is_file($deny)) {
        @file_put_contents($deny,
            "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n" .
            "<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n");
    }
    return $dir;
}

function vettefest_backup_history_file() {
    $dir = vettefest_backups_dir();
    return $dir === null ? null : $dir . '/backup-history.json';
}

// Global (not per-year) auto-backup settings: { enabled, startDate, endDate,
// lastAutoRunDate }. Lives under data/ alongside shows.json — see
// vettefest_data_root() — since backups span every event year, not one.
function vettefest_backup_schedule_path() {
    $root = vettefest_data_root();
    return $root === null ? null : $root . '/backup-schedule.json';
}
function vettefest_read_backup_schedule() {
    $path = vettefest_backup_schedule_path();
    $raw = ($path !== null && is_file($path)) ? json_decode(file_get_contents($path), true) : null;
    $s = is_array($raw) ? $raw : [];
    return [
        'enabled' => !empty($s['enabled']),
        'startDate' => (string)($s['startDate'] ?? ''),
        'endDate' => (string)($s['endDate'] ?? ''),
        // Server-owned bookkeeping (see vettefest_backup_auto_check()) — a
        // save from the Setup tab must preserve this, never set it directly.
        'lastAutoRunDate' => (string)($s['lastAutoRunDate'] ?? ''),
    ];
}
function vettefest_write_backup_schedule($schedule) {
    $path = vettefest_backup_schedule_path();
    return $path === null ? false : vettefest_write_json($path, $schedule);
}

// Adds every file under $dir to $zip, recursively, nested under $zipPrefix
// inside the archive (so the whole data/ tree lands at "data/..." in the
// zip, exactly matching its layout on the server).
function vettefest_zip_add_dir($zip, $dir, $zipPrefix) {
    if (!is_dir($dir)) return;
    $items = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::LEAVES_ONLY
    );
    foreach ($items as $item) {
        $relative = substr($item->getPathname(), strlen($dir) + 1);
        $zipPath = str_replace('\\', '/', $zipPrefix . '/' . $relative);
        $zip->addFile($item->getPathname(), $zipPath);
    }
}

// Keeps only the newest $keep zip files on disk (oldest deleted first).
// max(1, ...) is a hard floor, independent of whatever VETTEFEST_BACKUP_KEEP
// happens to be set to: the most recent backup is NEVER deleted, so the
// server is never left with zero backups even if that constant were ever
// misconfigured to 0.
function vettefest_backup_purge($dir, $keep) {
    $keep = max(1, (int)$keep);
    $files = glob($dir . '/*.zip') ?: [];
    if (count($files) <= $keep) return;
    usort($files, function ($a, $b) { return filemtime($a) - filemtime($b); });
    foreach (array_slice($files, 0, count($files) - $keep) as $f) @unlink($f);
}

// How many backup zip files currently exist on disk — shared by
// vettefest_backup_purge() (via its own glob) and backup.php's 'delete'
// action, which uses this to refuse deleting the very last one (same "never
// leave zero backups" guarantee vettefest_backup_purge()'s max(1, ...) floor
// gives the automatic purge).
function vettefest_backup_zip_count($dir) {
    return count(glob($dir . '/*.zip') ?: []);
}

// Does the actual backup: zips the whole data/ tree (data/shows.json plus
// every data/<year>/ folder — registrations, overrides, app-settings, flyer,
// import history/schedule state, and the sync task's own per-run logs under
// data/<year>/logs/) and the two global root-level password-reset files that
// live outside data/ (see the comment on vettefest_show_files() for why
// those are global, not per-event). Deliberately EXCLUDES secrets.php and
// every other code file — same scope ftp-deploy.sh's own upload list
// excludes for the opposite reason (never overwrite live data with a stale
// local copy); this is a data backup, not a code backup. Unlike CarShow,
// there is no members-data.json, api-key.json or window-card-*.pdf here —
// Vette Fest has no member portal and no sponsorship feature.
function vettefest_run_backup() {
    $dir = vettefest_backups_dir();
    if ($dir === null) return ['ok' => false, 'error' => 'Could not create the backups directory.'];

    $fileName = gmdate('YmdHis') . '-VetteFestData.zip';
    $zipPath = $dir . '/' . $fileName;

    $zip = new ZipArchive();
    if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        return ['ok' => false, 'error' => 'Could not create the backup zip file.'];
    }

    $dataRoot = vettefest_data_root();
    if ($dataRoot !== null) vettefest_zip_add_dir($zip, $dataRoot, 'data');

    foreach (['password-reset.json', 'dev-password-reset.json'] as $name) {
        $path = __DIR__ . '/' . $name;
        if (is_file($path)) $zip->addFile($path, $name);
    }

    $numFiles = $zip->numFiles;
    $zip->close();

    if ($numFiles === 0) {
        @unlink($zipPath);
        return ['ok' => false, 'error' => 'Nothing to back up — no data files were found on the server.'];
    }

    vettefest_backup_purge($dir, VETTEFEST_BACKUP_KEEP);
    clearstatcache(true, $zipPath);
    return ['ok' => true, 'fileName' => $fileName, 'sizeBytes' => filesize($zipPath), 'fileCount' => $numFiles];
}

// Called from import-schedule.php's 'check' action, which is already polled
// every ~15 minutes by the Windows Task Scheduler task regardless of whether
// anyone has the app open in a browser — piggybacking on that existing
// heartbeat means a daily backup needs no scheduled task of its own. Runs at
// most once per calendar date (server's current default timezone — see
// import-schedule.php's date_default_timezone_set('America/New_York'), which
// is already in effect by the time this is called from there): the first
// poll on/after midnight that finds today's date not yet recorded, so "at
// midnight" in practice means within ~15 minutes after it, the same
// approximation the Import Schedule's own explicit times already make.
// Attempts exactly once per day regardless of outcome (lastAutoRunDate is set
// whether the run succeeded or failed) — a persistently failing backup (e.g.
// disk full) should surface once a day in the log, not spam a retry every 15
// minutes until fixed.
function vettefest_backup_auto_check() {
    $schedule = vettefest_read_backup_schedule();
    if (!$schedule['enabled']) return;
    $today = date('Y-m-d');
    if ($schedule['startDate'] !== '' && $today < $schedule['startDate']) return;
    if ($schedule['endDate'] !== '' && $today > $schedule['endDate']) return;
    if ($schedule['lastAutoRunDate'] === $today) return;

    $result = vettefest_run_backup();
    $entry = ['timestamp' => gmdate('c'), 'status' => $result['ok'] ? 'success' : 'failed', 'reason' => 'auto'];
    if ($result['ok']) {
        $entry['fileName'] = $result['fileName'];
        $entry['sizeBytes'] = $result['sizeBytes'];
        $entry['fileCount'] = $result['fileCount'];
    } else {
        $entry['error'] = $result['error'];
    }
    vettefest_append_json_list(vettefest_backup_history_file(), $entry);

    $schedule['lastAutoRunDate'] = $today;
    vettefest_write_backup_schedule($schedule);
}

// ---------------------------------------------------------------------------
// Backups > Restore (Setup tab; see backup.php's 'get_backup_years'/'restore')
// ---------------------------------------------------------------------------
// Ported from the sibling SilentAuctionManager app's restore_backup(), which
// deletes-and-reinserts SQL rows inside a transaction. There is no SQL here —
// this deletes-and-re-extracts the corresponding data/ subtree instead, the
// file-based equivalent of the same "make the live state match the backup"
// semantics, including SAM's choice that a WHOLE restore matches the backup
// EXACTLY (something live now that wasn't in the backup gets removed, not
// left alone) while a SCOPED restore only ever touches the one thing asked
// for.

// Same filename shape backup.php validates against (VETTEFEST_BACKUP_NAME_PATTERN),
// duplicated here as a plain regex rather than depending on backup.php's
// constant, so lib.php doesn't need backup.php loaded first to be safe to call.
function vettefest_backup_zip_path($backupDir, $fileName) {
    if (!preg_match('/^[0-9]{14}-VetteFestData\.zip$/', (string)$fileName)) return null;
    $path = $backupDir . '/' . $fileName;
    return is_file($path) ? $path : null;
}

// Like vettefest_write_json() (same locking discipline), but writes a raw
// string verbatim instead of json_encode()-ing a PHP value — restoring must
// reproduce the backup's bytes exactly, not re-serialize them (flyer.json's
// base64 image payload in particular must survive byte-for-byte).
function vettefest_write_raw($file, $content) {
    if ($file === null) return false;
    $fh = fopen($file, 'c+');
    if (!$fh || !flock($fh, LOCK_EX)) {
        if ($fh) fclose($fh);
        return false;
    }
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, $content);
    fflush($fh);
    flock($fh, LOCK_UN);
    fclose($fh);
    return true;
}

// Lists the distinct event years found inside one backup zip, with a display
// name/status pulled from the zip's OWN data/shows.json (if present) — so
// the Restore UI can offer real event names instead of bare year numbers,
// same idea as SAM's sam_backup_auction_ids(). A backup with no shows.json
// entry for a year that nonetheless has data/<year>/ files in it (shouldn't
// happen in practice — vettefest_run_backup() always includes the whole
// data/ tree together — but handled defensively) falls back to "Event
// <year>".
//
// A year can legitimately appear in shows.json with ZERO data/<year>/ files
// — an event created right before the backup was taken, before anything
// else was ever saved to it. That's still real, restorable data (the
// event's own name/status), not "nothing" — so it's listed here too
// (fileCount: 0), rather than silently vanishing from the Restore dropdown
// the way it did before this was noticed (a fresh event backed up
// immediately couldn't be restored, or even selected, at all).
function vettefest_backup_years_in_zip($backupDir, $fileName) {
    $path = vettefest_backup_zip_path($backupDir, $fileName);
    if ($path === null) return null;
    $zip = new ZipArchive();
    if ($zip->open($path) !== true) return null;

    $shows = [];
    $showsRaw = $zip->getFromName('data/shows.json');
    if ($showsRaw !== false) {
        $decoded = json_decode($showsRaw, true);
        if (is_array($decoded) && !empty($decoded['shows']) && is_array($decoded['shows'])) {
            foreach ($decoded['shows'] as $s) {
                if (is_array($s) && isset($s['year'])) $shows[(string)$s['year']] = $s;
            }
        }
    }

    $fileCounts = [];
    for ($i = 0; $i < $zip->numFiles; $i++) {
        $name = $zip->getNameIndex($i);
        if (preg_match('#^data/([0-9]{4})/#', $name, $m)) {
            $fileCounts[$m[1]] = ($fileCounts[$m[1]] ?? 0) + 1;
        }
    }
    $zip->close();

    // Union of "has files" and "has a shows.json row" — either alone is
    // enough to make a year worth offering.
    $allYears = $fileCounts;
    foreach ($shows as $year => $s) { if (!array_key_exists($year, $allYears)) $allYears[$year] = 0; }

    $years = [];
    foreach ($allYears as $year => $count) {
        $s = $shows[$year] ?? null;
        $years[] = [
            'year' => $year,
            'name' => ($s && !empty($s['name'])) ? (string)$s['name'] : ('Event ' . $year),
            'status' => $s ? (string)($s['status'] ?? '') : '',
            'fileCount' => $count,
        ];
    }
    usort($years, function ($a, $b) { return (int)$b['year'] - (int)$a['year']; });
    return $years;
}

// Restores the live data/ tree from one backup zip. $year === null restores
// EVERYTHING (every event year, data/shows.json, and the two global
// password-reset files) so the live tree matches the backup exactly —
// including deleting a year directory or global file that exists live now
// but wasn't in the backup. $year (already-validated by the caller) restores
// only that one event's data/<year>/ directory plus that one entry in
// data/shows.json — every other year, and the two global files, untouched.
//
// Every .json entry that's about to be written is decoded and validated
// FIRST, before anything on disk is touched — a corrupted or hand-edited
// backup aborts the whole restore with nothing changed, rather than leaving
// a half-restored data/ tree. A fresh whole-data safety backup is ALWAYS
// taken first, before either kind of restore, so a bad restore is itself
// always recoverable by restoring that safety snapshot.
function vettefest_restore_backup($backupDir, $fileName, $year = null) {
    $path = vettefest_backup_zip_path($backupDir, $fileName);
    if ($path === null) return ['ok' => false, 'error' => 'Backup file not found on disk — it may have aged past the retention limit.'];

    $zip = new ZipArchive();
    if ($zip->open($path) !== true) return ['ok' => false, 'error' => 'Could not open the backup zip file.'];

    $dataRoot = vettefest_data_root();
    if ($dataRoot === null) { $zip->close(); return ['ok' => false, 'error' => 'Could not access the data directory.']; }

    // Collect + validate every entry that will be WRITTEN to data/<year>/ or
    // the two global files. $writes: zip entry name (e.g. "data/2026/flyer.json"
    // or "password-reset.json") => raw bytes. Every entry lives directly
    // under __DIR__ once its 'data/' prefix (if any) is put back — that's
    // exactly how vettefest_run_backup() named them, so no path translation
    // is needed beyond __DIR__ . '/' . $name.
    //
    // "data/shows.json" is deliberately excluded from $writes for a SCOPED
    // restore — it must never be written wholesale (that would silently
    // overwrite every other event's registry row too) — but its content is
    // still needed afterward, just to read ONE year's row out of it for the
    // merge below. So it's captured separately into $showsJsonRaw,
    // regardless of scope, before the zip closes.
    $writes = [];
    $showsJsonRaw = null;
    $prefix = ($year !== null) ? ('data/' . $year . '/') : null;
    for ($i = 0; $i < $zip->numFiles; $i++) {
        $name = $zip->getNameIndex($i);
        $isShowsJson = ($name === 'data/shows.json');
        if ($prefix !== null && !$isShowsJson && strpos($name, $prefix) !== 0) continue; // scoped: only this year's files (+ shows.json, read-only)
        $content = $zip->getFromName($name);
        if ($content === false) { $zip->close(); return ['ok' => false, 'error' => "Could not read $name from the backup."]; }
        if (preg_match('/\.json$/i', $name) && json_decode($content) === null && trim($content) !== 'null') {
            $zip->close();
            return ['ok' => false, 'error' => "$name in the backup is not valid JSON — aborted, nothing was changed."];
        }
        if ($isShowsJson) { $showsJsonRaw = $content; if ($year !== null) continue; } // scoped: read-only, not written verbatim
        $writes[$name] = $content;
    }
    $zip->close();

    // A year with a real row in the backup's shows.json but zero actual
    // data files is a legitimate, meaningful thing to restore (its
    // name/status, from an event created right before that backup was
    // taken, before anything else was ever saved to it) — NOT the same as
    // "this year isn't in the backup at all". So the two are checked
    // together: only truly nothing (no files AND no registry row) fails.
    $backupEntry = null;
    if ($year !== null && $showsJsonRaw !== null) {
        $backupShows = json_decode($showsJsonRaw, true);
        if (is_array($backupShows) && !empty($backupShows['shows']) && is_array($backupShows['shows'])) {
            foreach ($backupShows['shows'] as $s) {
                if (is_array($s) && isset($s['year']) && (string)$s['year'] === $year) { $backupEntry = $s; break; }
            }
        }
    }
    if ($year !== null && empty($writes) && $backupEntry === null) {
        return ['ok' => false, 'error' => "This backup has no data, and no events-list entry, for event $year."];
    }

    // Safety net first, regardless of scope — cheap, and keeps the recovery
    // story identical either way: restore this file to undo whatever happens
    // next.
    $preRestore = vettefest_run_backup();
    if (empty($preRestore['ok'])) {
        return ['ok' => false, 'error' => 'Could not take a safety backup before restoring — aborted without changing anything. (' . ($preRestore['error'] ?? 'unknown error') . ')'];
    }

    $scopeName = 'Everything';

    if ($year === null) {
        // Whole restore: wipe every existing year directory, then delete any
        // global file the backup doesn't have — so the live tree ends up
        // matching the backup exactly, not a union of the two.
        foreach (glob($dataRoot . '/*', GLOB_ONLYDIR) ?: [] as $dir) {
            if (preg_match('#[\\\\/][0-9]{4}$#', $dir)) vettefest_rrmdir($dir);
        }
        $showsPath = vettefest_shows_path();
        if ($showsPath !== null && is_file($showsPath) && !array_key_exists('data/shows.json', $writes)) {
            @unlink($showsPath);
        }
        foreach (['password-reset.json', 'dev-password-reset.json'] as $rootFile) {
            if (!array_key_exists($rootFile, $writes)) {
                $target = __DIR__ . '/' . $rootFile;
                if (is_file($target)) @unlink($target);
            }
        }
    } else {
        // Scoped: only this year's directory is wiped/re-extracted. Its row
        // in shows.json is updated in place further below; nothing else in
        // shows.json, no other year, and neither global file is touched.
        $yearDir = $dataRoot . '/' . $year;
        if (is_dir($yearDir)) vettefest_rrmdir($yearDir);
        $scopeName = $year;
    }

    $filesWritten = 0;
    foreach ($writes as $name => $content) {
        $target = __DIR__ . '/' . $name;
        $dir = dirname($target);
        if (!is_dir($dir)) @mkdir($dir, 0755, true);
        if (!vettefest_write_raw($target, $content)) {
            return ['ok' => false, 'error' => "Could not write $name during restore. A pre-restore safety backup was taken first — see the Backups log.", 'preRestoreBackup' => $preRestore['fileName']];
        }
        $filesWritten++;
    }

    // Scoped restore: merge just this year's row into the LIVE shows.json
    // (replacing it if present, appending it if the live registry had
    // dropped it somehow) from the BACKUP's shows.json — every other year's
    // row, and 'current', stay exactly as they are live. Mirrors SAM
    // restoring just one auction's row in its 'auctions' table on a scoped
    // restore, not the whole table. $backupEntry was already resolved above
    // (needed there too, for the "nothing to restore" guard).
    if ($year !== null && $backupEntry !== null) {
        $registry = vettefest_read_shows();
        $found = false;
        foreach ($registry['shows'] as $idx => $s) {
            if (is_array($s) && isset($s['year']) && (string)$s['year'] === $year) {
                $registry['shows'][$idx] = $backupEntry;
                $found = true;
                break;
            }
        }
        if (!$found) $registry['shows'][] = $backupEntry;
        if (!vettefest_write_shows($registry)) {
            return ['ok' => false, 'error' => "Restored event $year's data, but could not update its entry in the events list. A pre-restore safety backup was taken first — see the Backups log.", 'preRestoreBackup' => $preRestore['fileName']];
        }
        $scopeName = (string)($backupEntry['name'] ?? $year);
    }

    return [
        'ok' => true,
        'scope' => $year !== null ? $year : 'all',
        'scopeName' => $scopeName,
        'filesWritten' => $filesWritten,
        'preRestoreBackup' => $preRestore['fileName'],
    ];
}

// Recursive delete — used only by vettefest_restore_backup() above, to wipe
// a year's directory (which now legitimately holds a subdirectory,
// data/<year>/logs/, unlike the flat single-level layout
// vettefest_show_files() still assumes for shows.php's own event-delete
// action — see that function's comment). Safe here because the only paths
// ever passed in are ones this same function derived from $dataRoot/<year>,
// never anything caller-supplied directly.
function vettefest_rrmdir($dir) {
    if (!is_dir($dir)) return;
    $items = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($items as $item) {
        if ($item->isDir()) { @rmdir($item->getPathname()); } else { @unlink($item->getPathname()); }
    }
    @rmdir($dir);
}
