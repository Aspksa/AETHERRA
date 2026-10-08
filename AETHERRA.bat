@echo off
setlocal
cd /d "%~dp0"
set "ROOT=%~dp0"
if exist "%ROOT%python\python.exe" (
  "%ROOT%python\python.exe" "%ROOT%server.py"
  goto :finish
)
if exist "%ROOT%.venv\Scripts\python.exe" (
  "%ROOT%.venv\Scripts\python.exe" "%ROOT%server.py"
  goto :finish
)
where py >nul 2>nul
if not errorlevel 1 (
  py -3 "%ROOT%server.py"
  goto :finish
)
where python >nul 2>nul
if not errorlevel 1 (
  python "%ROOT%server.py"
  goto :finish
)
echo Python is not installed. Running offline browser mode.
start "" "%ROOT%index.html"
exit /b 0
:finish
if errorlevel 1 (
  echo Server did not start. Opening standalone browser version.
  start "" "%ROOT%index.html"
  pause
)
