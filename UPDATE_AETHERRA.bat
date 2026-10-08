@echo off
setlocal
cd /d "%~dp0"
set "PYTHON="
if exist "%~dp0python\python.exe" set "PYTHON=%~dp0python\python.exe"
if not defined PYTHON if exist "%~dp0.venv\Scripts\python.exe" set "PYTHON=%~dp0.venv\Scripts\python.exe"
if defined PYTHON goto runlocal
where py >nul 2>nul
if not errorlevel 1 (
  py -3 update.py install
  goto finish
)
where python >nul 2>nul
if not errorlevel 1 (
  python update.py install
  goto finish
)
echo Update requires Python 3 and an internet connection.
pause
exit /b 1
:runlocal
"%PYTHON%" update.py install
:finish
if errorlevel 1 (
  echo Update failed. Your original files should still be available.
) else (
  echo Update complete. Reopen AETHERRA.bat if the game was running.
)
pause
