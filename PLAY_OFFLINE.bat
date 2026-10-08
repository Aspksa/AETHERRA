@echo off
setlocal
set "ROOT=%~dp0"
if not exist "%ROOT%index.html" (
  echo ERROR: index.html was not found next to this launcher.
  echo Extract ALL files from the ZIP before starting AETHERRA.
  pause
  exit /b 1
)
echo Starting AETHERRA directly in the default browser...
start "" "%ROOT%index.html"
if errorlevel 1 (
  echo Unable to open browser. Open this file manually:
  echo "%ROOT%index.html"
  pause
  exit /b 1
)
exit /b 0
