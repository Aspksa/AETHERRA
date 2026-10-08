@echo off
setlocal EnableExtensions
cd /d "%~dp0"
if not exist "server.py" goto missing
if not exist "index.html" goto missing
if not exist "AETHERRA_START.ps1" goto missing
rem The PowerShell launcher tests actual Python execution, not Windows negative HRESULT.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0AETHERRA_START.ps1"
set "STATUS=%errorlevel%"
if "%STATUS%"=="0" exit /b 0
echo.
echo Could not start AETHERRA. See AETHERRA_STARTUP.log for details.
echo Offline gameplay: PLAY_OFFLINE.bat. Cloud.ru and updates require a working Python server.
if not defined CI pause
exit /b 1
:missing
echo Incomplete game package. Extract all files from the archive.
if not defined CI pause
exit /b 1
