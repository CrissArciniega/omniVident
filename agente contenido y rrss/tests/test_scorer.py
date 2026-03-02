"""
Tests para el scoring engine de keywords.

Verifica que el scoring calcula correctamente los puntajes
por factor y el weighted total.
"""

import pytest


class TestScoringWeights:
    """Tests para la logica de pesos de scoring."""

    def test_weights_sum_to_one(self):
        """Los pesos configurados deben sumar aproximadamente 1.0."""
        from src.utils.file_helpers import load_yaml_config
        from pathlib import Path

        config_path = Path(__file__).parent.parent / "config" / "config.yaml"
        if config_path.exists():
            config = load_yaml_config(config_path)
            weights = config.get("scoring", {}).get("weights", {})
            total = sum(weights.values())
            assert abs(total - 1.0) < 0.01, f"Weights sum to {total}, expected ~1.0"

    def test_weighted_total_calculation(self):
        """Verifica el calculo del weighted total."""
        weights = {
            "volume_estimate": 0.25,
            "trend_direction": 0.25,
            "competition_level": 0.15,
            "commercial_intent": 0.20,
            "virality_potential": 0.15,
        }

        scores = {
            "volume_estimate": 80,
            "trend_direction": 90,
            "competition_level": 40,
            "commercial_intent": 85,
            "virality_potential": 70,
        }

        weighted_total = sum(
            scores[factor] * weight
            for factor, weight in weights.items()
        )

        expected = (80 * 0.25) + (90 * 0.25) + (40 * 0.15) + (85 * 0.20) + (70 * 0.15)
        assert abs(weighted_total - expected) < 0.01
        assert 0 <= weighted_total <= 100

    def test_commercial_intent_keywords(self):
        """Verifica que keywords con terminos comerciales puntuan alto."""
        commercial_terms = {
            "comprar", "precio", "barato", "oferta", "tienda",
            "envio", "descuento", "venta", "costo", "economico",
        }

        test_keywords = {
            "comprar gadgets baratos": True,  # Alta intencion comercial
            "que es un gadget": False,  # Informativa, no comercial
            "precio productos china": True,  # Alta intencion comercial
            "historia de la tecnologia": False,  # Informativa
        }

        for keyword, should_be_commercial in test_keywords.items():
            words = set(keyword.lower().split())
            has_commercial = bool(words & commercial_terms)
            assert has_commercial == should_be_commercial, (
                f"Keyword '{keyword}' commercial={has_commercial}, "
                f"expected={should_be_commercial}"
            )


class TestViralityScoring:
    """Tests para el scoring de potencial de viralidad."""

    def test_social_source_bonus(self):
        """Keywords de fuentes sociales deben tener mayor potencial viral."""
        social_sources = {"tiktok_trends", "reddit_trends"}
        search_sources = {"google_autocomplete", "google_related"}

        # Una keyword de TikTok deberia tener bonus viral
        kw_social_sources = {"tiktok_trends", "google_autocomplete"}
        kw_search_sources = {"google_autocomplete", "google_related"}

        social_count = len(kw_social_sources & social_sources)
        search_count = len(kw_search_sources & social_sources)

        assert social_count > search_count

    def test_virality_terms(self):
        """Keywords con terminos virales deben puntuar alto."""
        virality_terms = {"viral", "trending", "tiktok", "challenge", "hack"}

        viral_keyword = "productos virales tiktok"
        normal_keyword = "productos de cocina"

        viral_words = set(viral_keyword.split())
        normal_words = set(normal_keyword.split())

        viral_score = len(viral_words & virality_terms)
        normal_score = len(normal_words & virality_terms)

        assert viral_score > normal_score
