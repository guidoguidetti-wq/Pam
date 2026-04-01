@echo off
:: ============================================================
::  PAM — Backup launcher (per Task Scheduler Windows)
::  Doppio-click o schedulalo con installa-task-scheduler.ps1
:: ============================================================

setlocal

set SCRIPT_DIR=%~dp0
set PROJECT_DIR=%SCRIPT_DIR%..

:: Vai alla root del progetto (Prisma legge .env da lì)
cd /d "%PROJECT_DIR%"

node scripts\backup-pam.mjs

if %ERRORLEVEL% neq 0 (
    echo ERRORE: backup fallito. Controlla %SCRIPT_DIR%backup.log
    exit /b 1
)

exit /b 0
