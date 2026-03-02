"""
Cliente de Perplexity AI para investigacion de tendencias.

Usa el free tier de Perplexity AI API para investigar tendencias
actuales en el nicho de productos novedosos importados.

Uso:
    from src.phase1_keywords.perplexity_trends import PerplexityTrendsScraper
    scraper = PerplexityTrendsScraper()
    keywords = scraper.fetch(seed_keywords=["gadgets baratos"])
"""

import os
from typing import Any

from src.utils.http_client import HttpClient
from src.utils.json_schemas import KeywordRaw, KeywordSource, KeywordMetadata
from src.utils.logger import setup_logger
from src.utils.retry import retry
from src.utils.text_utils import extract_potential_keywords

logger = setup_logger(__name__, phase="phase1")

PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions"


class PerplexityTrendsScraper:
    """Cliente de Perplexity AI para investigacion de tendencias."""

    def __init__(self, config: dict[str, Any] | None = None):
        self.config = config or {}
        self.max_queries = self.config.get("max_queries", 5)
        self.api_key = os.getenv("PERPLEXITY_API_KEY", "")
        self.client = HttpClient(delay=2.0)

    @retry(max_attempts=2, base_delay=3.0)
    def _query_perplexity(self, prompt: str) -> str:
        """Envia una consulta a Perplexity AI y retorna la respuesta."""
        if not self.api_key:
            logger.warning("PERPLEXITY_API_KEY no configurada, saltando Perplexity")
            return ""

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": "llama-3.1-sonar-small-128k-online",
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "Eres un experto en tendencias de ecommerce y productos "
                        "importados de China para el mercado latinoamericano. "
                        "Responde siempre en espanol."
                    ),
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            "max_tokens": 1000,
            "temperature": 0.3,
        }

        response = self.client.post(
            PERPLEXITY_API_URL,
            json=payload,
            headers=headers,
        )
        data = response.json()

        if "choices" in data and len(data["choices"]) > 0:
            return data["choices"][0]["message"]["content"]
        return ""

    def _build_queries(self, seed_keywords: list[str]) -> list[str]:
        """Construye las queries de investigacion para Perplexity."""
        base_queries = [
            (
                "Cuales son los productos importados de China mas vendidos y "
                "trending en Latinoamerica este mes? Lista los 20 productos "
                "mas populares con sus nombres especificos."
            ),
            (
                "Que gadgets y accesorios tecnologicos baratos de Aliexpress "
                "estan siendo mas buscados en Mexico y Latinoamerica ahora mismo? "
                "Dame una lista de 15 productos especificos con sus nombres de busqueda."
            ),
            (
                "Cuales son las tendencias actuales en TikTok sobre productos "
                "novedosos importados de China? Que productos estan haciendose "
                "virales? Lista 15 con los terminos de busqueda que la gente usa."
            ),
            (
                "Que categorias de productos importados de China tienen mayor "
                "demanda en Latinoamerica: gadgets, belleza, hogar, cocina? "
                "Para cada categoria, dame los 5 productos mas buscados."
            ),
            (
                "Cuales son las keywords y terminos de busqueda mas usados "
                "por compradores latinoamericanos que buscan productos baratos "
                "importados de China en Google y redes sociales? Lista 20 terminos."
            ),
        ]

        return base_queries[: self.max_queries]

    def _extract_keywords_from_response(self, response: str) -> list[str]:
        """Extrae keywords de la respuesta de Perplexity."""
        keywords: list[str] = []

        # Dividir por lineas y buscar items de lista
        lines = response.split("\n")
        for line in lines:
            line = line.strip()
            # Detectar items de lista (1., -, *, etc.)
            if line and (
                line[0].isdigit()
                or line.startswith("-")
                or line.startswith("*")
                or line.startswith("•")
            ):
                # Limpiar el texto
                clean = line.lstrip("0123456789.-*•) ").strip()
                # Extraer lo que esta antes de cualquier descripcion
                if ":" in clean:
                    clean = clean.split(":")[0].strip()
                if " - " in clean:
                    clean = clean.split(" - ")[0].strip()

                if clean and 3 < len(clean) < 100:
                    keywords.append(clean.lower())

        # Tambien extraer keywords sueltas del texto
        potential = extract_potential_keywords(response, min_length=5)
        keywords.extend(potential[:20])

        return list(dict.fromkeys(keywords))

    def fetch(self, seed_keywords: list[str]) -> list[KeywordRaw]:
        """
        Investiga tendencias usando Perplexity AI.

        Args:
            seed_keywords: Lista de keywords semilla.

        Returns:
            Lista de KeywordRaw con las keywords descubiertas.
        """
        if not self.api_key:
            logger.warning("Perplexity: API key no configurada, saltando fuente")
            return []

        all_keywords: list[KeywordRaw] = []
        seen: set[str] = set()
        queries = self._build_queries(seed_keywords)

        for q_idx, query in enumerate(queries):
            logger.info(f"Perplexity: ejecutando query {q_idx + 1}/{len(queries)}...")

            try:
                response_text = self._query_perplexity(query)
                if not response_text:
                    continue

                extracted = self._extract_keywords_from_response(response_text)

                count = 0
                for i, kw_text in enumerate(extracted):
                    if kw_text not in seen:
                        seen.add(kw_text)
                        kw = KeywordRaw(
                            keyword=kw_text,
                            source=KeywordSource.PERPLEXITY_TRENDS,
                            language="es",
                            metadata=KeywordMetadata(
                                position_in_source=i + 1,
                                parent_seed=f"perplexity_query_{q_idx + 1}",
                                extra={"query_index": q_idx + 1},
                            ),
                        )
                        all_keywords.append(kw)
                        count += 1

                logger.info(f"Perplexity: {count} keywords de query {q_idx + 1}")

            except Exception as e:
                logger.error(f"Perplexity fallo en query {q_idx + 1}: {e}")
                continue

        self.client.close()
        logger.info(f"Perplexity: total {len(all_keywords)} keywords recopiladas")
        return all_keywords
