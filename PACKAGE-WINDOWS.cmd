@echo off
setlocal
cd /d "%~dp0"
title Jaami Masjid Display Board Packaging
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\Package-Board.ps1"
set "RESULT=%ERRORLEVEL%"
echo.
if not "%RESULT%"=="0" (
  echo Packaging did not complete. Review the error above.
) else (
  echo Packaging completed successfully.
)
pause
exit /b %RESULT%
