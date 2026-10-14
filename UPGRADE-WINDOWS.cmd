@echo off
setlocal
cd /d "%~dp0"
title Jaami Masjid Display Board Server Upgrade
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\Upgrade-Board.ps1"
set "RESULT=%ERRORLEVEL%"
echo.
if not "%RESULT%"=="0" (
  echo Upgrade did not complete. Review the error above.
) else (
  echo Upgrade completed successfully.
)
pause
exit /b %RESULT%
