"""
Modelos Pydantic v2 para intercambio de datos entre agentes.

Define todos los schemas utilizados por las 5 fases del pipeline.
Cada agente valida sus inputs y outputs contra estos modelos.

Uso:
    from src.utils.json_schemas import KeywordsRawCollection, TopKeywordsCollection

    # Validar datos de Phase 1
    raw_data = KeywordsRawCollection.model_validate(json_data)

    # Serializar datos de Phase 2
    json_str = top_keywords.model_dump_json(indent=2)
"""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


# =============================================================================
# ENUMS
# =============================================================================


class PhaseStatusEnum(str, Enum):
    """Estados posibles de una fase del pipeline."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class PipelineStatusEnum(str, Enum):
    """Estados posibles del pipeline completo."""
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class TrendDirection(str, Enum):
    """Direccion de tendencia de una keyword."""
    RISING = "rising"
    STABLE = "stable"
    DECLINING = "declining"
    NEW = "new"


class Platform(str, Enum):
    """Plataformas de contenido soportadas."""
    TIKTOK = "tiktok"
    FACEBOOK = "facebook"
    INSTAGRAM = "instagram"
    YOUTUBE = "youtube"
    BLOG = "blog"


# =============================================================================
# PHASE 1: KEYWORD RESEARCH - SCHEMAS
# =============================================================================


class KeywordSource(str, Enum):
    """Fuentes de keywords soportadas."""
    GOOGLE_TRENDS = "google_trends"
    GOOGLE_AUTOCOMPLETE = "google_autocomplete"
    YOUTUBE_AUTOCOMPLETE = "youtube_autocomplete"
    TIKTOK_TRENDS = "tiktok_trends"
    PEOPLE_ALSO_ASK = "people_also_ask"
    REDDIT_TRENDS = "reddit_trends"
    GOOGLE_RELATED = "google_related"
    PERPLEXITY_TRENDS = "perplexity_trends"


class KeywordMetadata(BaseModel):
    """Metadata adicional de una keyword cruda."""
    position_in_source: int | None = None
    parent_seed: str | None = None
    collected_at: datetime = Field(default_factory=lambda: datetime.utcnow())
    extra: dict[str, Any] = Field(default_factory=dict)


class KeywordRaw(BaseModel):
    """Keyword cruda recopilada de una fuente."""
    keyword: str
    source: KeywordSource
    language: str = "es"
    raw_score: float | None = None
    metadata: KeywordMetadata = Field(default_factory=KeywordMetadata)


class Phase1Metadata(BaseModel):
    """Metadata de la ejecucion de Phase 1."""
    generated_at: datetime = Field(default_factory=lambda: datetime.utcnow())
    pipeline_run_id: str
    seed_keywords: list[str]
    sources_attempted: int
    sources_succeeded: int
    sources_failed: list[str] = Field(default_factory=list)
    total_keywords_collected: int


class KeywordsRawCollection(BaseModel):
    """Output de Phase 1: coleccion de keywords crudas."""
    metadata: Phase1Metadata
    keywords: list[KeywordRaw]

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "metadata": {
                        "generated_at": "2026-02-09T14:30:00Z",
                        "pipeline_run_id": "run_20260209_143000",
                        "seed_keywords": ["gadgets baratos"],
                        "sources_attempted": 8,
                        "sources_succeeded": 7,
                        "sources_failed": ["tiktok_trends"],
                        "total_keywords_collected": 342,
                    },
                    "keywords": [
                        {
                            "keyword": "gadgets baratos aliexpress",
                            "source": "google_autocomplete",
                            "language": "es",
                        }
                    ],
                }
            ]
        }
    }


# =============================================================================
# PHASE 2: KEYWORD RANKING - SCHEMAS
# =============================================================================


class KeywordScores(BaseModel):
    """Puntuaciones individuales de una keyword (0-100 cada una)."""
    volume_estimate: float = Field(ge=0, le=100)
    trend_direction: float = Field(ge=0, le=100)
    competition_level: float = Field(ge=0, le=100)
    commercial_intent: float = Field(ge=0, le=100)
    virality_potential: float = Field(ge=0, le=100)


class TrendData(BaseModel):
    """Datos de tendencia de una keyword."""
    direction: TrendDirection
    growth_percentage: float | None = None


class ScoredKeyword(BaseModel):
    """Keyword rankeada con scores por factor."""
    rank: int = Field(ge=1)
    keyword: str
    slug: str
    scores: KeywordScores
    weighted_total: float = Field(ge=0, le=100)
    sources_found_in: list[str]
    source_count: int = Field(ge=1)
    trend_data: TrendData | None = None


class ScoringWeights(BaseModel):
    """Pesos usados para el scoring (deben sumar ~1.0)."""
    volume_estimate: float
    trend_direction: float
    competition_level: float
    commercial_intent: float
    virality_potential: float


class Phase2Metadata(BaseModel):
    """Metadata de la ejecucion de Phase 2."""
    generated_at: datetime = Field(default_factory=lambda: datetime.utcnow())
    pipeline_run_id: str
    total_raw_keywords: int
    after_deduplication: int
    scoring_weights: ScoringWeights


class TopKeywordsCollection(BaseModel):
    """Output de Phase 2: top 10 keywords rankeadas."""
    metadata: Phase2Metadata
    top_keywords: list[ScoredKeyword]


# =============================================================================
# PHASE 3: SCRIPT WRITING - SCHEMAS
# =============================================================================


class ScriptMetadata(BaseModel):
    """Metadata comun para todo script generado."""
    keyword: str
    keyword_slug: str
    platform: Platform
    generated_at: datetime = Field(default_factory=lambda: datetime.utcnow())
    pipeline_run_id: str


class TikTokContent(BaseModel):
    """Contenido generado para TikTok."""
    hook: str
    script_body: str
    cta: str
    full_script: str
    duration_seconds: int = Field(ge=15, le=60)
    format_suggestion: str
    trending_sound_suggestion: str | None = None
    hashtags: list[str]
    caption: str


class TikTokScript(BaseModel):
    """Output completo para un video de TikTok."""
    metadata: ScriptMetadata
    content: TikTokContent


class FacebookContent(BaseModel):
    """Contenido generado para Facebook."""
    hook: str
    body: str
    engagement_hooks: list[str]
    cta: str
    full_post: str
    hashtags: list[str]
    suggested_image_description: str | None = None


class FacebookPost(BaseModel):
    """Output completo para un post de Facebook."""
    metadata: ScriptMetadata
    content: FacebookContent


class InstagramContent(BaseModel):
    """Contenido generado para Instagram."""
    hook: str
    caption: str
    hashtags_high_volume: list[str] = Field(min_length=10, max_length=10)
    hashtags_medium_volume: list[str] = Field(min_length=10, max_length=10)
    hashtags_niche: list[str] = Field(min_length=10, max_length=10)
    all_hashtags: list[str] = Field(min_length=30, max_length=30)
    carousel_outline: list[str] | None = None
    reel_script: str | None = None
    cta: str


class InstagramCaption(BaseModel):
    """Output completo para Instagram."""
    metadata: ScriptMetadata
    content: InstagramContent


class YouTubeSection(BaseModel):
    """Seccion individual de un script de YouTube."""
    timestamp: str
    title: str
    script: str


class YouTubeContent(BaseModel):
    """Contenido generado para YouTube."""
    title: str = Field(max_length=100)
    hook: str
    intro: str
    body_sections: list[YouTubeSection]
    cta: str
    full_script: str
    description: str = Field(max_length=5000)
    tags: list[str] = Field(max_length=15)
    timestamps_text: str


class YouTubeScript(BaseModel):
    """Output completo para un video de YouTube."""
    metadata: ScriptMetadata
    content: YouTubeContent


class InternalLink(BaseModel):
    """Sugerencia de link interno para blog."""
    anchor_text: str
    suggested_url_slug: str


class BlogContent(BaseModel):
    """Contenido generado para Blog."""
    meta_title: str = Field(max_length=60)
    meta_description: str = Field(max_length=160)
    focus_keyword: str
    word_count: int = Field(ge=800, le=1500)
    article_markdown: str
    headings: list[str]
    internal_linking_suggestions: list[InternalLink]
    image_suggestions: list[str] | None = None


class BlogArticle(BaseModel):
    """Output completo para un articulo de Blog."""
    metadata: ScriptMetadata
    content: BlogContent


# =============================================================================
# PHASE 4: DESIGN BRIEF - SCHEMAS
# =============================================================================


class Dimensions(BaseModel):
    """Dimensiones de imagen."""
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    unit: str = "px"


class ColorPalette(BaseModel):
    """Paleta de colores para diseno."""
    primary: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")
    secondary: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")
    accent: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")
    text_primary: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")
    text_secondary: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")


class Typography(BaseModel):
    """Especificaciones de tipografia."""
    headline_font: str
    body_font: str
    headline_size: str
    body_size: str


class Composition(BaseModel):
    """Especificaciones de composicion visual."""
    layout: str
    focal_point: str
    background_style: str


class TextOverlay(BaseModel):
    """Texto superpuesto en la imagen."""
    text: str
    position: str
    style: str
    max_width_percent: int = Field(ge=0, le=100)


class DesignSpec(BaseModel):
    """Especificaciones completas de diseno."""
    dimensions: Dimensions
    color_palette: ColorPalette
    typography: Typography
    composition: Composition
    text_overlays: list[TextOverlay]
    image_generation_prompt: str
    visual_style: str


class DesignBriefMetadata(BaseModel):
    """Metadata del design brief."""
    keyword: str
    keyword_slug: str
    platform: Platform
    generated_at: datetime = Field(default_factory=lambda: datetime.utcnow())


class DesignBrief(BaseModel):
    """Output completo de un design brief."""
    metadata: DesignBriefMetadata
    design_brief: DesignSpec


# =============================================================================
# PIPELINE STATE - SCHEMAS
# =============================================================================


class PhaseState(BaseModel):
    """Estado de una fase individual del pipeline."""
    status: PhaseStatusEnum = PhaseStatusEnum.PENDING
    started_at: datetime | None = None
    completed_at: datetime | None = None
    duration_seconds: float | None = None
    output_file: str | None = None
    errors: list[str] = Field(default_factory=list)
    extra: dict[str, Any] = Field(default_factory=dict)


class PipelineState(BaseModel):
    """Estado completo del pipeline."""
    pipeline_run_id: str
    started_at: datetime = Field(default_factory=lambda: datetime.utcnow())
    current_phase: str | None = None
    status: PipelineStatusEnum = PipelineStatusEnum.RUNNING
    phases: dict[str, PhaseState] = Field(
        default_factory=lambda: {
            "phase1": PhaseState(),
            "phase2": PhaseState(),
            "phase3": PhaseState(),
            "phase4": PhaseState(),
            "phase5": PhaseState(),
        }
    )
    last_updated: datetime = Field(default_factory=lambda: datetime.utcnow())
