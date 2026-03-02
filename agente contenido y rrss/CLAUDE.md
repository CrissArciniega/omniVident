# Agente Contenido y RRSS - Instrucciones del Proyecto

## Descripcion General
Pipeline multi-fase de agentes de IA que genera contenido en espanol (LATAM) para redes sociales y blog.
El negocio vende articulos novedosos importados de China (gadgets, hogar, belleza, cocina, juguetes, etc.)
dirigido al mercado latinoamericano.

## Arquitectura
- **5 fases**: keyword research -> ranking -> script writing -> design briefs + thumbnails -> upload Google Drive
- **7 agentes**: orchestrator, keyword-researcher, keyword-ranker, script-writer, design-brief-generator, thumbnail-generator, drive-uploader
- Los agentes se comunican via archivos JSON en el directorio `output/`
- Todo el contenido debe estar en **ESPANOL LATAM** (no espanol de Espana)
- Solo usar herramientas y APIs **GRATUITAS**
- Ejecucion **100% automatica** sin checkpoints humanos

## Convenciones de Codigo
- **Python 3.11+** con type hints obligatorios
- **Pydantic v2** para todos los schemas de datos (ver `src/utils/json_schemas.py`)
- Rutas de archivos siempre con `pathlib.Path`, nunca concatenacion de strings
- Logging via `src/utils/logger.py` — **nunca usar print()**
- Peticiones HTTP via `src/utils/http_client.py` — **nunca usar requests directamente**
- Reintentos via decorator `@retry` de `src/utils/retry.py`
- Configuracion en `config/config.yaml` — **nunca hardcodear valores**
- Secretos en archivo `.env` — **nunca commitear credenciales**
- Nombres de variables y funciones en ingles, comentarios y contenido generado en espanol

## Protocolo de Intercambio de Datos
- Fase N lee de `output/phase{N-1}_*/`
- Fase N escribe a `output/phase{N}_*/`
- Estado del pipeline en `output/pipeline_state.json`
- Todo JSON de salida debe validar contra schemas en `src/utils/json_schemas.py`

## Manejo de Errores
- Todas las fases deben capturar excepciones y logearlas
- Fallos individuales (1 keyword, 1 fuente) NO deben detener la fase completa
- Reintentar errores transitorios (red, rate limit) hasta 3 veces con backoff exponencial
- Actualizar `pipeline_state.json` en cada transicion de fase

## Estructura de Archivos Clave
- `config/config.yaml` — Configuracion principal (seeds, weights, APIs)
- `config/platforms.yaml` — Especificaciones por plataforma
- `config/prompts/*.md` — Templates de prompts para generacion de contenido
- `src/utils/json_schemas.py` — Todos los modelos Pydantic
- `src/pipeline.py` — Orquestacion principal
- `output/` — Directorio de intercambio entre agentes

## Plataformas Objetivo
1. **TikTok** — Scripts 15-60s, hook en 3s, CTA, tono informal
2. **Facebook** — Posts de engagement, formato largo, emocional
3. **Instagram** — Caption + 30 hashtags + script carousel/reel
4. **YouTube** — Script completo con timestamps, descripcion SEO, tags
5. **Blog** — Articulo SEO 800-1500 palabras, meta tags, headings
