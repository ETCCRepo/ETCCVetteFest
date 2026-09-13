<?php
// Bridges the Setup tab's Import Schedule UI (Event URL, the auto-import
// enable/times/date-range settings, and the "Import Now" button) to the
// actual automation — which is a Claude Code scheduled task running on an
// officer's own machine, driving their real Chrome through ClubExpress. This
// endpoint cannot run a browser itself; it only leaves/reads a signal that
// task polls every few minutes. Ported from the sibling CarShow app's
// import-schedule.php — keep the two in sync.
//
// eventUrl / autoImportEnabled / autoImportTimes / autoImportIntervalHours /
// autoImportStartDate / autoImportEndDate themselves live in app-settings.json
// (see lib.php's vettefest_settings_defaults()) — this file only handles the
// "Import Now" request flag (import-request.json) and the "has this
// slot/request already run" bookkeeping (import-schedule-state.json), both
// per-event, plus the actual should-it-run-right-now decision.
//
// Actions:
//   request     (browser, PHP-session auth)        — officer clicked "Import Now".
//   status      (browser, PHP-session-or-password) — has my pending request been handled yet?
//   check       (script, site-password auth)       — "is there anything to run now?"
//   mark_start  (script, site-password auth)       — "I'm starting a run now, for this reason."
//   mark_run    (script, site-password auth)       — "I just ran it for this reason" (completion).
//   run_status  (browser or script, session-or-password) — persisted last-run status (see
//               import-run-status.json) for the Setup tab's always-visible "Last run" line —
//               separate from 'status' above, which is scoped to one specific Import Now click.
session_start();
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Content-Type: application/json');

require __DIR__ . '/secrets.php';
require __DIR__ . '/lib.php';

// Matches ClubExpress's own displayed event timezone, so an officer typing
// "9:00 AM" in the Setup tab means the same 9:00 AM the scheduled task acts on.
date_default_timezone_set('America/New_York');

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) $input = [];

$action = (string)($input['action'] ?? '');
$year = vettefest_valid_year($_GET['year'] ?? ($input['year'] ?? ''));
if ($year === null) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Missing or invalid event year.']);
    exit;
}

$requestFile = vettefest_show_file($year, 'import-request.json');
$stateFile = vettefest_show_file($year, 'import-schedule-state.json');
$runStatusFile = vettefest_show_file($year, 'import-run-status.json');
if ($requestFile === null || $stateFile === null || $runStatusFile === null) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Could not open the data directory for ' . $year . '.']);
    exit;
}

if ($action === 'request') {
    // Same-origin button click — the PHP session is the only auth this
    // needs, same as every other Setup-tab officer action.
    if (empty($_SESSION['vettefest_authenticated'])) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Please log in first.']);
        exit;
    }
    $now = gmdate('c');
    if (!vettefest_write_json($requestFile, ['requestedAt' => $now, 'handledAt' => null, 'lastStatus' => null, 'lastError' => null])) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Could not save the request.']);
        exit;
    }
    echo json_encode(['ok' => true, 'requestedAt' => $now]);
    exit;
}

// 'check' and 'mark_run' are called by the scheduled-task script (no PHP
// session exists for a standalone script, so these need the site password);
// 'status' is polled by the browser, which already has a session from being
// logged into the app — vettefest_authed() accepts either.
if ($action === 'check' || $action === 'mark_run' || $action === 'mark_start' || $action === 'status' || $action === 'run_status') {
    if (!vettefest_authed($PASSWORD_HASH, $input['password'] ?? '')) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Incorrect password.']);
        exit;
    }
} else {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Unknown action.']);
    exit;
}

$settingsFile = vettefest_show_file($year, 'app-settings.json');
$settingsRaw = is_file($settingsFile) ? json_decode(file_get_contents($settingsFile), true) : [];
$settings = is_array($settingsRaw) ? $settingsRaw : [];
$eventUrl = (string)($settings['eventUrl'] ?? '');
$autoImportEnabled = !empty($settings['autoImportEnabled']);
$autoImportTimes = is_array($settings['autoImportTimes'] ?? null) ? $settings['autoImportTimes'] : [];
$autoImportIntervalHours = (int)($settings['autoImportIntervalHours'] ?? 0);
$startDate = (string)($settings['autoImportStartDate'] ?? '');
$endDate = (string)($settings['autoImportEndDate'] ?? '');

