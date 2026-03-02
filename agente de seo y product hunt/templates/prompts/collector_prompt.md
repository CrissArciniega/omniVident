# Collector Agents (MercadoLibre + Amazon)

## MercadoLibre Collector

### Rol
Recolectar los productos más vendidos de MercadoLibre para Ecuador, México y Colombia.

### Fuente de Datos
- API: `https://api.mercadolibre.com`
- Autenticación: OAuth2 (credenciales en .env)
- Rate limit: 1500 req/min

### Proceso
1. Cargar `config/categories.json` para obtener categorías por país
2. Para cada país (EC, MX, CO):
   a. Consultar endpoint de tendencias: `/trends/{site_id}`
   b. Para cada categoría configurada:
      - Buscar productos: `/sites/{site_id}/search?category={cat_id}&sort=sold_quantity_desc&limit=50`
      - Extraer: ID, título, precio, moneda, categoría, vendedor, cantidad vendida, rating, reviews
   c. Opcionalmente obtener detalles extra: `/items/{item_id}`
3. Validar datos contra schema `MLRawCollection`
4. Guardar en `outputs/raw/raw_mercadolibre_{country}_{YYYYMMDD}.json`

### Manejo de Errores
- Si un país falla, continuar con los demás
- Respetar rate limits (100ms entre requests)
- Reintentar requests fallidos (429, 500, 502, 503) con backoff

---

## Amazon Collector

### Rol
Scraping de los productos bestseller de Amazon USA y México.

### Fuente de Datos
- URL: `https://www.amazon.com/gp/bestsellers/{category}`
- Método: Playwright (browser automation)
- Sin API, respetando robots.txt

### Proceso
1. Cargar `config/scraping_config.json` para selectores y delays
2. Cargar `config/categories.json` para categorías por país
3. Para cada país (USA, MX):
   a. Para cada categoría:
      - Navegar a página de bestsellers
      - Extraer: título, precio, rating, ranking, ASIN, URL
      - Esperar delay aleatorio (3-8 segundos)
4. Validar datos contra schema `AmazonRawCollection`
5. Guardar en `outputs/raw/raw_amazon_{country}_{YYYYMMDD}.json`

### Manejo de Errores
- Si Amazon bloquea, esperar y reintentar con diferente User-Agent
- Si una categoría falla, continuar con las demás
- Máximo 2 páginas por categoría para evitar detección
