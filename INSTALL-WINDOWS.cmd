@echo off
setlocal
cd /d "%~dp0"
title Jaami Masjid Display Board Server Installer
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\Install-Board.ps1"
set "RESULT=%ERRORLEVEL%"
echo.
if not "%RESULT%"=="0" (
  echo Installation did not complete. Review the error above.
) else (
  echo Installation completed successfully.
)
pause
exit /b %RESULT%
