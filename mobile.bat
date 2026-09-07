@echo off
call cd "%~dp0mobile"
call npm i
call npx expo start --offline --clear