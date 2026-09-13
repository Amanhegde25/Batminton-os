@echo off
setlocal

set "DIR=%~dp0"
echo Starting Client-Web in Windows Terminal tab...
wt -w 0 new-tab --title "Client-Web" cmd /c "%DIR%web/run.bat"

:WAIT_WEB
powershell -NoProfile -Command "if (Test-NetConnection -ComputerName localhost -Port 3000 -InformationLevel Quiet) { exit 0 } else { exit 1 }"
if errorlevel 1 (
    timeout /t 2 /nobreak >nul
    goto WAIT_WEB
)
wt -w 0 new-tab --title "mobile" cmd /c "%DIR%mobile/run.bat" 
echo Client-Web: http://localhost:3000
echo Client-Mobile: http://localhost:8081   

exit /b