"""
Tests para el scraper de Google Autocomplete.

Usa responses para mockear las peticiones HTTP.
"""

import json
import pytest
import responses

from src.phase1_keywords.google_autocomplete import (
    GoogleAutocompleteScraper,
    AUTOCOMPLETE_URL,
)
from src.utils.json_schemas import KeywordSource


class TestGoogleAutocompleteScraper:
    """Tests para GoogleAutocompleteScraper con respuestas mockeadas."""

    @responses.activate
    def test_basic_suggestions(self):
        """Verifica que se extraen sugerencias correctamente."""
        mock_response = json.dumps([
            "gadgets baratos",
            [
                "gadgets baratos aliexpress",
                "gadgets baratos amazon",
                "gadgets baratos para el hogar",
                "gadgets baratos 2026",
            ],
        ])

        responses.add(
            responses.GET,
            AUTOCOMPLETE_URL,
            body=mock_response,
            status=200,
        )

        scraper = GoogleAutocompleteScraper(config={
            "expand_with_alphabet": False,
            "delay_between_requests": 0,
        })
        keywords = scraper.fetch(["gadgets baratos"])

        assert len(keywords) == 4
        assert all(kw.source == KeywordSource.GOOGLE_AUTOCOMPLETE for kw in keywords)
        assert keywords[0].keyword == "gadgets baratos aliexpress"

    @responses.activate
    def test_deduplication(self):
        """Verifica que no se repiten keywords."""
        mock_response = json.dumps([
            "test",
            [
                "gadgets baratos",
                "gadgets baratos",  # Duplicado
                "otro gadget",
            ],
        ])

        # Registrar multiples respuestas para multiples seeds
        responses.add(
            responses.GET,
            AUTOCOMPLETE_URL,
            body=mock_response,
            status=200,
        )
        responses.add(
            responses.GET,
            AUTOCOMPLETE_URL,
            body=mock_response,
            status=200,
        )

        scraper = GoogleAutocompleteScraper(config={
            "expand_with_alphabet": False,
            "delay_between_requests": 0,
        })
        keywords = scraper.fetch(["seed1", "seed2"])

        # No debe haber duplicados
        keyword_texts = [kw.keyword for kw in keywords]
        assert len(keyword_texts) == len(set(keyword_texts))

    @responses.activate
    def test_empty_response(self):
        """Verifica manejo de respuesta vacia."""
        mock_response = json.dumps(["test", []])

        responses.add(
            responses.GET,
            AUTOCOMPLETE_URL,
            body=mock_response,
            status=200,
        )

        scraper = GoogleAutocompleteScraper(config={
            "expand_with_alphabet": False,
            "delay_between_requests": 0,
        })
        keywords = scraper.fetch(["test"])

        assert len(keywords) == 0

    @responses.activate
    def test_metadata_tracking(self):
        """Verifica que la metadata se registra correctamente."""
        mock_response = json.dumps([
            "gadgets",
            ["gadgets baratos", "gadgets utiles"],
        ])

        responses.add(
            responses.GET,
            AUTOCOMPLETE_URL,
            body=mock_response,
            status=200,
        )

        scraper = GoogleAutocompleteScraper(config={
            "expand_with_alphabet": False,
            "delay_between_requests": 0,
        })
        keywords = scraper.fetch(["gadgets"])

        assert keywords[0].metadata.parent_seed == "gadgets"
        assert keywords[0].metadata.position_in_source is not None
        assert keywords[0].language == "es"


class TestGoogleAutocompleteConfig:
    """Tests para la configuracion del scraper."""

    def test_default_config(self):
        scraper = GoogleAutocompleteScraper()
        assert scraper.language == "es"
        assert scraper.expand_with_alphabet is True

    def test_custom_config(self):
        scraper = GoogleAutocompleteScraper(config={
            "language": "pt",
            "expand_with_alphabet": False,
            "delay_between_requests": 5.0,
        })
        assert scraper.language == "pt"
        assert scraper.expand_with_alphabet is False
