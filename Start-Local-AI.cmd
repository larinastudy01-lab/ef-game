@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\local-ai\start.ps1"
if errorlevel 1 echo Startup failed. Check artifacts\local-ai\ for logs.
pause
