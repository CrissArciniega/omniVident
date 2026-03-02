# Agente Contenido y RRSS

Pipeline automatizado de agentes de IA que investiga keywords, genera contenido para redes sociales y blog, crea briefs de diseno con miniaturas, y sube todo a Google Drive.

## Descripcion

Este sistema automatiza el ciclo completo de creacion de contenido para un negocio de venta de articulos novedosos importados de China, dirigido al mercado LATAM:

1. **Investigacion de Keywords** - Scraping de 8 fuentes gratuitas en espanol
2. **Ranking de Keywords** - Deduplicacion, scoring y seleccion de top 10
3. **Generacion de Guiones** - Scripts para TikTok, Facebook, Instagram, YouTube y Blog
4. **Diseno y Miniaturas** - Briefs de diseno + generacion de thumbnails con IA
5. **Subida a Google Drive** - Organizacion y upload automatico

## Requisitos Previos

- Python 3.11 o superior
- Cuenta gratuita en [Together AI](https://api.together.xyz/) (generacion de imagenes)
- Cuenta en [Perplexity AI](https://www.perplexity.ai/) (free tier)
- Proyecto en [Google Cloud](https://console.cloud.google.com/) con:
  - Google Drive API habilitada
  - Service Account creada con JSON key
  - Carpeta de Drive compartida con el email del service account

## Instalacion

```bash
# 1. Clonar o navegar al directorio del proyecto
cd "agente contenido y rrss"

# 2. Crear entorno virtual
python -m venv venv

# 3. Activar entorno virtual
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# 4. Instalar dependencias
pip install -r requirements.txt

# 5. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus API keys
```

## Configuracion

### Variables de Entorno (.env)

| Variable | Descripcion |
|----------|-------------|
| `TOGETHER_AI_API_KEY` | API key de Together AI para FLUX.1-schnell (imagenes) |
| `PIXAZO_API_KEY` | API key de Pixazo como fallback para imagenes |
| `PERPLEXITY_API_KEY` | API key de Perplexity AI (free tier) |
| `GOOGLE_SERVICE_ACCOUNT_FILE` | Ruta al JSON del service account |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | ID de la carpeta raiz en Google Drive |

### Archivos de Configuracion

- `config/config.yaml` - Configuracion principal: seed keywords, pesos de scoring, APIs, scheduling
- `config/platforms.yaml` - Especificaciones por plataforma: dimensiones, restricciones, tono

## Estructura del Proyecto

```
agente contenido y rrss/
├── config/                     # Configuraciones
│   ├── config.yaml             # Config principal
│   ├── platforms.yaml          # Specs por plataforma
│   └── prompts/                # Templates de prompts
├── src/                        # Codigo fuente
│   ├── pipeline.py             # Orquestacion principal
│   ├── scheduler.py            # Scheduler quincenal
│   ├── phase1_keywords/        # 8 scrapers de keywords
│   ├── phase2_ranking/         # Dedup + scoring + ranking
│   ├── phase3_scripts/         # 5 escritores de contenido
│   ├── phase4_design/          # Briefs + generacion de imagenes
│   ├── phase5_output/          # Local save + Google Drive upload
│   └── utils/                  # Utilidades compartidas
├── output/                     # Datos de intercambio entre agentes
├── credentials/                # Credenciales (NO commitear)
├── logs/                       # Archivos de log
├── tests/                      # Tests unitarios
├── .env.example                # Template de variables de entorno
├── requirements.txt            # Dependencias Python
├── CLAUDE.md                   # Instrucciones para Claude Code
├── ARCHITECTURE.md             # Documentacion de arquitectura
└── run_pipeline.py             # Entry point CLI
```

## Uso

### Ejecucion Manual

```bash
# Ejecutar pipeline completo
python run_pipeline.py --full

# Ejecutar una fase especifica
python run_pipeline.py --phase 1    # Solo keyword research
python run_pipeline.py --phase 2    # Solo ranking
python run_pipeline.py --phase 3    # Solo scripts
python run_pipeline.py --phase 4    # Solo diseno + thumbnails
python run_pipeline.py --phase 5    # Solo upload a Drive

# Ver estado del pipeline
python run_pipeline.py --status
```

### Ejecucion Automatica (Quincenal)

```bash
# Iniciar scheduler quincenal
python run_pipeline.py --schedule
```

### Via Claude Code (Agentes)

```bash
# Iniciar Claude Code en el directorio del proyecto
claude

# Ejecutar pipeline completo via orchestrator
> @orchestrator Ejecuta el pipeline completo de generacion de contenido

# Ejecutar una fase especifica
> @keyword-researcher Investiga keywords para esta quincena
> @keyword-ranker Rankea las keywords recopiladas
> @script-writer Genera los guiones para los top 10 keywords
> @design-brief-generator Crea los briefs de diseno
> @thumbnail-generator Genera las miniaturas
> @drive-uploader Sube todo a Google Drive
```

## Creacion de Agentes

Los agentes se crean manualmente desde la terminal de Claude Code. Ver `ARCHITECTURE.md` para los detalles de cada agente y el orden recomendado de creacion.

### Orden de Creacion

1. `keyword-researcher` - Fase 1
2. `keyword-ranker` - Fase 2
3. `script-writer` - Fase 3
4. `design-brief-generator` - Fase 4a
5. `thumbnail-generator` - Fase 4b
6. `drive-uploader` - Fase 5
7. `orchestrator` - Coordinador

### Comando para Crear Agentes

Dentro de Claude Code, usar el comando `/agents` y seleccionar "Create new agent" -> "Project-level".
Consultar `ARCHITECTURE.md` para el system prompt y configuracion de cada agente.

## Herramientas Gratuitas Utilizadas

| Herramienta | Uso | Acceso |
|-------------|-----|--------|
| Google Trends | Tendencias de busqueda | API no oficial (trendspyg) |
| Google Autocomplete | Sugerencias de busqueda | Endpoint publico |
| YouTube Autocomplete | Sugerencias de video | Endpoint publico |
| TikTok Trends | Hashtags tendencia | Web scraping |
| People Also Ask | Preguntas frecuentes | Web scraping SERP |
| Reddit | Tendencias sociales | API publica JSON |
| Google Related | Busquedas relacionadas | Web scraping SERP |
| Perplexity AI | Investigacion de tendencias | Free tier API |
| Together AI FLUX.1 | Generacion de imagenes | Free tier API |
| Google Drive | Almacenamiento de outputs | Service Account (gratis) |

## Testing

```bash
# Ejecutar todos los tests
pytest tests/ -v

# Ejecutar tests con coverage
pytest tests/ -v --cov=src --cov-report=html

# Ejecutar un test especifico
pytest tests/test_schemas.py -v
```
