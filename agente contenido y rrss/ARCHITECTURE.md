# Arquitectura del Pipeline de Contenido

## Diagrama de Flujo General

```
SCHEDULER (APScheduler, cada 2 semanas)
    |
    v
ORCHESTRATOR ---- coordina fases 1-5 secuencialmente
    |
    |---> PHASE 1: keyword-researcher
    |       Scraping 8 fuentes gratuitas
    |       Output: output/phase1_raw/keywords_raw.json
    |
    |---> PHASE 2: keyword-ranker
    |       Dedup + scoring 5 factores + top 10
    |       Output: output/phase2_ranked/top_keywords.json
    |
    |---> PHASE 3: script-writer
    |       10 keywords x 5 plataformas = 50 contenidos
    |       Output: output/phase3_scripts/{keyword}/{platform}.json
    |
    |---> PHASE 4a: design-brief-generator
    |       Briefs de diseno por keyword/plataforma
    |       Output: output/phase4_designs/{keyword}/{platform}_brief.json
    |
    |---> PHASE 4b: thumbnail-generator
    |       Generacion de imagenes con IA
    |       Output: output/phase4_designs/{keyword}/{platform}_thumbnail.png
    |
    |---> PHASE 5: drive-uploader
            Save local + upload Google Drive
            Output: output/phase5_final/ + Google Drive
```

## Descripcion de Cada Agente

### 1. orchestrator
- **Fase:** Todas
- **Rol:** Coordina la ejecucion secuencial de las 5 fases
- **Model:** inherit
- **Tools:** Read, Write, Edit, Bash, Glob, Grep
- **Responsabilidades:**
  - Ejecutar `python src/phase1_keywords/collector.py`
  - Verificar que cada fase genero su output correctamente
  - Actualizar `output/pipeline_state.json` despues de cada fase
  - Reintentar fases fallidas hasta 3 veces
  - Detener el pipeline si una fase falla definitivamente
- **System Prompt:** Eres el coordinador del pipeline de generacion de contenido en espanol para productos novedosos importados de China. Tu trabajo es ejecutar las 5 fases en secuencia, verificar outputs, manejar errores y actualizar el estado del pipeline.

### 2. keyword-researcher
- **Fase:** 1
- **Rol:** Investigacion de keywords en 8 fuentes gratuitas
- **Model:** sonnet
- **Tools:** Read, Write, Bash, Glob, Grep
- **Input:** `config/config.yaml` (seed_keywords)
- **Output:** `output/phase1_raw/keywords_raw.json`
- **Fuentes que scrapeara:**
  1. Google Trends (trendspyg, geo="MX")
  2. Google Autocomplete (endpoint publico, hl=es)
  3. YouTube Autocomplete (suggestqueries.google.com)
  4. TikTok Trending (scraping HTML)
  5. People Also Ask (scraping Google SERP)
  6. Reddit Trends (API publica JSON)
  7. Google Related Searches (scraping SERP)
  8. Perplexity AI (free tier API)
- **System Prompt:** Eres un especialista en investigacion de keywords para mercados hispanohablantes (LATAM). Investigas keywords relacionadas con productos novedosos importados de China en 8 fuentes gratuitas. Todas las keywords deben estar en ESPANOL. Ejecuta los scripts de Python en `src/phase1_keywords/` y recopila los resultados en `output/phase1_raw/`. Si una fuente falla, logea el error y continua con las demas.

### 3. keyword-ranker
- **Fase:** 2
- **Rol:** Deduplicacion, scoring y seleccion de top 10
- **Model:** sonnet
- **Tools:** Read, Write, Bash, Glob, Grep
- **Input:** `output/phase1_raw/keywords_raw.json`
- **Output:** `output/phase2_ranked/top_keywords.json`
- **Factores de Scoring (config/config.yaml):**
  - volume_estimate (0.25) - Estimacion de volumen de busqueda
  - trend_direction (0.25) - Tendencia creciente/decreciente
  - competition_level (0.15) - Nivel de competencia (invertido)
  - commercial_intent (0.20) - Intencion comercial de compra
  - virality_potential (0.15) - Potencial de viralidad en RRSS
