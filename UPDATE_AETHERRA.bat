@echo off
setlocal
cd /d "%~dp0"
set "ROOT=%~dp0"
if exist "%ROOT%python\python.exe" (
  "%ROOT%python\python.exe" "%ROOT%update.py" install
  goto finish
)
if exist "%ROOT%.venv\Scripts\python.exe" (
  "%ROOT%.venv\Scripts\python.exe" "%ROOT%update.py" install
  goto finish
)
where py >nul 2>nul
if not errorlevel 1 (
  py -3 -c "import sys; assert sys.version_info.major == 3" >nul 2>nul
  if not errorlevel 1 (
    py -3 "%ROOT%update.py" install
    goto finish
  )
)
where python >nul 2>nul
if not errorlevel 1 (
  python -c "import sys; assert sys.version_info.major == 3" >nul 2>nul
  if not errorlevel 1 (
    python "%ROOT%update.py" install
    goto finish
  )
)
where python3 >nul 2>nul
if not errorlevel 1 (
  python3 -c "import sys; assert sys.version_info.major == 3" >nul 2>nul
  if not errorlevel 1 (
    python3 "%ROOT%update.py" install
    goto finish
  )
)
echo No working Python 3 found. Repair Python or Python Launcher.
pause
exit /b 1
:finish
if errorlevel 1 (
  echo Update failed. Existing files are preserved when possible.
) else (
  echo Update completed.
)
pause
