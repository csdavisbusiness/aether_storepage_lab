@echo off
rem Runs testers.ps1 without changing the PowerShell execution policy. Usage: testers add "Jane Doe"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0testers.ps1" %*
