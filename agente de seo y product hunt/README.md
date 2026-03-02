# Market Research Agent Pipeline

Sistema automatizado de investigación de mercado que cada lunes a las 8am recolecta los 50+ productos más vendidos de múltiples marketplaces, analiza competencia y precios entre 4 países, y publica los resultados en Notion.

## Países cubiertos
- Ecuador (MercadoLibre)
- México (MercadoLibre + Amazon)
- Colombia (MercadoLibre)
- USA (Amazon)

## Fuentes de datos
- **MercadoLibre API** (gratis) — fuente principal para LATAM
- **Amazon Bestsellers** (scraping con Playwright) — fuente para USA/MX
- **Google Trends** (pytrends) — señales de demanda

## Arquitectura

```
Lunes 8am → [Orchestrator]
                  |
    +-------------+-------------+
    |                           |
[ML Collector]           [Amazon Collector]
(EC, MX, CO)               (USA, MX)
    |                           |
    +-------------+-------------+
                  |
          [Trends Enricher]
                  |
          [Market Analyzer]
                  |
          [Notion Publisher] → Notion DB
```

## Requisitos Previos

- Python 3.11+
- Cuenta de desarrollador en MercadoLibre (ver `docs/MERCADOLIBRE_SETUP.md`)
- Notion con MCP conectado
- Windows (para Task Scheduler)

## Setup Inicial

```bash
# 1. Instalar dependencias
pip install -r requirements.txt
playwright install chromium

# 2. Configurar credenciales
cp .env.example .env
# Editar .env con tus credenciales de MercadoLibre

# 3. Verificar conexiones
python scripts/test_apis.py

# 4. Validar configuraciones
python scripts/validate_config.py

# 5. Configurar scheduling (como Administrador)
powershell -ExecutionPolicy Bypass -File scripts\setup_scheduler.ps1
```

## Crear los Agentes (Claude Code)

Crear los agentes en este orden desde la terminal:

```bash
# 1. Recolector de MercadoLibre (fuente principal)
# Usar templates/prompts/collector_prompt.md como referencia

# 2. Recolector de Amazon (fuente secundaria)
# Usar templates/prompts/collector_prompt.md como referencia

# 3. Enriquecedor de tendencias
# Usar templates/prompts/analyzer_prompt.md (sección trends)

# 4. Analizador de mercado
# Usar templates/prompts/analyzer_prompt.md como referencia

# 5. Publicador en Notion
# Usar templates/prompts/publisher_prompt.md como referencia

# 6. Orquestador (coordina todo)
# Usar templates/prompts/orchestrator_prompt.md como referencia
```

## Estructura del Proyecto

```
├── agents/              # Código de los agentes (los creas tú)
├── config/              # Configuración de markets, APIs, scheduling
├── schemas/             # Modelos Pydantic para validación de datos
├── templates/
│   ├── prompts/         # Instrucciones/prompts de cada agente
│   └── content/         # Templates de reportes
├── outputs/
│   ├── raw/             # Datos crudos de APIs/scraping
│   ├── processed/       # Datos analizados
│   └── logs/            # Logs de ejecución
├── utils/               # Utilidades compartidas
├── scripts/             # Scripts de setup y testing
├── docs/                # Documentación técnica
├── CLAUDE.md            # Contexto para Claude Code
├── requirements.txt     # Dependencias Python
└── .env.example         # Template de variables de entorno
```

## Ejecución Manual

```bash
python scripts/manual_run.py                    # Pipeline completo
python scripts/manual_run.py --agent collector  # Solo recolección
python scripts/manual_run.py --dry-run          # Sin escribir datos
```

## Documentación

- `docs/ARCHITECTURE.md` — Diagrama y flujo de datos completo
- `docs/AGENT_SPECIFICATIONS.md` — Specs detalladas de cada agente
- `docs/MERCADOLIBRE_SETUP.md` — Crear cuenta de desarrollador ML
- `docs/NOTION_SETUP.md` — Configurar base de datos Notion
- `docs/SCHEDULING_SETUP.md` — Configurar Windows Task Scheduler

## Notion Database

La base de datos "Weekly Market Research 2026" ya está creada con estas propiedades:
- Rank, Product Name, Category, Opportunity Score
- Precios por país (USA, MX, EC, CO) en USD
- Trend, Trend Score, Market Gaps, Gap Details
- Top Country, Sources, Status

## Costo

| Componente | Costo |
|-----------|-------|
| MercadoLibre API | $0 |
| Amazon scraping | $0 |
| Google Trends | $0 |
| Exchange Rate API | $0 |
| Windows Task Scheduler | $0 |
| **Total** | **$0/mes** |
