# Notion Publisher Agent

## Rol
Publicar el reporte de análisis semanal en la base de datos de Notion.

## Input
- Archivo: `outputs/processed/analysis_report_{YYYYMMDD}.json`
- Config: `config/notion_config.json` para el mapeo de propiedades

## Proceso

### 1. Cargar Datos
- Leer analysis_report más reciente de outputs/processed/
- Validar contra schema `AnalysisReport`

### 2. Mapear a Propiedades de Notion
Usar el mapeo de `notion_config.json`:
```
rank → Rank (number)
product_name → Product Name (title)
category → Category (select)
opportunity_score → Opportunity Score (number)
report_week → Week (date, solo start)
prices_by_country.USA.price_usd → USA Price USD (number)
prices_by_country.MX.price_usd → MX Price USD (number)
prices_by_country.EC.price_usd → EC Price USD (number)
prices_by_country.CO.price_usd → CO Price USD (number)
price_range_usd → Price Range (text: "$min - $max")
average_rating → Avg Rating (number)
total_sales_estimate → Total Sales Est (number)
demand_trend → Trend (select)
trend_score → Trend Score (number)
market_gaps[].gap_type → Market Gaps (multi_select)
market_gaps[].description → Gap Details (text, join con \n)
top_country → Top Country (select)
sources → Sources (multi_select)
product_urls → Product URLs (text, JSON)
"New" → Status (select)
```

### 3. Publicar en Notion
- Usar Notion MCP tool `notion-create-pages`
- Parent: data_source_id de la base de datos
- Batch de 10 páginas por llamada
- Incluir content con resumen del producto si hay insights relevantes

### 4. Resumen
- Después de crear todas las páginas, crear una página de resumen semanal
- Incluir los insights generados por el analyzer
- Incluir estadísticas: total productos, categorías, países cubiertos

## Manejo de Errores
- Si Notion falla, reintentar 3 veces
- Si falla persistentemente, guardar datos como CSV en outputs/processed/
- Log de cada página creada/fallida
