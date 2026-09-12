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
[CmdletBinding()]
param(
  [switch]$Interactive,
  [int]$IntervalMinutes = 15,
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
if (-not [Environment]::GetEnvironmentVariable("VETTEFEST_SITE_PASSWORD", "User")) {
  throw "VETTEFEST_SITE_PASSWORD is not set as a persistent USER environment variable. Set it, then re-run."
}

Write-Host "node    : $NodeExe"
Write-Host "script  : $Script"
Write-Host "interval: every $IntervalMinutes minutes"

$action = New-ScheduledTaskAction -Execute $NodeExe -Argument "`"$Script`"" -WorkingDirectory $AppDir

# Repetition with no explicit duration = indefinitely. Start a minute out so the
# very first fire isn't racing this script's own registration.
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
  -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes)

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

# MultipleInstances IgnoreNew matters: a slow ClubExpress export must never
# stack a second browser on top of the first. ExecutionTimeLimit is the backstop
# for a run that hangs entirely.

$userId = "$env:USERDOMAIN\$env:USERNAME"
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
