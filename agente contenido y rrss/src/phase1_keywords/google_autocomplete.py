"""
Scraper de Google Autocomplete.

Consulta el endpoint publico de sugerencias de Google para expandir
seed keywords con la tecnica de sufijo a-z.

Uso:
    from src.phase1_keywords.google_autocomplete import GoogleAutocompleteScraper
    scraper = GoogleAutocompleteScraper()
    keywords = scraper.fetch(seed_keywords=["gadgets baratos"])
"""

import json
from typing import Any

from src.utils.http_client import HttpClient
from src.utils.json_schemas import KeywordRaw, KeywordSource, KeywordMetadata
from src.utils.logger import setup_logger
from src.utils.retry import retry

logger = setup_logger(__name__, phase="phase1")

AUTOCOMPLETE_URL = "https://suggestqueries.google.com/complete/search"
ALPHABET = "abcdefghijklmnopqrstuvwxyz"


class GoogleAutocompleteScraper:
    """Scraper de sugerencias de Google Autocomplete en espanol."""

    def __init__(self, config: dict[str, Any] | None = None):
        self.config = config or {}
        self.language = self.config.get("language", "es")
        self.country = self.config.get("country", "mx")
        self.expand_with_alphabet = self.config.get("expand_with_alphabet", True)
        self.max_depth = self.config.get("max_depth", 2)
        delay = self.config.get("delay_between_requests", 1.5)
        self.client = HttpClient(delay=delay)

    @retry(max_attempts=3, base_delay=1.5)
    def _get_suggestions(self, query: str) -> list[str]:
        """Obtiene sugerencias de autocomplete para una query."""
        params = {
            "client": "firefox",
            "q": query,
            "hl": self.language,
            "gl": self.country,
        }

        response = self.client.get(AUTOCOMPLETE_URL, params=params)
        data = json.loads(response.text)

        # El formato es: [query, [sugerencias]]
        if isinstance(data, list) and len(data) >= 2:
            return [s for s in data[1] if isinstance(s, str)]
        return []

    def _expand_with_alphabet(self, seed: str) -> list[str]:
        """Expande una seed keyword agregando cada letra del alfabeto."""
        all_suggestions: list[str] = []

        for letter in ALPHABET:
            query = f"{seed} {letter}"
            try:
                suggestions = self._get_suggestions(query)
                all_suggestions.extend(suggestions)
            except Exception as e:
                logger.warning(f"Autocomplete fallo para '{query}': {e}")
                continue

        return all_suggestions

    def fetch(self, seed_keywords: list[str]) -> list[KeywordRaw]:
        """
        Obtiene sugerencias de Google Autocomplete.

        Args:
            seed_keywords: Lista de keywords semilla.

        Returns:
            Lista de KeywordRaw con las sugerencias encontradas.
        """
        all_keywords: list[KeywordRaw] = []
        seen: set[str] = set()

        for seed in seed_keywords:
            logger.info(f"Google Autocomplete: buscando '{seed}'...")

            try:
                # Sugerencias directas
                direct_suggestions = self._get_suggestions(seed)

                # Expansion con alfabeto (si esta habilitada)
                alpha_suggestions: list[str] = []
                if self.expand_with_alphabet:
                    alpha_suggestions = self._expand_with_alphabet(seed)

                all_suggestions = direct_suggestions + alpha_suggestions

                count = 0
                for i, suggestion in enumerate(all_suggestions):
                    suggestion_lower = suggestion.lower().strip()
                    if suggestion_lower and suggestion_lower not in seen:
                        seen.add(suggestion_lower)
                        kw = KeywordRaw(
                            keyword=suggestion_lower,
                            source=KeywordSource.GOOGLE_AUTOCOMPLETE,
                            language=self.language,
                            metadata=KeywordMetadata(
                                position_in_source=i + 1,
                                parent_seed=seed,
                            ),
                        )
                        all_keywords.append(kw)
                        count += 1

                logger.info(f"Google Autocomplete: {count} keywords unicas para '{seed}'")

            except Exception as e:
                logger.error(f"Google Autocomplete fallo para '{seed}': {e}")
                continue

        self.client.close()
        logger.info(f"Google Autocomplete: total {len(all_keywords)} keywords recopiladas")
        return all_keywords
