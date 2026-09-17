<?php
// Copy this file to secrets.php (gitignored) and fill in the real values.
// $PASSWORD_HASH: generate with
//   openssl passwd -6 -salt "$(openssl rand -hex 8)" 'the-actual-password'
$PASSWORD_HASH = '$6$replace-with-real-salt$replaceWithRealHashXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.';

// Optional SECOND site password — either this or $PASSWORD_HASH above logs in
// (see vettefest_password_hashes() in lib.php). Leave this line commented out
// / $PASSWORD_HASH_2 unset to accept only $PASSWORD_HASH, as before this
// existed.
// $PASSWORD_HASH_2 = '$6$replace-with-real-salt$replaceWithRealHashXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.';

// Separate "Developer" password (app.js's Developer Login screen, hamburger
// menu > 🛠 Developer) — a distinct credential from $PASSWORD_HASH above.
// Same generation command, different password. If left empty/unset, the
// Developer prompt always rejects (see index.php's action=dev_login check).
$DEV_PASSWORD_HASH = '$6$replace-with-real-salt$replaceWithRealHashXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.';

// Separate, fixed token used ONLY by sync-registrations.js's
// reportStartupFailure() (see logs.php's 'report_failure' action) — a
// deliberately different credential from $PASSWORD_HASH above, so a broken
// or missing VETTEFEST_SITE_PASSWORD on the import machine can still get a
// failure line onto the Setup tab's View Logs list instead of vanishing
// into a log file that only ever existed on that machine. Generate with
//   openssl rand -hex 24
// and set the SAME value as VETTEFEST_HEARTBEAT_TOKEN in that machine's
// scheduled task environment. Leave empty to disable this reporting path
// entirely (logs.php rejects every report_failure call while it's empty).
$HEARTBEAT_TOKEN = '';

// SMTP credentials used by forgot-password.php (via vettefest_send_mail() in
// lib.php) to send the reset email reliably — PHP's raw mail() was observed
// silently failing to deliver to Gmail from this Hostinger account (no
// SPF/DKIM behind it). A mailbox created in hPanel > Emails works; port 465
// is implicit TLS, 587 is STARTTLS.
$SMTP_HOST = 'smtp.hostinger.com';
$SMTP_PORT = 465;
$SMTP_USER = 'replace-with-real-mailbox@etccapps.com';
$SMTP_PASS = 'replace-with-real-mailbox-password';
$SMTP_FROM = 'replace-with-real-mailbox@etccapps.com';
