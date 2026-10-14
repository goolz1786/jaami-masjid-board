@echo off
setlocal
cd /d "%~dp0"
title Jaami Masjid Display Board Autostart Removal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\Uninstall-Board.ps1"
set "RESULT=%ERRORLEVEL%"
echo.
pause
exit /b %RESULT%
