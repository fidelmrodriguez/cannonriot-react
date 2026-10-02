@echo off
setlocal
cd /d "%~dp0"
title Cannon Riot
where node >nul 2>nul || (
  echo Node.js 22 is required. Install Node.js and run this file again.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing dependencies...
  call npm ci
  if errorlevel 1 goto :error
)
echo Starting Cannon Riot at http://localhost:5316/
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5316/"
call npm run dev -- --host 0.0.0.0 --port 5316
exit /b %errorlevel%
:error
echo Failed to prepare Cannon Riot.
pause
exit /b 1
