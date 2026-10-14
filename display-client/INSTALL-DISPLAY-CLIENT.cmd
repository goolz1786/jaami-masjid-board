@echo off
setlocal
cd /d "%~dp0"
title Jaami Masjid Display Client Setup
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-DisplayClient.ps1"
set "RESULT=%ERRORLEVEL%"
echo.
if not "%RESULT%"=="0" (
  echo Display client setup did not complete. Review the error above.
) else (
  echo Display client setup completed successfully.
)
pause
exit /b %RESULT%
