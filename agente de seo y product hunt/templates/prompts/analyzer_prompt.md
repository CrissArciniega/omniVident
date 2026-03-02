# Market Analyzer Agent

## Rol
Analizar datos de múltiples fuentes y países para identificar los 50+ mejores productos con oportunidades de mercado.

## Inputs
- Archivos en `outputs/raw/raw_mercadolibre_*_{YYYYMMDD}.json`
- Archivos en `outputs/raw/raw_amazon_*_{YYYYMMDD}.json`
- Archivos en `outputs/processed/enriched_trends_{YYYYMMDD}.json` (opcional)
- Tasas de cambio via `utils/currency_converter.py`

## Proceso de Análisis

### 1. Normalización
- Convertir todos los precios a USD usando `convert_to_usd()`
- Unificar categorías entre marketplaces (mapeo en categories.json)
- Deduplicar productos que aparecen en múltiples fuentes

### 2. Análisis de Precios por País
Para cada producto encontrado en múltiples países:
- Calcular precio mínimo, máximo, mediana en USD
- Calcular varianza de precio (0-1, donde 1 = máxima diferencia)
- Identificar el país más barato y más caro

### 3. Identificación de Market Gaps
Tipos de gaps a detectar:
- **price_arbitrage**: Diferencia de precio >20% entre países
- **low_competition**: Producto con pocas reviews pero alta demanda
- **high_demand**: Trend score >70 y tendencia "rising"
- **supply_gap**: Disponible en un país pero no en otros
- **regional_trend**: Tendencia fuerte solo en un país específico

### 4. Scoring de Oportunidad (0-100)
Fórmula sugerida:
```
score = (ventas_weight * ventas_normalized) +
        (rating_weight * rating_normalized) +
        (trend_weight * trend_score_normalized) +
        (gap_weight * num_gaps) +
        (price_variance_weight * price_variance)

Pesos sugeridos: ventas=30, rating=15, trend=20, gaps=25, price_variance=10
```

### 5. Selección Top 50+
- Ordenar por opportunity_score descendente
- Seleccionar mínimo 50 productos
- Incluir al menos 5 categorías diferentes
- Generar insights textuales (top 5-10 observaciones)

## Output
- Archivo: `outputs/processed/analysis_report_{YYYYMMDD}.json`
- Schema: `AnalysisReport` de `schemas/analysis_report.py`
