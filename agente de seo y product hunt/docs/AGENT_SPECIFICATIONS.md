# Especificaciones de Agentes

## Orden de Creación Recomendado

1. `mercadolibre_collector` — Fuente principal, API estable
2. `amazon_collector` — Fuente secundaria, scraping más complejo
3. `trends_enricher` — Enriquecimiento opcional
4. `market_analyzer` — Necesita datos de collectors
5. `notion_publisher` — Necesita output del analyzer
6. `orchestrator` — Necesita todos los agentes funcionando

---

## 1. mercadolibre_collector

### Responsabilidad
Recolectar productos más vendidos de MercadoLibre para EC, MX, CO.

### Endpoints a usar
```
GET /sites/{site_id}/categories          → Lista categorías
GET /trends/{site_id}                    → Tendencias generales
GET /trends/{site_id}/{category_id}      → Tendencias por categoría
GET /sites/{site_id}/search?category={id}&sort=sold_quantity_desc&limit=50
GET /items/{item_id}                     → Detalles (opcional)
```

### Algoritmo
```python
for country in ["EC", "MX", "CO"]:
    site_id = config.site_ids[country]
    products = []
    for category_id, category_name in config.categories[country].items():
        results = search(site_id, category_id, sort="sold_quantity_desc", limit=50)
        products.extend(results)
    save_raw_data(products, "mercadolibre", country)
```

### Output esperado
- 3 archivos JSON (uno por país)
- ~100-500 productos por archivo (10 categorías x ~50 por cat, con dedup)

---

## 2. amazon_collector

### Responsabilidad
Scraping de bestsellers de Amazon USA y MX.

### Páginas target
```
https://www.amazon.com/gp/bestsellers/{category}
https://www.amazon.com.mx/gp/bestsellers/{category}
```

### Algoritmo
```python
for country in ["USA", "MX"]:
    domain = config.countries[country].amazon_domain
    products = []
    for category in config.categories.amazon[country]:
        url = f"https://www.{domain}/gp/bestsellers/{category}"
        page_data = scrape_with_playwright(url)
        products.extend(parse_products(page_data))
        sleep(random(3, 8))  # Anti-detección
    save_raw_data(products, "amazon", country)
```

### Consideraciones
- Usar Playwright en modo headless con stealth
- Rotar User-Agents de `config/scraping_config.json`
- Máximo 2 páginas por categoría
- Si detecta bloqueo, esperar 30s y reintentar con otro UA

---

## 3. trends_enricher

### Responsabilidad
Enriquecer productos con señales de demanda de Google Trends.

### Algoritmo
```python
raw_products = load_all_raw_files(today)
keywords = extract_unique_keywords(raw_products)  # Nombres de productos simplificados

for batch in chunk(keywords, 5):  # pytrends acepta hasta 5 keywords
    trend_data = pytrends.interest_over_time(batch, timeframe="today 3-m")
    for keyword in batch:
        score = calculate_trend_score(trend_data[keyword])
        trend = classify_trend(trend_data[keyword])  # rising/stable/declining
```

### Rate Limits
- pytrends: ~1 request cada 2 segundos
- Agrupar keywords en batches de 5

---

## 4. market_analyzer

### Responsabilidad
Análisis cruzado de precios, scoring de oportunidad, detección de gaps.

### Fórmula de Opportunity Score
```
score = (0.30 * normalize(sold_quantity)) +
        (0.15 * normalize(rating)) +
        (0.20 * normalize(trend_score)) +
        (0.25 * gap_count * 10) +
        (0.10 * price_variance * 100)

Donde normalize(x) = (x - min) / (max - min) * 100
```

### Tipos de Market Gaps
| Tipo | Condición |
|------|-----------|
| `price_arbitrage` | Diferencia precio >20% entre países |
| `low_competition` | Reviews <100 pero ventas >500 |
| `high_demand` | Trend score >70 AND trend = "rising" |
| `supply_gap` | Producto en 1-2 países pero no en todos |
| `regional_trend` | Trend score >60 solo en 1 país |

---

## 5. notion_publisher

### Responsabilidad
Crear/actualizar páginas en la base de datos de Notion.

### Mapeo de datos → Notion
Ver `config/notion_config.json` para el mapeo completo de propiedades.

### Batch processing
- Crear páginas en batches de 10
- Incluir página de resumen semanal con insights

---

## 6. orchestrator

### Responsabilidad
Coordinar la ejecución secuencial/paralela de todos los agentes.

### Estado (`config/state.json`)
```json
{
  "last_run": "2026-02-10T08:00:00",
  "last_status": "success",
  "agents_status": {
    "mercadolibre_collector": "success",
    "amazon_collector": "success",
    "trends_enricher": "success",
    "market_analyzer": "success",
    "notion_publisher": "success"
  },
  "products_published": 52,
  "errors": []
}
```
