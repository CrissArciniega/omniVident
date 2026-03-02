# Guía: Configurar Base de Datos de Notion

## La base de datos se crea automáticamente
El script de setup crea la base de datos "Weekly Market Research 2026" vía Notion MCP con todas las propiedades necesarias.

## Propiedades de la Base de Datos

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| Product Name | Title | Nombre del producto (campo principal) |
| Rank | Number | Posición en el ranking semanal (1-50+) |
| Category | Select | Categoría del producto |
| Opportunity Score | Number | Puntuación de oportunidad (0-100) |
| Week | Date | Semana del reporte |
| USA Price USD | Number | Precio en USA (USD) |
| MX Price USD | Number | Precio en México (convertido a USD) |
| EC Price USD | Number | Precio en Ecuador (USD) |
| CO Price USD | Number | Precio en Colombia (convertido a USD) |
| Price Range | Rich Text | Rango de precios "$min - $max" |
| Avg Rating | Number | Rating promedio (0-5) |
| Total Sales Est | Number | Estimación de ventas totales |
| Trend | Select | Tendencia de demanda (Rising/Stable/Declining) |
| Trend Score | Number | Score de Google Trends (0-100) |
| Market Gaps | Multi-select | Tipos de gap identificados |
| Gap Details | Rich Text | Descripción detallada de gaps |
| Top Country | Select | País con mejor rendimiento |
| Sources | Multi-select | Fuentes de datos |
| Product URLs | Rich Text | URLs de los productos |
| Status | Select | Estado de revisión (New/Reviewed/Actioned) |

## Después de Crear la BD

1. Copia el ID de la base de datos desde la URL de Notion
2. Actualiza `config/notion_config.json`:
   ```json
   {
     "database": {
       "id": "TU_DATABASE_ID_AQUI",
       ...
     }
   }
   ```

## Vistas Sugeridas

Crea estas vistas manualmente en Notion:
1. **Por Score** (default): Ordenado por Opportunity Score descendente
2. **Por Categoría**: Agrupado por Category
3. **Rising Trends**: Filtrado donde Trend = "Rising"
4. **Arbitraje**: Filtrado donde Market Gaps contiene "Price Arbitrage"
5. **Esta Semana**: Filtrado por Week = semana actual
