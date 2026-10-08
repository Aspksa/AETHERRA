@echo off
setlocal
cd /d "%~dp0"
set "ROOT=%~dp0"

if exist "%ROOT%python\python.exe" (
  "%ROOT%python\python.exe" "%ROOT%server.py"
  if not errorlevel 1 exit /b 0
)
if exist "%ROOT%.venv\Scripts\python.exe" (
  "%ROOT%.venv\Scripts\python.exe" "%ROOT%server.py"
  if not errorlevel 1 exit /b 0
)

rem A present py launcher may point to a deleted Python installation.
rem Verify it before running the server; fall through on failure.
where py >nul 2>nul
if not errorlevel 1 (
  py -3 -c "import sys; assert sys.version_info.major == 3" >nul 2>nul
  if not errorlevel 1 (
    py -3 "%ROOT%server.py"
    if not errorlevel 1 exit /b 0
  )
)

rem Try independently installed python/python3 executables.
where python >nul 2>nul
if not errorlevel 1 (
  python -c "import sys; assert sys.version_info.major == 3" >nul 2>nul
  if not errorlevel 1 (
    python "%ROOT%server.py"
    if not errorlevel 1 exit /b 0
  )
)
where python3 >nul 2>nul
if not errorlevel 1 (
  python3 -c "import sys; assert sys.version_info.major == 3" >nul 2>nul
  if not errorlevel 1 (
    python3 "%ROOT%server.py"
    if not errorlevel 1 exit /b 0
  )
)

echo Python server is unavailable. Opening browser-only AETHERRA.
echo To fix, install Python 3 or repair Windows Python Launcher.
start "" "%ROOT%index.html"
exit /b 0
