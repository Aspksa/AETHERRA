@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "ROOT=%~dp0"
set "LOG=%ROOT%AETHERRA_STARTUP.log"
> "%LOG%" echo === AETHERRA startup ===
if not exist "%ROOT%server.py" goto missing
if not exist "%ROOT%index.html" goto missing

rem If server is already active, use it instead of competing for the port.
call :health
if not errorlevel 1 (
  echo Existing AETHERRA server detected.
  start "" "http://127.0.0.1:8765/"
  exit /b 0
)

if exist "%ROOT%python\python.exe" (
  call :try_python "%ROOT%python\python.exe"
  if not errorlevel 1 exit /b 0
)
if exist "%ROOT%.venv\Scripts\python.exe" (
  call :try_python "%ROOT%.venv\Scripts\python.exe"
  if not errorlevel 1 exit /b 0
)
where python >nul 2>nul
if not errorlevel 1 (
  call :try_python python
  if not errorlevel 1 exit /b 0
)
where python3 >nul 2>nul
if not errorlevel 1 (
  call :try_python python3
  if not errorlevel 1 exit /b 0
)
where py >nul 2>nul
if not errorlevel 1 (
  call :try_launcher
  if not errorlevel 1 exit /b 0
)

echo ERROR: Local Python server could not start.
echo Read AETHERRA_STARTUP.log. It records errors from each candidate.
echo Cloud.ru and World Updates need http://127.0.0.1:8765/
echo Browser-only mode is available via PLAY_OFFLINE.bat.
pause
exit /b 1

:try_python
>> "%LOG%" echo Attempt: %1
%1 -c "import sys; assert sys.version_info.major == 3" >> "%LOG%" 2>&1
if errorlevel 1 exit /b 1
%1 "%ROOT%server.py" >> "%LOG%" 2>&1
set "STATUS=%errorlevel%"
call :health
if not errorlevel 1 (
  start "" "http://127.0.0.1:8765/"
  exit /b 0
)
>> "%LOG%" echo Server exited with code %STATUS%.
exit /b 1

:try_launcher
>> "%LOG%" echo Attempt: py launcher
py -3 -c "import sys; assert sys.version_info.major == 3" >> "%LOG%" 2>&1
if errorlevel 1 exit /b 1
py -3 "%ROOT%server.py" >> "%LOG%" 2>&1
call :health
if not errorlevel 1 exit /b 0
exit /b 1

:health
powershell -NoProfile -Command "try {$r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://127.0.0.1:8765/health';$j=$r.Content|ConvertFrom-Json;if($r.StatusCode -eq 200 -and $j.app -eq 'AETHERRA'){exit 0}}catch{};exit 1" >nul 2>nul
exit /b %errorlevel%

:missing
echo ERROR: Extract the whole archive, server.py or index.html is missing.
pause
exit /b 1
