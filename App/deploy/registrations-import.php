<?php
// Officer-only page to upload a fresh Registration Data / Activity Registrant
// Data CSV pair (see AUTOPULL-NOTES.md and README.md for where these come
// from — ClubExpress's Event Exports dialog) straight into
// registrations-data.json (gitignored, contains PII), the same file
// registrations-upload.php writes. index.php reads this file fresh on every
// request, so an upload here is live for the very next page load — no
// node build.js / ftp-deploy.sh cycle needed just to refresh data.
//
// This is the browser-based sibling of registrations-upload.php (which is
// meant for deploy/upload-registrations.js's automated CLI flow) — same
// destination file, same shape, just a form instead of a script + password
// env var. Gated by the same PHP session as index.php, same pattern as
// members-import.php.
session_start();
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

require __DIR__ . '/secrets.php';
require __DIR__ . '/lib.php';

if (empty($_SESSION['vettefest_authenticated'])) {
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><meta charset="utf-8"><body style="font:15px sans-serif;padding:40px;text-align:center">' .
        '<p>Please <a href="index.php">log in</a> first.</p></body>';
    exit;
}

// Imports into the event the officer currently has open (index.php puts the
// selected year in the session). Without one there is nothing to import
// into — bounce back rather than guessing a year.
$year = vettefest_valid_year($_SESSION['vettefest_year'] ?? '');
if ($year === null) {
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><meta charset="utf-8"><body style="font:15px sans-serif;padding:40px;text-align:center">' .
        '<p>Open a Vette Fest event first, then try the import again.</p>' .
        '<p><a href="index.php">Back to the app</a></p></body>';
    exit;
}
$REG_FILE = vettefest_show_file($year, 'registrations-data.json');
$errors = [];
$imported = null; // ['regRows' => int, 'actRows' => int] on success

