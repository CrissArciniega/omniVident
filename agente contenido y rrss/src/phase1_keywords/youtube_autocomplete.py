"""
Scraper de YouTube Autocomplete.

Consulta el endpoint publico de sugerencias de YouTube para obtener
keywords relacionadas con video content.

Uso:
    from src.phase1_keywords.youtube_autocomplete import YouTubeAutocompleteScraper
    scraper = YouTubeAutocompleteScraper()
    keywords = scraper.fetch(seed_keywords=["gadgets baratos"])
"""

import json
from typing import Any

from src.utils.http_client import HttpClient
from src.utils.json_schemas import KeywordRaw, KeywordSource, KeywordMetadata
from src.utils.logger import setup_logger
from src.utils.retry import retry

logger = setup_logger(__name__, phase="phase1")

YOUTUBE_SUGGEST_URL = "https://suggestqueries.google.com/complete/search"


class YouTubeAutocompleteScraper:
    """Scraper de sugerencias de YouTube Autocomplete en espanol."""

    def __init__(self, config: dict[str, Any] | None = None):
        self.config = config or {}
        self.language = self.config.get("language", "es")
        delay = self.config.get("delay_between_requests", 1.0)
        self.client = HttpClient(delay=delay)

    @retry(max_attempts=3, base_delay=1.0)
    def _get_suggestions(self, query: str) -> list[str]:
        """Obtiene sugerencias de autocomplete de YouTube."""
        params = {
            "client": "youtube",
            "ds": "yt",
            "q": query,
            "hl": self.language,
        }

        response = self.client.get(YOUTUBE_SUGGEST_URL, params=params)
        text = response.text

        # El response viene en formato JSONP, hay que extraer el JSON
        # Formato: window.google.ac.h([...])
        try:
            # Intentar parsear como JSON directo primero
            data = json.loads(text)
        except json.JSONDecodeError:
            # Extraer JSON del JSONP
            start = text.find("(")
            end = text.rfind(")")
            if start != -1 and end != -1:
                json_str = text[start + 1 : end]
                data = json.loads(json_str)
            else:
                return []

        # Extraer sugerencias del array
        suggestions = []
        if isinstance(data, list) and len(data) >= 2:
            for item in data[1]:
                if isinstance(item, list) and len(item) > 0:
                    suggestions.append(str(item[0]))
                elif isinstance(item, str):
                    suggestions.append(item)

        return suggestions

    def fetch(self, seed_keywords: list[str]) -> list[KeywordRaw]:
        """
        Obtiene sugerencias de YouTube Autocomplete.

        Args:
            seed_keywords: Lista de keywords semilla.

        Returns:
            Lista de KeywordRaw con las sugerencias encontradas.
        """
        all_keywords: list[KeywordRaw] = []
        seen: set[str] = set()

        for seed in seed_keywords:
            logger.info(f"YouTube Autocomplete: buscando '{seed}'...")

            try:
                suggestions = self._get_suggestions(seed)

                count = 0
                for i, suggestion in enumerate(suggestions):
                    suggestion_lower = suggestion.lower().strip()
                    if suggestion_lower and suggestion_lower not in seen:
                        seen.add(suggestion_lower)
                        kw = KeywordRaw(
                            keyword=suggestion_lower,
                            source=KeywordSource.YOUTUBE_AUTOCOMPLETE,
                            language=self.language,
                            metadata=KeywordMetadata(
                                position_in_source=i + 1,
                                parent_seed=seed,
                            ),
                        )
                        all_keywords.append(kw)
                        count += 1

                logger.info(f"YouTube Autocomplete: {count} keywords para '{seed}'")

            except Exception as e:
                logger.error(f"YouTube Autocomplete fallo para '{seed}': {e}")
                continue

        self.client.close()
        logger.info(f"YouTube Autocomplete: total {len(all_keywords)} keywords recopiladas")
        return all_keywords
