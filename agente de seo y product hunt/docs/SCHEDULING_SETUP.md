# Guía: Configurar Windows Task Scheduler

## Opción 1: Script Automático (Recomendado)

Ejecuta el script de PowerShell como Administrador:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\Admin\Desktop\RESPALDO LEITO\ACER\Documentos\agente de seo y product hunt\scripts\setup_scheduler.ps1"
```

## Opción 2: Configuración Manual

1. Abre Task Scheduler: `Win + R` → `taskschd.msc`
2. Click "Create Basic Task..."
3. **Nombre**: MarketResearchWeekly
4. **Trigger**: Weekly → Monday → 8:00 AM
5. **Action**: Start a program
   - **Program**: `python`
   - **Arguments**: `"C:\Users\Admin\Desktop\RESPALDO LEITO\ACER\Documentos\agente de seo y product hunt\agents\orchestrator.py"`
   - **Start in**: `"C:\Users\Admin\Desktop\RESPALDO LEITO\ACER\Documentos\agente de seo y product hunt"`
6. En Properties:
   - "Run whether user is logged on or not"
   - "Run with highest privileges"
   - Settings → "If the task fails, restart every 10 minutes" (up to 3 attempts)

## Verificar

```powershell
# Ver la tarea
Get-ScheduledTask -TaskName "MarketResearchWeekly"

# Ejecutar manualmente para probar
Start-ScheduledTask -TaskName "MarketResearchWeekly"

# Ver última ejecución
Get-ScheduledTaskInfo -TaskName "MarketResearchWeekly"
```

## Eliminar

```powershell
Unregister-ScheduledTask -TaskName "MarketResearchWeekly" -Confirm:$false
```

## Troubleshooting

- **No ejecuta**: Verificar que Python está en el PATH del sistema
- **Error de permisos**: Ejecutar setup como Administrador
- **No hay red**: La tarea está configurada para "Run only if network available"
- **Equipo apagado**: Si el lunes a las 8am el equipo estaba apagado, la tarea se ejecuta al encenderlo gracias a "Start when available"
