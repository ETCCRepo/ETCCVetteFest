@echo off
rem Creates (or re-creates) the Windows scheduled task that runs the Vette Fest
rem ClubExpress import every 15 minutes. Downloaded from the app's Setup tab >
rem Import Schedule. Double-click it on the machine that holds the VetteFest
rem repo, signed in as the account that owns the ClubExpress login.
rem
rem It only launches deploy\install-scheduled-task.ps1 in -Interactive mode
rem (runs while that account is signed in, no window). That is the mode that
rem registers without administrator rights; see the .ps1 header for the
rem others. Contains no passwords or site secrets.

setlocal
set "INSTALLER=Z:\Backup\Websites\VetteFest\App\deploy\install-scheduled-task.ps1"

if not exist "%INSTALLER%" (
  echo Could not find:
  echo   %INSTALLER%
  echo.
  echo Run this on the machine that has the VetteFest repo at that path,
  echo or edit the INSTALLER line in this file to point at your copy.
  echo.
  pause
  exit /b 1
)

echo Creating the "vettefest-sync-registrations" scheduled task...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%INSTALLER%" -Interactive
set "RC=%ERRORLEVEL%"
echo.
if "%RC%"=="0" (
  echo Done. Check it in Task Scheduler: Last Run Result 0 means it's working.
) else (
  echo Failed with exit code %RC% -- read the message above.
)
echo.
pause
exit /b %RC%