- **System Prompt:** Eres un especialista en analisis de keywords. Toma las keywords crudas de `output/phase1_raw/keywords_raw.json`, deduplicalas usando fuzzy matching, puntua cada keyword en 5 factores y selecciona las TOP 10. Ejecuta `python src/phase2_ranking/ranker.py` y guarda el resultado en `output/phase2_ranked/top_keywords.json`.

### 4. script-writer
- **Fase:** 3
- **Rol:** Generacion de contenido para 5 plataformas
- **Model:** opus (requiere alta calidad creativa)
- **Tools:** Read, Write, Bash, Glob, Grep
- **Input:** `output/phase2_ranked/top_keywords.json`, `config/prompts/*.md`
- **Output:** `output/phase3_scripts/{keyword_slug}/{platform}.json`
- **Plataformas:**
  - **TikTok:** Script 15-60s, hook en 3s, CTA, tono informal LATAM
  - **Facebook:** Post de engagement, emocional, preguntas, compartible
  - **Instagram:** Caption (2200 chars) + 30 hashtags + script carousel/reel
  - **YouTube:** Script completo con timestamps, descripcion SEO (5000 chars), 15 tags
  - **Blog:** Articulo SEO 800-1500 palabras, meta title, meta description, H2/H3
- **System Prompt:** Eres un creador de contenido experto en espanol LATAM para productos novedosos importados de China. Para cada uno de los top 10 keywords, genera contenido para 5 plataformas usando los templates en `config/prompts/`. Todo en ESPANOL coloquial LATAM. Ejecuta `python src/phase3_scripts/script_generator.py`.

### 5. design-brief-generator
- **Fase:** 4a
- **Rol:** Creacion de especificaciones de diseno visual
- **Model:** sonnet
- **Tools:** Read, Write, Bash, Glob, Grep
- **Input:** `output/phase3_scripts/`, `config/platforms.yaml`
- **Output:** `output/phase4_designs/{keyword_slug}/{platform}_brief.json`
- **Incluye por brief:**
  - Dimensiones exactas por plataforma
  - Paleta de colores (hex codes)
  - Tipografia sugerida
  - Layout y composicion
  - Texto overlay y posicionamiento
  - Prompt para generacion de imagen con IA
- **System Prompt:** Eres un especialista en diseno visual para redes sociales. Para cada combinacion keyword/plataforma, crea un brief de diseno detallado con dimensiones, colores, tipografia, composicion y texto overlay. Carga specs de `config/platforms.yaml`. Guarda briefs en `output/phase4_designs/`.

### 6. thumbnail-generator
- **Fase:** 4b
- **Rol:** Generacion de imagenes con IA
- **Model:** sonnet
- **Tools:** Read, Write, Bash, Glob, Grep
- **Input:** `output/phase4_designs/{keyword_slug}/{platform}_brief.json`
- **Output:** `output/phase4_designs/{keyword_slug}/{platform}_thumbnail.png`
- **APIs de Generacion (gratuitas):**
  - **Primaria:** Together AI FLUX.1-schnell-Free
  - **Fallback:** Pixazo (Stable Diffusion)
- **System Prompt:** Eres un especialista en generacion de imagenes con IA. Lee los briefs de `output/phase4_designs/` y genera thumbnails usando Together AI FLUX.1 (gratuito). Si falla, usa Pixazo como fallback. Ejecuta `python src/phase4_design/image_generator.py`. Guarda imagenes como PNG.

### 7. drive-uploader
- **Fase:** 5
- **Rol:** Organizacion local y subida a Google Drive
- **Model:** haiku (tarea simple de I/O)
- **Tools:** Read, Write, Bash, Glob, Grep
- **Input:** Todo el directorio `output/`
- **Output:** `output/phase5_final/`, Google Drive
- **Estructura en Drive:**
  ```
  Content Pipeline/
  └── 2026-02-09/
      └── gadgets-baratos/
          ├── tiktok/
          │   ├── script.json
          │   ├── brief.json
          │   └── thumbnail.png
          ├── facebook/
          ├── instagram/
          ├── youtube/
          └── blog/
  ```