$request = is_file($requestFile) ? json_decode(file_get_contents($requestFile), true) : null;
// Pending = a request exists and hasn't been handled since it was made (a
// fresh "Import Now" click after an old one was already handled counts as a
// new pending request, since requestedAt moves forward each click).
$pending = is_array($request) && !empty($request['requestedAt'])
    && (empty($request['handledAt']) || strtotime($request['handledAt']) < strtotime($request['requestedAt']));

if ($action === 'status') {
    // Lets the Setup tab poll after an Import Now click to flip its own
    // status text from "Requested…" to "Succeeded at <time>" / "Failed at
    // <time>: <error>" once the scheduled task actually picks it up and
    // calls mark_run with its outcome — see requestImportNow()/
    // startImportRequestPolling() in app.js.
    echo json_encode([
        'ok' => true,
        'requestedAt' => is_array($request) ? ($request['requestedAt'] ?? null) : null,
        'handledAt' => is_array($request) ? ($request['handledAt'] ?? null) : null,
        'lastStatus' => is_array($request) ? ($request['lastStatus'] ?? null) : null,
        'lastError' => is_array($request) ? ($request['lastError'] ?? null) : null,
    ]);
    exit;
}

if ($action === 'run_status') {
    // Always-visible "Last run" line in the Setup tab — a single persisted
    // record covering whichever run happened most recently, regardless of
    // whether it was a manual Import Now or a scheduled slot, and surviving
    // page reloads (unlike the 'status' action above, which only tracks one
    // specific pending Import Now request).
    $runStatus = is_file($runStatusFile) ? json_decode(file_get_contents($runStatusFile), true) : null;
    echo json_encode(['ok' => true, 'runStatus' => is_array($runStatus) ? $runStatus : null]);
    exit;
}

if ($action === 'mark_start') {
    // Called right before the scheduled task invokes ETCCVetteFestImportData —
    // lets the Setup tab show "Import started at <time>" immediately, rather
    // than only ever finding out a run happened after it's already done.
    $reason = (string)($input['reason'] ?? '');
    vettefest_write_json($runStatusFile, [
        'startedAt' => gmdate('c'),
        'reason' => $reason,
        'completedAt' => null,
        'status' => null,
        'error' => null,
        'logFile' => null,
    ]);
    echo json_encode(['ok' => true]);
    exit;
}

if ($action === 'check') {
    $shouldRun = false;
    $reason = 'none';
    $today = date('Y-m-d');

    // Piggyback the auto-backup schedule on this same poll — see that
    // function's own comment in lib.php for why. Unrelated to imports and
    // not year-scoped (backups span every event), so this runs regardless of
    // which $year's check endpoint happened to be hit, and is a no-op once
    // today's backup has already run.
    vettefest_backup_auto_check();

    if ($pending) {
        $shouldRun = true;
        $reason = 'manual';
    } elseif ($autoImportEnabled && ($autoImportTimes || $autoImportIntervalHours > 0)
        && ($startDate === '' || $today >= $startDate)
        && ($endDate === '' || $today <= $endDate)) {
        $nowMinutes = ((int)date('H')) * 60 + (int)date('i');

        $stateRaw = is_file($stateFile) ? json_decode(file_get_contents($stateFile), true) : [];
        $state = is_array($stateRaw) ? $stateRaw : [];
        $ranSlots = ($state['date'] ?? '') === $today && is_array($state['ranSlots'] ?? null) ? $state['ranSlots'] : [];

        // Explicit times and the "every N hours, on the hour" interval are
        // both active at once if both are set — union them into one slot
        // list (deduped) rather than treating the interval as mutually
        // exclusive, so an officer can e.g. set an explicit 9:00 AM plus
        // "every 3 hours" without one silently overriding the other.
        $slots = $autoImportTimes;
        if ($autoImportIntervalHours > 0 && $autoImportIntervalHours <= 23) {
            for ($h = 0; $h < 24; $h += $autoImportIntervalHours) {
                $slots[] = sprintf('%02d:00', $h);
            }
        }
        $slots = array_values(array_unique($slots));

        foreach ($slots as $t) {
            if (!preg_match('/^([0-2][0-9]):([0-5][0-9])$/', (string)$t, $m)) continue;
            $slotMinutes = ((int)$m[1]) * 60 + (int)$m[2];
            // Tolerance wider than the poll interval itself, to absorb the
            // scheduled task's own start-time jitter.
            if (abs($nowMinutes - $slotMinutes) <= 6 && !in_array($t, $ranSlots, true)) {
                $shouldRun = true;
                $reason = 'scheduled:' . $t;
                break;
            }
        }
    }

    echo json_encode(['ok' => true, 'shouldRun' => $shouldRun, 'reason' => $reason, 'eventUrl' => $eventUrl]);
    exit;
}

