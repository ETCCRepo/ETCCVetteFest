<?php
// Shared helpers for the deploy/ PHP endpoints (index.php, shows.php,
// app-settings.php, deleted-registrations.php, registration-overrides.php,
// registrations-upload.php, registrations-import.php,
// send-tshirt-order-email.php). Centralizes the auth check, lock-guarded
// JSON read/write, safe-inline-script embedding, SMTP sending, and the
// per-event data paths that would otherwise be copy-pasted across all of them.

// True if either the current PHP session is already authenticated (the
// normal case for same-origin calls made from the hosted page itself, e.g.
// a detail-modal edit saved while logged in) or the request supplied a
// password matching secrets.php's hash (the normal case for calls with no
// shared session, e.g. upload-registrations.js's automated CSV push).
function vettefest_authed($passwordHash, $providedPassword) {
    if (!empty($_SESSION['vettefest_authenticated'])) return true;
    $pw = (string)$providedPassword;
    return $pw !== '' && hash_equals($passwordHash, crypt($pw, $passwordHash));
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
function vettefest_record_import_history($year, $regRows, $actRows) {
    $file = vettefest_show_file($year, 'import-history.json');
    if ($file === null) return false;
    return vettefest_append_json_list($file, [
        'importedAt' => gmdate('c'),
        'regRows' => (int)$regRows,
        'actRows' => (int)$actRows,
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
        'import-history.json'
    ];
}
