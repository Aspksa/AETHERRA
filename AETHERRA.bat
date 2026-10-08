@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "ROOT=%~dp0"
set "LOG=%ROOT%AETHERRA_STARTUP.log"
> "%LOG%" echo AETHERRA startup attempts
if not exist "%ROOT%server.py" goto missing
if not exist "%ROOT%index.html" goto missing

rem Prefer the independent working Python command; py may be registered but broken.
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
echo Python server could not start. See AETHERRA_STARTUP.log
echo Starting standalone browser mode...
start "" "%ROOT%index.html"
pause
exit /b 1

:try_python
>> "%LOG%" echo Attempt: Python interpreter
%1 -c "import sys; assert sys.version_info.major == 3" >> "%LOG%" 2>&1
if errorlevel 1 exit /b 1
echo Starting local server with %1
%1 "%ROOT%server.py" >> "%LOG%" 2>&1
exit /b 1

:try_launcher
>> "%LOG%" echo Attempt: Python Launcher
py -3 -c "import sys; assert sys.version_info.major == 3" >> "%LOG%" 2>&1
if errorlevel 1 exit /b 1
py -3 "%ROOT%server.py" >> "%LOG%" 2>&1
exit /b 1

:missing
echo Missing server.py or index.html. Extract the full archive.
pause
exit /b 1