// mark_run — records that a run just happened for the given reason (so the
// next poll doesn't fire it again — a handled manual request, or today's
// slot) AND its outcome (status: "success"|"failed", optional error — shown
// by the Setup tab's Import Now status text via the 'status' action above).
$reason = (string)($input['reason'] ?? '');
$status = (string)($input['status'] ?? 'success');
if ($status !== 'success' && $status !== 'failed') $status = 'success';
$error = (string)($input['error'] ?? '');
$logFile = (string)($input['logFile'] ?? '');

if ($reason === 'manual') {
    if (is_array($request)) {
        $request['handledAt'] = gmdate('c');
        $request['lastStatus'] = $status;
        $request['lastError'] = $status === 'failed' ? $error : '';
        vettefest_write_json($requestFile, $request);
    }
} elseif (strpos($reason, 'scheduled:') === 0) {
    $slot = substr($reason, strlen('scheduled:'));
    $today = date('Y-m-d');
    $stateRaw = is_file($stateFile) ? json_decode(file_get_contents($stateFile), true) : [];
    $state = is_array($stateRaw) ? $stateRaw : [];
    $ranSlots = ($state['date'] ?? '') === $today && is_array($state['ranSlots'] ?? null) ? $state['ranSlots'] : [];
    if (!in_array($slot, $ranSlots, true)) $ranSlots[] = $slot;
    vettefest_write_json($stateFile, ['date' => $today, 'ranSlots' => $ranSlots]);
} else {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Unknown reason.']);
    exit;
}

// Complete the same persisted "Last run" record mark_start began (or, if
// mark_start was never called for this run — e.g. an older skill version, or
// a direct manual run outside the schedule flow — start a fresh one here so
// the Setup tab still has a completion to show, just with no start time).
$runStatusRaw = is_file($runStatusFile) ? json_decode(file_get_contents($runStatusFile), true) : null;
$runStatus = is_array($runStatusRaw) ? $runStatusRaw : ['startedAt' => null, 'reason' => $reason];
$runStatus['completedAt'] = gmdate('c');
$runStatus['status'] = $status;
$runStatus['error'] = $status === 'failed' ? $error : '';
$runStatus['logFile'] = $logFile;
vettefest_write_json($runStatusFile, $runStatus);

// Log every ATTEMPT to the History tab, not just successes — a failed run
// (e.g. ClubExpress not logged in) never reaches registrations-upload.php's
// own on-success history append, so without this a failed Import Now or
// scheduled slot would leave no trace at all in the app. A successful run
// already gets logged by registrations-upload.php itself (source: cli,
// outcome: success) once the upload actually completes, so only log here on
// failure — otherwise a success would show up twice.
if ($status === 'failed') {
    vettefest_append_json_list(vettefest_show_file($year, 'import-history.json'), [
        'timestamp' => gmdate('c'),
        'regRows' => null,
        'actRows' => null,
        'source' => 'cli',
        'eventUrl' => $eventUrl,
        'outcome' => 'failed',
        'error' => $error,
        'reason' => $reason,
        'logFile' => $logFile,
    ]);
}

echo json_encode(['ok' => true]);
