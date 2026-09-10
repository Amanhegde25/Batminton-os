@echo off
setlocal

if "%~1"=="" (set PORT=8081) else (set PORT=%~1)
if "%~2"=="" (set FOLDER=%~dp0) else (set FOLDER=%~2)

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
@REM echo Starting Client-Mobile at http://localhost:%PORT%
@REM start "" http://localhost:%PORT%
call npx expo start --offline --clear
