@echo off
setlocal

set "APP_DIR=%~dp0"
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "STARTUP_FILE=%STARTUP_DIR%\token-meter-startup.vbs"

if not exist "%STARTUP_DIR%" mkdir "%STARTUP_DIR%"

> "%STARTUP_FILE%" echo Set WshShell = CreateObject("WScript.Shell")
>> "%STARTUP_FILE%" echo WshShell.Run "cmd /c cd /d ""%APP_DIR%"" ^&^& set PORT=8766 ^&^& python server.py", 0

echo Token Meter をWindowsのスタートアップに登録しました。
echo 次回ログイン時から裏側で起動します。
echo 今すぐ使う場合は start-windows.bat を一度だけ実行してください。
pause
