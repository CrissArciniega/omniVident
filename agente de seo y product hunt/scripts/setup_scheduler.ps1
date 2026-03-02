# Setup de Windows Task Scheduler para pipeline semanal
# Ejecutar como Administrador: powershell -ExecutionPolicy Bypass -File scripts\setup_scheduler.ps1

$ProjectPath = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$PythonPath = "python"  # Cambiar si Python está en otra ubicación

Write-Host "=== Configurando Task Scheduler para Market Research ===" -ForegroundColor Cyan
Write-Host "Proyecto: $ProjectPath"

# Crear la acción
$Action = New-ScheduledTaskAction `
    -Execute $PythonPath `
    -Argument "$ProjectPath\agents\orchestrator.py" `
    -WorkingDirectory $ProjectPath

# Trigger: Cada lunes a las 8:00 AM
$Trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At 8:00AM

# Settings
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 10)

# Registrar tarea
try {
    Register-ScheduledTask `
        -TaskName "MarketResearchWeekly" `
        -Action $Action `
        -Trigger $Trigger `
        -Settings $Settings `
        -Description "Pipeline semanal de investigacion de mercado - Recolecta 50+ productos de MercadoLibre y Amazon" `
        -Force

    Write-Host "`nTarea creada exitosamente!" -ForegroundColor Green
    Write-Host "  Nombre: MarketResearchWeekly"
    Write-Host "  Horario: Cada lunes a las 8:00 AM"
    Write-Host "  Script: $ProjectPath\agents\orchestrator.py"
    Write-Host "`nPara verificar: Get-ScheduledTask -TaskName 'MarketResearchWeekly'"
    Write-Host "Para ejecutar ahora: Start-ScheduledTask -TaskName 'MarketResearchWeekly'"
    Write-Host "Para eliminar: Unregister-ScheduledTask -TaskName 'MarketResearchWeekly' -Confirm:`$false"
}
catch {
    Write-Host "Error al crear la tarea: $_" -ForegroundColor Red
    Write-Host "Asegurate de ejecutar este script como Administrador" -ForegroundColor Yellow
}
