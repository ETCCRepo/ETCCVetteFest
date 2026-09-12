# Registers (or re-registers) the Windows scheduled task that runs the Vette
# Fest import loop -- the replacement for the Claude Code scheduled task
# `vettefest-sync-registrations`. Run once per machine, from an elevated or
# ordinary PowerShell prompt:
#
#   powershell -ExecutionPolicy Bypass -File deploy\install-scheduled-task.ps1
#
# Switches:
#   -Interactive       run only while the user is logged on, in a visible
#                      session. Use this if the default S4U principal cannot
#                      drive Chrome on your machine.
#   -IntervalMinutes N poll interval (default 15, matching the old task).
#   -Uninstall         remove the task.
#
# Principal, by default: S4U ("run whether the user is logged on or not",
# WITHOUT storing a password). Three things make that work here --
#   * the Exports folder is on Z:, a LOCAL NTFS volume, so no drive mapping or
#     network credential is needed;
#   * the only network access is plain HTTPS to etccapps.com and
#     etccwebsite.com, which needs no Windows identity;
#   * Chrome runs headless, so it needs no desktop.
# The payoff is no console window flashing on screen every 15 minutes, and
# imports that keep running after the officer logs off.
#
#   -UserId DOMAIN\name  the account the task RUNS AS (default: whoever runs
#                      this script). Needed when UAC elevates you into a
#                      different admin account than the one that owns the
#                      ClubExpress profile and VETTEFEST_SITE_PASSWORD -- the
#                      task must run as THAT account, or it finds neither.
#                      e.g. from an elevated "user" window:
#                        -UserId NBKFF3A-BEELINK\Admin
[CmdletBinding()]
param(
  [switch]$Interactive,
  [int]$IntervalMinutes = 15,
  [string]$UserId = "$env:USERDOMAIN\$env:USERNAME",
  [switch]$Uninstall
)

$ErrorActionPreference = "Stop"

$TaskName = "vettefest-sync-registrations"
$AppDir = Split-Path -Parent $PSScriptRoot            # ...\VetteFest\App
$Script = Join-Path $PSScriptRoot "sync-registrations.js"
$NodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source

if ($Uninstall) {
  if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Removed scheduled task '$TaskName'."
  } else {
    Write-Host "No scheduled task named '$TaskName' to remove."
  }
  return
}

# ---- preflight: fail here rather than silently every 15 minutes forever -----
if (-not $NodeExe) { throw "node.exe is not on PATH. Install Node.js first." }
if (-not (Test-Path $Script)) { throw "Cannot find $Script" }
if (-not (Test-Path (Join-Path $AppDir "node_modules\playwright-core"))) {
  throw "playwright-core is not installed. Run 'npm install' in $AppDir first."
}
# Check the TARGET account's environment and profile, not the account running
# this script -- when UAC elevates into a different admin, [Environment]'s
# "User" scope is the wrong person's registry hive.
try {
  $sid = (New-Object System.Security.Principal.NTAccount($UserId)).Translate(
    [System.Security.Principal.SecurityIdentifier]).Value
} catch {
  throw "Unknown account '$UserId'. Pass -UserId DOMAIN\name for the account that owns the ClubExpress profile."
}
$targetPw = $null
if (Test-Path "Registry::HKEY_USERS\$sid\Environment") {
  $targetPw = (Get-ItemProperty "Registry::HKEY_USERS\$sid\Environment" -ErrorAction SilentlyContinue).VETTEFEST_SITE_PASSWORD
}
if (-not $targetPw) {
  throw "VETTEFEST_SITE_PASSWORD is not set as a persistent user environment variable for $UserId (or that account is not signed in, so its registry hive isn't loaded). Set it while signed in as $UserId, then re-run."
}
$profileRoot = (Get-ItemProperty "Registry::HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList\$sid" -ErrorAction SilentlyContinue).ProfileImagePath
if (-not $profileRoot -or -not (Test-Path (Join-Path $profileRoot "AppData\Local\ETCC\clubexpress-profile"))) {
  throw "No ClubExpress profile for $UserId (expected under $profileRoot\AppData\Local\ETCC\clubexpress-profile). Run deploy\clubexpress-login.js as $UserId first."
}

