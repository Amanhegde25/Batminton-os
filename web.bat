@echo off
setlocal

if "%~1"=="" (set PORT=3000) else (set PORT=%~1)
if "%~2"=="" (set FOLDER=%~dp0web) else (set FOLDER=%~2)

cd /d "%FOLDER%"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js from https://nodejs.org/
  pause
  exit /b 1
)

echo Checking dependencies...

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
) else (
    echo Dependencies already installed.
)

echo.
echo Starting Client-Web at http://localhost:%PORT%
start "" http://localhost:%PORT%
call npm run dev