- **System Prompt:** Eres un especialista en gestion de archivos. Ejecuta `python src/phase5_output/local_saver.py` para crear copias locales organizadas, luego `python src/phase5_output/drive_uploader.py` para subir todo a Google Drive usando PyDrive2. Verifica que los uploads se completaron y logea las URLs.

## Flujo de Datos Detallado

### Phase 1 -> Phase 2
```
keywords_raw.json contiene ~300-500 keywords crudas de 8 fuentes
  |
  v
keyword-ranker lee este archivo, deduplica (~200 unicas),
puntua con 5 factores, y exporta top_keywords.json con las 10 mejores
```

### Phase 2 -> Phase 3
```
top_keywords.json contiene 10 keywords rankeadas con scores
  |
  v
script-writer itera cada keyword, carga el template de prompt
correspondiente a cada plataforma, genera contenido, y guarda
50 archivos JSON (10 keywords x 5 plataformas)
```

### Phase 3 -> Phase 4
```
Los 50 archivos de scripts sirven como contexto para los briefs
  |
  v
design-brief-generator lee cada script para extraer temas/titulos,
combina con specs de plataforma, y genera 50 briefs de diseno
  |
  v
thumbnail-generator lee cada brief, construye el prompt de IA,
llama a Together AI, y guarda 50 imagenes PNG
```

### Phase 4 -> Phase 5
```
Todos los outputs (keywords, scripts, briefs, thumbnails)
  |
  v
drive-uploader organiza en estructura local limpia (Markdown + JSON),
crea carpetas en Google Drive por fecha/keyword/plataforma,
y sube todos los archivos
```

## Orden Recomendado para Crear Agentes

### Pre-requisitos (antes de crear agentes)
1. Verificar que todos los archivos de `src/utils/` estan creados
2. Verificar que `config/config.yaml` y `config/platforms.yaml` existen
3. Verificar que `config/prompts/` tiene los 5 templates
4. Ejecutar `pip install -r requirements.txt`
5. Configurar `.env` con las API keys

### Orden de Creacion
1. **keyword-researcher** - Es independiente, solo necesita config + utils
2. **keyword-ranker** - Depende del output de Phase 1
3. **script-writer** - Depende del output de Phase 2
4. **design-brief-generator** - Depende del output de Phase 3
5. **thumbnail-generator** - Depende del output de Phase 4a
6. **drive-uploader** - Depende de todos los outputs
7. **orchestrator** - Coordinador final, crear al ultimo

### Como Crear (via Claude Code CLI)

```bash
# 1. Abrir Claude Code en el directorio del proyecto
cd "agente contenido y rrss"
claude

# 2. Para cada agente, usar el comando /agents
/agents
# -> Seleccionar "Create new agent"
# -> Seleccionar "Project-level"
# -> Configurar nombre, descripcion, tools, model y system prompt
#    segun las definiciones de este documento

# 3. Verificar que todos los agentes estan cargados
/agents
# Deberia mostrar los 7 agentes
```

## Estado del Pipeline (pipeline_state.json)

El archivo `output/pipeline_state.json` rastrea el progreso:

```json
{
  "pipeline_run_id": "run_YYYYMMDD_HHMMSS",
  "started_at": "ISO-8601",
  "current_phase": "phase1|phase2|phase3|phase4|phase5",
  "status": "running|completed|failed",
  "phases": {
    "phase1": {"status": "pending|running|completed|failed", ...},
    "phase2": {"status": "pending|running|completed|failed", ...},
    "phase3": {"status": "pending|running|completed|failed", ...},
    "phase4": {"status": "pending|running|completed|failed", ...},
    "phase5": {"status": "pending|running|completed|failed", ...}
  }
}
```
