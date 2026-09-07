@echo off
setlocal

set "DIR=%~dp0"

echo ========================================
echo Starting Client-Web and Server
echo ========================================

echo Starting Client-Web in Windows Terminal tab...
wt -w 0 new-tab --title "Client-Web" cmd /c "%DIR%web.bat"

echo.
echo Waiting for Client-Web on port 3000...
:WAIT_WEB
powershell -NoProfile -Command "if (Test-NetConnection -ComputerName localhost -Port 3000 -InformationLevel Quiet) { exit 0 } else { exit 1 }"
if errorlevel 1 (
    timeout /t 2 /nobreak >nul
    goto WAIT_WEB
)
echo Client-Web is ready!

echo.
echo ========================================
echo Starting Client-Web and Server
echo ========================================
echo Starting Server in new Windows Terminal tab...
wt -w 0 new-tab --title "mobile" cmd /c "%DIR%mobile.bat" 

echo.
echo ========================================
echo All services started
echo ========================================
echo Client-Web: http://localhost:3000
echo Client-Mobile: http://localhost:8081   

exit /b