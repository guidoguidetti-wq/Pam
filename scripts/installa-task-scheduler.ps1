# ============================================================
#  PAM — Registra il backup giornaliero nel Task Scheduler
#  Eseguire UNA VOLTA (anche senza privilegi di amministratore):
#    powershell -ExecutionPolicy Bypass -File installa-task-scheduler.ps1
#
#  Parametro opzionale:
#    -Ora "02:00"   (default: 02:00 di notte)
# ============================================================

param(
    [string]$Ora = "02:00"
)

$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$BatFile    = Join-Path $ScriptDir "backup-pam.bat"
$TaskName   = "PAM_BackupDatabase"

if (-not (Test-Path $BatFile)) {
    Write-Error "File non trovato: $BatFile"
    exit 1
}

# Rimuovi task precedente se esiste
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Task precedente rimosso."
}

$trigger  = New-ScheduledTaskTrigger -Daily -At $Ora
$action   = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/c `"$BatFile`"" `
    -WorkingDirectory $ScriptDir

$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
    -StartWhenAvailable `
    -DontStopIfGoingOnBatteries `
    -RunOnlyIfNetworkAvailable

$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Highest

Register-ScheduledTask `
    -TaskName   $TaskName `
    -Trigger    $trigger `
    -Action     $action `
    -Settings   $settings `
    -Principal  $principal `
    -Description "Backup giornaliero database PAM (Node.js + Prisma)" `
    -Force | Out-Null

Write-Host ""
Write-Host "Task schedulato con successo!"
Write-Host "  Nome:    $TaskName"
Write-Host "  Orario:  ogni giorno alle $Ora"
Write-Host "  Log:     $(Join-Path $ScriptDir 'backup.log')"
Write-Host "  Backup:  $(Join-Path $ScriptDir 'backups\')"
Write-Host ""
Write-Host "Per rimuovere il task:"
Write-Host "  Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"
