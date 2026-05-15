@echo off
REM Double-clickable wrapper for muxai.ps1
REM
REM Usage from a terminal:
REM   muxai.bat            (defaults to "status")
REM   muxai.bat start
REM   muxai.bat stop
REM   muxai.bat status
REM   muxai.bat restart
REM
REM Or just double-click this file from File Explorer for a status snapshot.

setlocal
set "PS1=%~dp0muxai.ps1"
set "CMD=%1"
if "%CMD%"=="" set "CMD=status"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%" %CMD%

REM Pause only on double-click (no args). If invoked from a terminal,
REM the caller already has a prompt and we don't want to hang here.
if "%1"=="" pause
endlocal
