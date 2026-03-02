"""
Tests para los schemas Pydantic de intercambio de datos.

Verifica que todos los modelos validan correctamente datos
de ejemplo y rechazan datos invalidos.
"""

import pytest
from datetime import datetime, timezone

from src.utils.json_schemas import (
    KeywordRaw,
    KeywordSource,
    KeywordMetadata,
    KeywordsRawCollection,
    Phase1Metadata,
    ScoredKeyword,
    KeywordScores,
    TopKeywordsCollection,
    Phase2Metadata,
    ScoringWeights,
    TrendData,
    TrendDirection,
    DesignBrief,
    DesignSpec,
    DesignBriefMetadata,
    Dimensions,
    ColorPalette,
    Typography,
    Composition,
    TextOverlay,
    PipelineState,
    PhaseState,
    PhaseStatusEnum,
    PipelineStatusEnum,
    Platform,
    ScriptMetadata,
    TikTokScript,
    TikTokContent,
)


class TestKeywordRaw:
    """Tests para el modelo KeywordRaw."""

    def test_create_basic_keyword(self):
        kw = KeywordRaw(
            keyword="gadgets baratos",
            source=KeywordSource.GOOGLE_AUTOCOMPLETE,
        )
        assert kw.keyword == "gadgets baratos"
        assert kw.source == KeywordSource.GOOGLE_AUTOCOMPLETE
        assert kw.language == "es"
        assert kw.raw_score is None

    def test_create_keyword_with_metadata(self):
        kw = KeywordRaw(
            keyword="productos novedosos",
            source=KeywordSource.GOOGLE_TRENDS,
            raw_score=85.5,
            metadata=KeywordMetadata(
                position_in_source=1,
                parent_seed="productos",
            ),
        )
        assert kw.raw_score == 85.5
        assert kw.metadata.position_in_source == 1
        assert kw.metadata.parent_seed == "productos"

    def test_keyword_serialization(self):
        kw = KeywordRaw(
            keyword="test",
            source=KeywordSource.REDDIT_TRENDS,
        )
        data = kw.model_dump(mode="json")
        assert data["keyword"] == "test"
        assert data["source"] == "reddit_trends"


class TestKeywordsRawCollection:
    """Tests para la coleccion de keywords crudas (Phase 1 output)."""

    def test_create_collection(self):
        collection = KeywordsRawCollection(
            metadata=Phase1Metadata(
                pipeline_run_id="run_20260209_143000",
                seed_keywords=["gadgets baratos"],
                sources_attempted=8,
                sources_succeeded=7,
                sources_failed=["tiktok_trends"],
                total_keywords_collected=100,
            ),
            keywords=[
                KeywordRaw(
                    keyword="gadgets baratos aliexpress",
                    source=KeywordSource.GOOGLE_AUTOCOMPLETE,
                ),
            ],
        )
        assert collection.metadata.total_keywords_collected == 100
        assert len(collection.keywords) == 1

    def test_collection_serialization_roundtrip(self):
        collection = KeywordsRawCollection(
            metadata=Phase1Metadata(
                pipeline_run_id="test_run",
                seed_keywords=["test"],
                sources_attempted=1,
                sources_succeeded=1,
                total_keywords_collected=1,
            ),
            keywords=[
                KeywordRaw(keyword="test", source=KeywordSource.GOOGLE_TRENDS),
            ],
        )
        json_data = collection.model_dump(mode="json")
        restored = KeywordsRawCollection.model_validate(json_data)
        assert restored.metadata.pipeline_run_id == "test_run"
        assert restored.keywords[0].keyword == "test"


class TestScoredKeyword:
    """Tests para keywords rankeadas (Phase 2)."""

    def test_create_scored_keyword(self):
        kw = ScoredKeyword(
            rank=1,
            keyword="gadgets baratos",
            slug="gadgets-baratos",
            scores=KeywordScores(
                volume_estimate=85,
                trend_direction=90,
                competition_level=40,
                commercial_intent=88,
                virality_potential=75,
            ),
            weighted_total=78.5,
            sources_found_in=["google_trends", "google_autocomplete"],
            source_count=2,
        )
        assert kw.rank == 1
        assert kw.weighted_total == 78.5

    def test_scores_validation_range(self):
        with pytest.raises(Exception):
            KeywordScores(
                volume_estimate=150,  # > 100, debe fallar
                trend_direction=90,
                competition_level=40,
                commercial_intent=88,
                virality_potential=75,
            )

    def test_scores_negative_validation(self):
        with pytest.raises(Exception):
            KeywordScores(
                volume_estimate=-10,  # < 0, debe fallar
                trend_direction=90,
                competition_level=40,
                commercial_intent=88,
                virality_potential=75,
            )


