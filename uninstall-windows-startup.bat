@echo off
setlocal

set "STARTUP_FILE=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\token-meter-startup.vbs"

if exist "%STARTUP_FILE%" del "%STARTUP_FILE%"

echo Token Meter のWindowsスタートアップ登録を解除しました。
pause