function csvDataRowCount($tmpName) {
    $lines = file($tmpName);
    if (!$lines) return 0;
    // Header line doesn't count as a data row; blank trailing lines don't either.
    $count = 0;
    foreach (array_slice($lines, 1) as $line) {
        if (trim($line) !== '') $count++;
    }
    return $count;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['reg_csv'])) {
    $regFile = $_FILES['reg_csv'];
    $actFile = $_FILES['act_csv'] ?? null;
    if ($regFile['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($regFile['tmp_name'])) {
        $errors[] = 'Registration Data upload failed — choose a CSV file and try again.';
    } elseif ($actFile && $actFile['error'] !== UPLOAD_ERR_OK && $actFile['error'] !== UPLOAD_ERR_NO_FILE) {
        $errors[] = 'Activity Registrant Data upload failed — choose a CSV file and try again.';
    } else {
        $regCsv = file_get_contents($regFile['tmp_name']);
        $actCsv = ($actFile && $actFile['error'] === UPLOAD_ERR_OK && is_uploaded_file($actFile['tmp_name']))
            ? file_get_contents($actFile['tmp_name']) : '';
        if (trim((string)$regCsv) === '') {
            $errors[] = 'That Registration Data file looks empty.';
        } else {
            $regRows = csvDataRowCount($regFile['tmp_name']);
            $actRows = $actCsv !== '' ? csvDataRowCount($actFile['tmp_name']) : 0;
            $data = [
                'regCsv' => $regCsv,
                'actCsv' => $actCsv,
                'generatedAt' => (int)(microtime(true) * 1000),
                'uploadedAt' => gmdate('c'),
            ];
            if (vettefest_write_json($REG_FILE, $data)) {
                $imported = ['regRows' => $regRows, 'actRows' => $actRows];
            } else {
                $errors[] = 'Could not save the registration data — please try again.';
            }
        }
    }
}

$current = is_file($REG_FILE) ? json_decode(file_get_contents($REG_FILE), true) : null;
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ETCC Vette Fest — Import Registrations</title>
<link rel="icon" type="image/png" href="ETCClogoWhiteBackground.png">
<link rel="apple-touch-icon" href="ETCClogoWhiteBackground.png">
<style>
  :root { --red:#b0141e; --red-dark:#7d0e15; --ink:#1a1a1a; --muted:#667085; --line:#e3e6ea; --bg:#f4f6f8; --panel:#fff; --good:#147d3a; }
  * { box-sizing: border-box; }
  body { font: 15px/1.5 "Segoe UI", Arial, sans-serif; color: var(--ink); background: var(--bg); margin:0; padding: 28px 16px 60px; }
  .wrap { max-width: 560px; margin: 0 auto; }
  h1 { font-size: 20px; text-align: center; margin: 0 0 2px; }
  .sub { text-align:center; color:var(--muted); font-size:13px; margin-bottom:22px; }
  .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 22px 24px; }
  .form-row { margin: 14px 0; }
  label { display:block; font-weight:600; font-size:13px; margin-bottom:4px; }
  input[type=file] { width:100%; padding:9px 10px; border:1px solid var(--line); border-radius:7px; font-size:14px; font-family:inherit; background:#fff; }
  .btn { background: var(--red); border: 1px solid var(--red-dark); color:#fff; padding: 11px 18px; border-radius:8px; font-size:15px; font-weight:700; cursor:pointer; width:100%; margin-top:6px; }
  .btn:hover { background: var(--red-dark); }
  .errors { background:#fff5f5; border-left:4px solid var(--red); border-radius:6px; padding:10px 14px; margin-bottom:14px; color:var(--red-dark); font-size:13px; }
  .errors ul { margin:4px 0 0; padding-left:18px; }
  .success { background:#f2fbf5; border:1px solid #bfe2c9; border-radius:8px; padding:12px 14px; margin-bottom:14px; color: var(--good); font-weight:600; font-size:14px; }
  .count { color: var(--muted); font-size:13px; margin-bottom: 14px; }
  .back { display:block; text-align:center; margin-top:18px; color: var(--muted); font-size:13px; }
  .title-row { display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom:2px; }
  .title-row h1 { margin:0; }
  .instructions-btn {
    background:#fff; border:1px solid var(--line); color: var(--muted); width:24px; height:24px;
    border-radius:50%; font-size:13px; font-weight:700; line-height:1; cursor:pointer; padding:0;
    display:inline-flex; align-items:center; justify-content:center; flex:none;
  }
  .instructions-btn:hover { background:#f4f6f8; color: var(--ink); }
  .modal-backdrop {
    display:none; position:fixed; inset:0; background:rgba(20,20,20,.45); z-index:50;
    align-items:center; justify-content:center; padding:20px;
  }
  .modal-backdrop.open { display:flex; }
  .modal {
    background:#fff; border-radius:12px; max-width:440px; width:100%; padding:24px 26px;
    box-shadow:0 12px 40px rgba(0,0,0,.25); max-height:85vh; overflow-y:auto;
  }
  .modal h2 { font-size:17px; margin:0 0 4px; }
  .modal .modal-sub { color: var(--muted); font-size:13px; margin:0 0 16px; }
  .modal ol { margin:0; padding-left:22px; font-size:14px; line-height:1.7; }
  .modal ol li { margin-bottom:2px; }
  .modal .filename { font-family: ui-monospace, Consolas, monospace; background:#f4f6f8; padding:1px 6px; border-radius:4px; font-size:13px; }
  .modal-close { background: var(--red); border:1px solid var(--red-dark); color:#fff; padding:9px 16px; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer; width:100%; margin-top:18px; }
  .modal-close:hover { background: var(--red-dark); }
</style>
</head>
<body>
<div class="wrap">
  <div class="title-row">
    <h1>Import Registrations</h1>
    <button type="button" class="instructions-btn" title="How to get these files from ClubExpress" onclick="document.getElementById('instructionsModal').classList.add('open')">?</button>
  </div>
  <div class="sub">Loads a fresh Registration Data / Activity Registrant Data CSV pair from ClubExpress</div>
  <div class="panel">
    <?php if ($imported !== null): ?>
      <div class="success">Imported <?php echo $imported['regRows']; ?> registration row<?php echo $imported['regRows'] === 1 ? '' : 's'; ?>
        and <?php echo $imported['actRows']; ?> activity row<?php echo $imported['actRows'] === 1 ? '' : 's'; ?>.</div>
    <?php endif; ?>
    <?php if ($errors): ?>
      <div class="errors"><strong>Please fix the following:</strong><ul>
        <?php foreach ($errors as $e) echo '<li>' . htmlspecialchars($e) . '</li>'; ?>
      </ul></div>
    <?php endif; ?>
    <?php if (is_array($current) && !empty($current['uploadedAt'])): ?>
      <div class="count">Current data was uploaded <?php echo htmlspecialchars($current['uploadedAt']); ?>.</div>
    <?php endif; ?>
    <form method="post" enctype="multipart/form-data">
      <div class="form-row">
        <label for="f-reg">Registration Data CSV</label>
        <input type="file" id="f-reg" name="reg_csv" accept=".csv" required>
      </div>
      <div class="form-row">
        <label for="f-act">Activity Registrant Data CSV (optional)</label>
        <input type="file" id="f-act" name="act_csv" accept=".csv">
      </div>
      <button type="submit" class="btn">Import</button>
    </form>
  </div>
  <a class="back" href="index.php">&larr; Back to the app</a>
</div>

<div class="modal-backdrop" id="instructionsModal" onclick="if(event.target===this) this.classList.remove('open')">
  <div class="modal">
    <h2>Getting the two files from ClubExpress</h2>
    <p class="modal-sub">Do this twice — once for each export below — then upload both files here.</p>
    <ol>
      <li>Select the Event</li>
      <li>Admin Options</li>
      <li>Exports</li>
      <li>Registration Data</li>
      <li>Export</li>
      <li>Save as <span class="filename">registration_data.csv</span></li>
      <li>Exports</li>
      <li>Activity Registrant Data</li>
      <li>Export</li>
      <li>Save as <span class="filename">activity_registrant_data.csv</span></li>
    </ol>
    <button type="button" class="modal-close" onclick="document.getElementById('instructionsModal').classList.remove('open')">Got it</button>
  </div>
</div>
</body>
</html>