class TestDesignBrief:
    """Tests para design briefs (Phase 4)."""

    def test_create_design_brief(self):
        brief = DesignBrief(
            metadata=DesignBriefMetadata(
                keyword="gadgets baratos",
                keyword_slug="gadgets-baratos",
                platform=Platform.YOUTUBE,
            ),
            design_brief=DesignSpec(
                dimensions=Dimensions(width=1280, height=720),
                color_palette=ColorPalette(
                    primary="#FF6B35",
                    secondary="#1A1A2E",
                    accent="#00D4FF",
                    text_primary="#FFFFFF",
                    text_secondary="#E0E0E0",
                ),
                typography=Typography(
                    headline_font="Montserrat Bold",
                    body_font="Open Sans",
                    headline_size="48px",
                    body_size="24px",
                ),
                composition=Composition(
                    layout="rule_of_thirds",
                    focal_point="center_right",
                    background_style="gradient_dark",
                ),
                text_overlays=[
                    TextOverlay(
                        text="GADGETS BARATOS",
                        position="top_left",
                        style="bold_outline",
                        max_width_percent=60,
                    ),
                ],
                image_generation_prompt="Professional YouTube thumbnail",
                visual_style="tech_modern",
            ),
        )
        assert brief.design_brief.dimensions.width == 1280
        assert brief.metadata.platform == Platform.YOUTUBE

    def test_color_hex_validation(self):
        with pytest.raises(Exception):
            ColorPalette(
                primary="not-a-color",  # Formato invalido
                secondary="#1A1A2E",
                accent="#00D4FF",
                text_primary="#FFFFFF",
                text_secondary="#E0E0E0",
            )


class TestPipelineState:
    """Tests para el estado del pipeline."""

    def test_initial_state(self):
        state = PipelineState(pipeline_run_id="test_run")
        assert state.status == PipelineStatusEnum.RUNNING
        assert len(state.phases) == 5
        assert all(
            p.status == PhaseStatusEnum.PENDING
            for p in state.phases.values()
        )

    def test_phase_transition(self):
        state = PipelineState(pipeline_run_id="test_run")
        state.phases["phase1"].status = PhaseStatusEnum.RUNNING
        assert state.phases["phase1"].status == PhaseStatusEnum.RUNNING
        assert state.phases["phase2"].status == PhaseStatusEnum.PENDING

    def test_state_serialization(self):
        state = PipelineState(pipeline_run_id="test_run")
        data = state.model_dump(mode="json")
        restored = PipelineState.model_validate(data)
        assert restored.pipeline_run_id == "test_run"


class TestTikTokScript:
    """Tests para el modelo de script de TikTok."""

    def test_create_tiktok_script(self):
        script = TikTokScript(
            metadata=ScriptMetadata(
                keyword="gadgets baratos",
                keyword_slug="gadgets-baratos",
                platform=Platform.TIKTOK,
                pipeline_run_id="test_run",
            ),
            content=TikTokContent(
                hook="Sabias que este gadget de $3...",
                script_body="Mira lo que encontre...",
                cta="Sigueme para mas!",
                full_script="Script completo aqui...",
                duration_seconds=30,
                format_suggestion="Unboxing",
                hashtags=["#gadgets", "#barato"],
                caption="Los mejores gadgets...",
            ),
        )
        assert script.content.duration_seconds == 30
        assert script.metadata.platform == Platform.TIKTOK

    def test_tiktok_duration_validation(self):
        with pytest.raises(Exception):
            TikTokContent(
                hook="test",
                script_body="test",
                cta="test",
                full_script="test",
                duration_seconds=120,  # > 60, debe fallar
                format_suggestion="test",
                hashtags=[],
                caption="test",
            )