Write-Host "node    : $NodeExe"
Write-Host "script  : $Script"
Write-Host "interval: every $IntervalMinutes minutes"

if ($Interactive) {
  # An Interactive task runs in the logged-on desktop, so launching node.exe
  # directly flashes a console window every poll. conhost --headless (Windows
  # 10 1809+/11) hosts the console without ever showing it. Registering this
  # mode needs no elevation, which is why it's the fallback when S4U
  # registration is refused.
  $action = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\conhost.exe" `
    -Argument "--headless `"$NodeExe`" `"$Script`"" -WorkingDirectory $AppDir
} else {
  $action = New-ScheduledTaskAction -Execute $NodeExe -Argument "`"$Script`"" -WorkingDirectory $AppDir
}

# Repetition with no explicit duration = indefinitely. Start a minute out so the
# very first fire isn't racing this script's own registration.
$startAt = (Get-Date).AddMinutes(1)

# STAGGER AGAINST THE CARSHOW TASK (ported back from CarShow's installer,
# 2026-09-12). Both syncs drive the same shared ClubExpress Chrome profile, and
# Chrome allows one process per profile. Left alone, each task's phase is just
# "whenever it was installed" -- CarShow's first install landed 11 seconds
# behind this one. Start half an interval away from the sibling's next fire,
# the maximum separation possible. (clubexpress.js also retries a busy
# profile; this just keeps that from ever being needed.)
$sibling = Get-ScheduledTask -TaskName "carshow-sync-registrations" -ErrorAction SilentlyContinue
if ($sibling) {
  $siblingNext = (Get-ScheduledTaskInfo -TaskName "carshow-sync-registrations").NextRunTime
  if ($siblingNext) {
    $candidate = $siblingNext.AddMinutes($IntervalMinutes / 2)
    # Walk back/forward by whole intervals to the first slot at least a minute out.
    while ($candidate -gt (Get-Date).AddMinutes(1 + $IntervalMinutes)) { $candidate = $candidate.AddMinutes(-$IntervalMinutes) }
    while ($candidate -lt (Get-Date).AddMinutes(1)) { $candidate = $candidate.AddMinutes($IntervalMinutes) }
    $startAt = $candidate
    Write-Host ("stagger : CarShow next fires {0:h:mm:ss tt}; this task starts {1:h:mm:ss tt} (half an interval apart)" -f $siblingNext, $startAt)
  }
}

$trigger = New-ScheduledTaskTrigger -Once -At $startAt `
  -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes)

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

# MultipleInstances IgnoreNew matters: a slow ClubExpress export must never
# stack a second browser on top of the first. ExecutionTimeLimit is the backstop
# for a run that hangs entirely.

$userId = $UserId
if ($Interactive) {
  $principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
  Write-Host "principal: $userId (Interactive -- runs only while logged on)"
} else {
  $principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType S4U -RunLevel Limited
  Write-Host "principal: $userId (S4U -- runs logged on or off, no stored password)"
}

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host "Replaced the existing '$TaskName' task."
}

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
  -Settings $settings -Principal $principal `
  -Description "Polls the Vette Fest app's import schedule and runs the ClubExpress import when one is due. Replaces the Claude Code scheduled task of the same name." | Out-Null

Write-Host ""
Write-Host "Registered '$TaskName'."
Write-Host ""
Write-Host "Verify with:"
Write-Host "  Start-ScheduledTask -TaskName $TaskName"
Write-Host "  Get-ScheduledTaskInfo -TaskName $TaskName | Select LastRunTime,LastTaskResult,NextRunTime"
Write-Host ""
Write-Host "LastTaskResult 0 = ran fine (including the common 'nothing was due' no-op)."
Write-Host "Anything non-zero means a real failure -- check the History tab in the app,"
Write-Host "or deploy\sync-registrations.local.log on this machine."
