"""
Tests para el modulo de deduplicacion de keywords.
"""

import pytest

from src.utils.text_utils import (
    normalize_keyword,
    to_slug,
    remove_spanish_stopwords,
    similarity_score,
    extract_potential_keywords,
    truncate_text,
    count_words,
    calculate_keyword_density,
)


class TestNormalizeKeyword:
    """Tests para la funcion normalize_keyword."""

    def test_basic_normalization(self):
        assert normalize_keyword("  Gadgets Baratos!! ") == "gadgets baratos"

    def test_accent_removal(self):
        assert normalize_keyword("tecnologia") == "tecnologia"
        assert normalize_keyword("Tecnología Avanzada") == "tecnologia avanzada"

    def test_special_characters(self):
        assert normalize_keyword("gadgets@#$%baratos") == "gadgets baratos"

    def test_multiple_spaces(self):
        assert normalize_keyword("gadgets   baratos   china") == "gadgets baratos china"

    def test_empty_string(self):
        assert normalize_keyword("") == ""

    def test_numbers_preserved(self):
        assert normalize_keyword("top 10 gadgets 2026") == "top 10 gadgets 2026"


class TestToSlug:
    """Tests para la funcion to_slug."""

    def test_basic_slug(self):
        assert to_slug("Productos Novedosos de China") == "productos-novedosos-de-china"

    def test_slug_with_special_chars(self):
        assert to_slug("Gadgets Baratos $5!") == "gadgets-baratos-5"

    def test_slug_with_accents(self):
        assert to_slug("Tecnología Moderna") == "tecnologia-moderna"

    def test_empty_slug(self):
        assert to_slug("") == ""

    def test_no_trailing_hyphens(self):
        slug = to_slug("  test  ")
        assert not slug.startswith("-")
        assert not slug.endswith("-")


class TestRemoveSpanishStopwords:
    """Tests para la funcion remove_spanish_stopwords."""

    def test_basic_removal(self):
        result = remove_spanish_stopwords("los mejores gadgets de la casa")
        assert "los" not in result.split()
        assert "de" not in result.split()
        assert "la" not in result.split()
        assert "mejores" in result
        assert "gadgets" in result
        assert "casa" in result

    def test_all_stopwords(self):
        result = remove_spanish_stopwords("el la los las un una de en")
        assert result == ""

    def test_empty_string(self):
        assert remove_spanish_stopwords("") == ""


class TestSimilarityScore:
    """Tests para la funcion similarity_score."""

    def test_identical_strings(self):
        score = similarity_score("gadgets baratos", "gadgets baratos")
        assert score == 100.0

    def test_similar_strings(self):
        score = similarity_score("gadgets baratos", "gadget barato")
        assert score > 70.0

    def test_different_strings(self):
        score = similarity_score("gadgets baratos", "comida mexicana")
        assert score < 30.0

    def test_case_insensitive(self):
        score = similarity_score("GADGETS BARATOS", "gadgets baratos")
        assert score == 100.0

    def test_accent_insensitive(self):
        score = similarity_score("tecnología", "tecnologia")
        assert score == 100.0


class TestExtractPotentialKeywords:
    """Tests para la funcion extract_potential_keywords."""

    def test_basic_extraction(self):
        result = extract_potential_keywords(
            "Los mejores gadgets baratos de aliexpress para el hogar"
        )
        assert "mejores" in result
        assert "gadgets" in result
        assert "baratos" in result
        # Stopwords deben ser excluidas
        assert "los" not in result
        assert "para" not in result

    def test_min_length_filter(self):
        result = extract_potential_keywords("a bb ccc dddd", min_length=4)
        assert "dddd" in result
        assert "ccc" not in result

    def test_empty_string(self):
        assert extract_potential_keywords("") == []


class TestTruncateText:
    """Tests para la funcion truncate_text."""

    def test_no_truncation_needed(self):
        assert truncate_text("short text", 50) == "short text"

    def test_truncation(self):
        result = truncate_text("this is a long text", 12)
        assert len(result) <= 12
        assert result.endswith("...")

    def test_empty_string(self):
        assert truncate_text("", 10) == ""


class TestCountWords:
    """Tests para la funcion count_words."""

    def test_basic_count(self):
        assert count_words("uno dos tres") == 3

    def test_empty_string(self):
        assert count_words("") == 0

    def test_single_word(self):
        assert count_words("palabra") == 1


class TestCalculateKeywordDensity:
    """Tests para la funcion calculate_keyword_density."""

    def test_basic_density(self):
        text = "gadgets baratos son los mejores gadgets baratos del mercado"
        density = calculate_keyword_density(text, "gadgets baratos")
        assert density > 0

    def test_zero_density(self):
        text = "este texto no tiene la keyword"
        density = calculate_keyword_density(text, "gadgets baratos")
        assert density == 0.0

    def test_empty_inputs(self):
        assert calculate_keyword_density("", "test") == 0.0
        assert calculate_keyword_density("test", "") == 0.0
