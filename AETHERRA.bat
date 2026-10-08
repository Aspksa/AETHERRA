@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "ROOT=%~dp0"
set "LOG=%ROOT%AETHERRA_STARTUP.log"
set "AETHERRA_LOG=%LOG%"
> "%LOG%" echo === AETHERRA startup ===
if not exist "%ROOT%server.py" goto missing
if not exist "%ROOT%index.html" goto missing

rem Reuse an existing server instead of competing for port 8765.
call :health
if not errorlevel 1 (
  echo AETHERRA is already running at http://127.0.0.1:8765/
  start "" "http://127.0.0.1:8765/"
  exit /b 0
)

rem Only select an interpreter here. Start the server exactly once.
if exist "%ROOT%python\python.exe" (
  set "PYTHON=%ROOT%python\python.exe"
  call :validate
  if not errorlevel 1 goto run
)
if exist "%ROOT%.venv\Scripts\python.exe" (
  set "PYTHON=%ROOT%.venv\Scripts\python.exe"
  call :validate
  if not errorlevel 1 goto run
)
where python >nul 2>nul
if not errorlevel 1 (
  set "PYTHON=python"
  call :validate
  if not errorlevel 1 goto run
)
where python3 >nul 2>nul
if not errorlevel 1 (
  set "PYTHON=python3"
  call :validate
  if not errorlevel 1 goto run
)
where py >nul 2>nul
if not errorlevel 1 (
  set "PYTHON=py"
  call :validate
  if not errorlevel 1 goto run
)
echo ERROR: No functioning Python interpreter was found.
>> "%LOG%" echo ERROR: No working interpreter
goto failure


:validate
>> "%LOG%" echo Checking Python candidate: %PYTHON%
set "PROBE=%TEMP%\aetherra-python-probe-%RANDOM%-%RANDOM%.txt"
if "%PYTHON%"=="py" (
  py -3 -c "print('AETHERRA_PYTHON_OK')" > "%PROBE%" 2>> "%LOG%"
) else (
  "%PYTHON%" -c "print('AETHERRA_PYTHON_OK')" > "%PROBE%" 2>> "%LOG%"
)
rem Check the actual output, not negative HRESULT errorlevel from a broken Windows launcher.
if not exist "%PROBE%" goto rejected_python
findstr /x /c:"AETHERRA_PYTHON_OK" "%PROBE%" >nul 2>nul
if errorlevel 1 goto rejected_python
del /q "%PROBE%" >nul 2>nul
exit /b 0
:rejected_python
if exist "%PROBE%" del /q "%PROBE%" >nul 2>nul
>> "%LOG%" echo Candidate rejected: no readiness token.
exit /b 1

:run
echo Starting AETHERRA at http://127.0.0.1:8765/
>> "%LOG%" echo Starting server with %PYTHON%
if "%PYTHON%"=="py" (
  py -3 -u -c "import runpy;runpy.run_path('server.py',run_name='__main__')" >> "%LOG%" 2>&1
) else (
  "%PYTHON%" -u -c "import runpy;runpy.run_path('server.py',run_name='__main__')" >> "%LOG%" 2>&1
)
set "STATUS=%errorlevel%"
if "%STATUS%"=="0" exit /b 0
echo ERROR: Server exited with code %STATUS%.
>> "%LOG%" echo ERROR: Server exited with code %STATUS%
echo === Last startup log lines ===
powershell -NoProfile -Command "Get-Content -LiteralPath $env:AETHERRA_LOG -Tail 24" 2>nul
goto failure

:health
powershell -NoProfile -Command "try {$r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://127.0.0.1:8765/health';$j=$r.Content|ConvertFrom-Json;if($r.StatusCode -eq 200 -and $j.app -eq 'AETHERRA'){exit 0}}catch{};exit 1" >nul 2>nul
exit /b %errorlevel%

:missing
echo ERROR: Extract the whole ZIP archive before starting.
>> "%LOG%" echo ERROR: server.py or index.html missing
:failure
echo Inspect AETHERRA_STARTUP.log in the game folder.
echo Cloud.ru and World Updates require the local Python server.
echo For browser-only play, run PLAY_OFFLINE.bat separately.
pause
exit /b 1
