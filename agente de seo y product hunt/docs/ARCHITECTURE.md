# Arquitectura del Sistema

## Diagrama del Pipeline

```
                    ┌─────────────────────┐
                    │   Windows Task      │
                    │   Scheduler         │
                    │   Lunes 8:00 AM     │
                    └────────┬────────────┘
                             │
                             ▼
                    ┌─────────────────────┐
                    │   ORCHESTRATOR      │
                    │   Coordina flujo    │
                    │   Maneja errores    │
                    └────────┬────────────┘
                             │
                ┌────────────┴────────────┐
                │ PASO 1 (paralelo)       │
                ▼                         ▼
    ┌──────────────────┐     ┌──────────────────┐
    │ ML COLLECTOR     │     │ AMAZON COLLECTOR  │
    │ API MercadoLibre │     │ Playwright scrape │
    │ EC, MX, CO       │     │ USA, MX           │
    └────────┬─────────┘     └────────┬──────────┘
             │                        │
             ▼                        ▼
    outputs/raw/               outputs/raw/
    raw_mercadolibre_*.json    raw_amazon_*.json
             │                        │
             └────────────┬───────────┘
                          │
                          ▼ PASO 2
                ┌──────────────────┐
                │ TRENDS ENRICHER  │
                │ pytrends         │
                │ Demand signals   │
                └────────┬─────────┘
                         │
                         ▼
            outputs/processed/
            enriched_trends_*.json
                         │
                         ▼ PASO 3
                ┌──────────────────┐
                │ MARKET ANALYZER  │
                │ Price comparison │
                │ Gap detection    │
                │ Opportunity score│
                └────────┬─────────┘
                         │
                         ▼
            outputs/processed/
            analysis_report_*.json
                         │
                         ▼ PASO 4
                ┌──────────────────┐
                │ NOTION PUBLISHER │
                │ Create DB pages  │
                │ Weekly summary   │
                └────────┬─────────┘
                         │
                         ▼
                ┌──────────────────┐
                │  NOTION DATABASE │
                │  50+ productos   │
                │  4 países        │
                └──────────────────┘
```

## Agentes en Detalle

### 1. Orchestrator (`agents/orchestrator.py`)
- **Trigger**: Windows Task Scheduler o manual_run.py
- **Responsabilidad**: Ejecutar agentes en orden, manejar fallos, retry logic
- **Config**: `config/scheduling_config.json`
- **State**: `config/state.json`

### 2. MercadoLibre Collector (`agents/mercadolibre_collector.py`)
- **Input**: `config/markets.json`, `config/categories.json`, `config/mercadolibre_config.json`
- **Output**: `outputs/raw/raw_mercadolibre_{EC|MX|CO}_{YYYYMMDD}.json`
- **Schema**: `schemas.MLRawCollection`
- **API**: REST, OAuth2, 1500 req/min
- **Países**: Ecuador (MEC), México (MLM), Colombia (MCO)

### 3. Amazon Collector (`agents/amazon_collector.py`)
- **Input**: `config/scraping_config.json`, `config/categories.json`
- **Output**: `outputs/raw/raw_amazon_{USA|MX}_{YYYYMMDD}.json`
- **Schema**: `schemas.AmazonRawCollection`
- **Método**: Playwright headless browser
- **Países**: USA (amazon.com), México (amazon.com.mx)

### 4. Trends Enricher (`agents/trends_enricher.py`)
- **Input**: Archivos en `outputs/raw/`
- **Output**: `outputs/processed/enriched_trends_{YYYYMMDD}.json`
- **Schema**: `schemas.EnrichedTrendsCollection`
- **Librería**: pytrends (Google Trends unofficial)
- **Degradación**: Si falla, el pipeline continúa sin datos de tendencias

### 5. Market Analyzer (`agents/market_analyzer.py`)
- **Input**: Todo en `outputs/raw/` + `outputs/processed/enriched_trends_*.json`
- **Output**: `outputs/processed/analysis_report_{YYYYMMDD}.json`
- **Schema**: `schemas.AnalysisReport`
- **Lógica**: Normalización USD, scoring de oportunidad, detección de gaps

### 6. Notion Publisher (`agents/notion_publisher.py`)
- **Input**: `outputs/processed/analysis_report_{YYYYMMDD}.json`
- **Output**: Páginas en Notion Database
- **Config**: `config/notion_config.json`
- **Método**: Notion MCP tools

## Schemas de Datos (Contratos)

| Schema | Archivo | Usado por |
|--------|---------|-----------|
| `MLRawCollection` | `schemas/mercadolibre_raw.py` | ML Collector → Analyzer |
| `AmazonRawCollection` | `schemas/amazon_raw.py` | Amazon Collector → Analyzer |
| `EnrichedTrendsCollection` | `schemas/enriched_trends.py` | Enricher → Analyzer |
| `AnalysisReport` | `schemas/analysis_report.py` | Analyzer → Publisher |

## Utilidades Compartidas

| Módulo | Archivo | Propósito |
|--------|---------|-----------|
| Logger | `utils/logger.py` | Logging estructurado a archivo + consola |
| Data Loader | `utils/data_loader.py` | Lectura/escritura JSON, carga de config |
| Currency | `utils/currency_converter.py` | Conversión de monedas a USD |
| Validators | `utils/validators.py` | Validación de datos contra schemas |
