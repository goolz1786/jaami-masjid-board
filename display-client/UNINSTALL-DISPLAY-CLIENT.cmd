@echo off
setlocal
cd /d "%~dp0"
title Jaami Masjid Display Client Removal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Uninstall-DisplayClient.ps1"
set "RESULT=%ERRORLEVEL%"
echo.
pause
exit /b %RESULT%
