<?php
// Per-event event flyer: GET serves the stored flyer file (image or PDF) for
// the open year; POST (multipart) stores a freshly uploaded one. Same
// pattern as registrations-import.php — session-gated by index.php's login,
// scoped to whichever year the session currently has open, and read back
// fresh by index.php on the next page load (no build/redeploy to swap it).
//
// The flyer is NOT registrant PII — it's the public marketing flyer — but
// it's still stored as base64 inside data/<year>/flyer.json so it lives
// under the same .htaccess *.json deny rule as everything else in data/;
// this endpoint is the only way to read it back out.
session_start();
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

require __DIR__ . '/secrets.php';
require __DIR__ . '/lib.php';

if (empty($_SESSION['vettefest_authenticated'])) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Not logged in.']);
    exit;
}

$year = vettefest_valid_year($_SESSION['vettefest_year'] ?? '');
if ($year === null) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'No event open.']);
    exit;
}

$FLYER_FILE = vettefest_show_file($year, 'flyer.json');

// Allowed upload types -> canonical file extension.
$ALLOWED = [
    'image/jpeg'      => 'jpg',
    'image/png'       => 'png',
    'image/gif'       => 'gif',
    'image/webp'      => 'webp',
    'application/pdf' => 'pdf',
];
$MAX_BYTES = 12 * 1024 * 1024; // 12 MB

// ---------------------------------------------------------------------------
// POST: store an uploaded flyer
// ---------------------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json');
    $up = $_FILES['flyer'] ?? null;
    if (!$up || $up['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($up['tmp_name'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Upload failed — choose a file and try again.']);
        exit;
    }
    if ($up['size'] > $MAX_BYTES) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'That file is larger than 12 MB.']);
        exit;
    }
    // Trust the actual file contents, not the browser-supplied type.
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($up['tmp_name']);
    if (!isset($ALLOWED[$mime])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Only JPG, PNG, GIF, WebP or PDF files are accepted.']);
        exit;
    }
    $bytes = file_get_contents($up['tmp_name']);
    if ($bytes === false || $bytes === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'That file looks empty.']);
        exit;
    }
    $name = 'flyer.' . $ALLOWED[$mime];
    $data = [
        'mime'       => $mime,
        'name'       => $name,
        'dataB64'    => base64_encode($bytes),
        'uploadedAt' => gmdate('c'),
    ];
    if (!vettefest_write_json($FLYER_FILE, $data)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Could not save the flyer — please try again.']);
        exit;
    }
    echo json_encode([
        'success' => true,
        'flyer'   => ['mime' => $mime, 'name' => $name, 'uploadedAt' => $data['uploadedAt']],
    ]);
    exit;
}

// ---------------------------------------------------------------------------
// GET: serve the stored flyer (for the Setup tab's preview link and the
// Reports tab's Print Flyer). ?meta=1 returns just the JSON metadata.
// ---------------------------------------------------------------------------
$stored = ($FLYER_FILE !== null && is_file($FLYER_FILE))
    ? json_decode(file_get_contents($FLYER_FILE), true) : null;

if (isset($_GET['meta'])) {
    header('Content-Type: application/json');
    if (!is_array($stored) || empty($stored['dataB64'])) {
        echo json_encode(['exists' => false]);
        exit;
    }
    echo json_encode([
        'exists'     => true,
        'mime'       => $stored['mime'] ?? 'application/octet-stream',
        'name'       => $stored['name'] ?? 'flyer',
        'uploadedAt' => $stored['uploadedAt'] ?? null,
    ]);
    exit;
}

if (!is_array($stored) || empty($stored['dataB64'])) {
    http_response_code(404);
    header('Content-Type: text/plain');
    echo 'No flyer has been uploaded for this event yet.';
    exit;
}

$bytes = base64_decode($stored['dataB64'], true);
if ($bytes === false) {
    http_response_code(500);
    header('Content-Type: text/plain');
    echo 'The stored flyer could not be decoded.';
    exit;
}
header('Content-Type: ' . ($stored['mime'] ?? 'application/octet-stream'));
header('Content-Disposition: inline; filename="' . ($stored['name'] ?? 'flyer') . '"');
header('Content-Length: ' . strlen($bytes));
echo $bytes;
