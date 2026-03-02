# Market Research Agent Pipeline

## Proyecto
Sistema automatizado de investigación de mercado que recolecta 50+ productos bestseller cada lunes a las 8am, analiza competencia y precios entre 4 países (EC, MX, CO, USA), y publica resultados en Notion.

## Arquitectura

### Pipeline de 6 Agentes
```
[Orchestrator] → coordina todo el flujo
    ├─ [mercadolibre_collector] → API MercadoLibre (EC, MX, CO) — PARALELO
    ├─ [amazon_collector] → Scraping Amazon (USA, MX) — PARALELO
    ├─ [trends_enricher] → Google Trends via pytrends
    ├─ [market_analyzer] → Análisis cruzado, scoring, gaps
    └─ [notion_publisher] → Publica en Notion DB
```

### Flujo de Datos
1. Collectors guardan JSON en `outputs/raw/raw_{source}_{country}_{YYYYMMDD}.json`
2. Trends enricher lee raw → guarda en `outputs/processed/enriched_trends_{YYYYMMDD}.json`
3. Analyzer lee todo → genera `outputs/processed/analysis_report_{YYYYMMDD}.json`
4. Publisher lee analysis_report → crea páginas en Notion

## Estructura de Carpetas
```
agents/              → Código de los agentes (creados desde terminal)
config/              → Configuración (markets, categories, APIs, scheduling)
schemas/             → Modelos Pydantic para validación de datos
templates/prompts/   → Prompts/instrucciones de cada agente
templates/content/   → Templates para reportes
outputs/raw/         → Datos crudos de APIs/scraping (no versionar)
outputs/processed/   → Datos analizados
outputs/logs/        → Logs de ejecución (no versionar)
utils/               → Utilidades compartidas (logger, data_loader, currency, validators)
scripts/             → Scripts de setup, testing, ejecución manual
docs/                → Documentación técnica
```

## Stack
- **Python 3.11+**
- **APIs**: MercadoLibre (gratis), exchangerate-api.com (gratis)
- **Scraping**: Playwright + BeautifulSoup4
- **Tendencias**: pytrends
- **Validación**: Pydantic v2
- **Output**: Notion via MCP
- **Scheduling**: Windows Task Scheduler

## Convenciones

### Nombres de agentes
- Snake_case: `mercadolibre_collector`, `market_analyzer`
- Archivos en `agents/`: `agents/{nombre_agente}.py`

### Nombres de archivos de datos
- Raw: `raw_{source}_{country}_{YYYYMMDD}.json`
- Processed: `{tipo}_{YYYYMMDD}.json`
- Logs: `{agente}_{YYYYMMDD}.log`

### Schemas
- Todo dato que pasa entre agentes DEBE validarse contra su schema Pydantic
- Schemas en `schemas/` — importar desde `schemas.__init__`

### Configuración
- Toda config en `config/*.json` — cargar con `utils.load_config("nombre")`
- Credenciales en `.env` — cargar con `python-dotenv`
- NUNCA hardcodear URLs, credenciales o IDs de países

### Logging
- Usar `utils.get_logger("nombre_agente")` en cada agente
- Logs van a `outputs/logs/` automáticamente

### Manejo de errores
- Cada agente maneja sus propios errores y no crashea el pipeline
- Si un collector falla, el analyzer trabaja con los datos disponibles
- Si trends_enricher falla, el analyzer continúa sin datos de tendencias

## Comandos Útiles
```bash
# Setup inicial
pip install -r requirements.txt
playwright install chromium
cp .env.example .env  # Configurar credenciales

# Testing
python scripts/test_apis.py          # Verificar conexión a APIs
python scripts/validate_config.py    # Validar configuraciones

# Ejecución manual
python scripts/manual_run.py                    # Pipeline completo
python scripts/manual_run.py --agent collector  # Solo recolección
python scripts/manual_run.py --dry-run          # Sin escribir datos

# Scheduling
powershell -ExecutionPolicy Bypass -File scripts\setup_scheduler.ps1
```
