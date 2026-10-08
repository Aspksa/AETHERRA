@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "ROOT=%~dp0"
set "REPORT=%ROOT%AETHERRA_DIAGNOSTICS.txt"
> "%REPORT%" echo === AETHERRA STARTUP DIAGNOSTICS ===
>> "%REPORT%" echo This report omits account names and absolute installation paths.
>> "%REPORT%" echo.
>> "%REPORT%" echo [Required files]
for %%F in (AETHERRA.bat PLAY_OFFLINE.bat server.py index.html update.py UPDATE_AETHERRA.bat) do (
  if exist "%ROOT%%%F" (
    >> "%REPORT%" echo %%F = OK
  ) else (
    >> "%REPORT%" echo %%F = MISSING
  )
)
>> "%REPORT%" echo.
>> "%REPORT%" echo [Python executable checks]
rem Run real Python code and look for a token. A broken Windows alias may pass
rem "--version" or return a negative HRESULT that "if errorlevel 1" does not catch.
set "PROBE_CODE=print('AETHERRA_PYTHON_OK')"
set "BROKEN="
for %%P in (py python python3) do (
  where %%P >nul 2>nul
  if errorlevel 1 (
    >> "%REPORT%" echo %%P = NOT FOUND
  ) else (
    if /i "%%P"=="py" (
      py -3 -c "%PROBE_CODE%" 2>nul | findstr /b /c:"AETHERRA_PYTHON_OK" >nul
    ) else (
      %%P -c "%PROBE_CODE%" 2>nul | findstr /b /c:"AETHERRA_PYTHON_OK" >nul
    )
    if errorlevel 1 (
      >> "%REPORT%" echo %%P = FOUND BUT NOT WORKING
      set "BROKEN=1"
    ) else (
      >> "%REPORT%" echo %%P = WORKING
    )
  )
)
if exist "%ROOT%python\python.exe" (
  "%ROOT%python\python.exe" -c "%PROBE_CODE%" 2>nul | findstr /b /c:"AETHERRA_PYTHON_OK" >nul
  if errorlevel 1 (>> "%REPORT%" echo portable python = FAILED) else (>> "%REPORT%" echo portable python = WORKING)
)
if exist "%ROOT%.venv\Scripts\python.exe" (
  "%ROOT%.venv\Scripts\python.exe" -c "%PROBE_CODE%" 2>nul | findstr /b /c:"AETHERRA_PYTHON_OK" >nul
  if errorlevel 1 (>> "%REPORT%" echo .venv python = FAILED) else (>> "%REPORT%" echo .venv python = WORKING)
)
>> "%REPORT%" echo.
>> "%REPORT%" echo [Server health at 127.0.0.1:8765]
powershell -NoProfile -Command "try { $r=Invoke-WebRequest -Uri 'http://127.0.0.1:8765/health' -UseBasicParsing -TimeoutSec 3; if($r.StatusCode -eq 200){'HEALTH = OK'}else{'HEALTH = HTTP '+$r.StatusCode} }catch {'HEALTH = UNREACHABLE'}" >> "%REPORT%" 2>nul
>> "%REPORT%" echo.
>> "%REPORT%" echo [Suggestions]
if not exist "%ROOT%index.html" >> "%REPORT%" echo Extract the entire ZIP archive.
>> "%REPORT%" echo Try PLAY_OFFLINE.bat for browser-only mode.
>> "%REPORT%" echo If Python cannot start, repair the Python installation.
if defined BROKEN >> "%REPORT%" echo A Python command points to a deleted or broken install (often 0x80070002). Reinstall Python or put a portable Python into the "python" folder next to the game.
echo Report saved to AETHERRA_DIAGNOSTICS.txt
echo You may send the report to diagnose the problem.
pause
