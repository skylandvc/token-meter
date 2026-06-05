@echo off
cd /d %~dp0
set PORT=8766
python server.py
pause
