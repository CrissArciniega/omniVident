"""
Scraper de Google People Also Ask (PAA).

Extrae las preguntas "La gente tambien pregunta" de los resultados
de busqueda de Google para las seed keywords.

Usa multiples selectores CSS con fallbacks robustos para adaptarse
a los cambios frecuentes en la estructura HTML de Google.

Uso:
    from src.phase1_keywords.people_also_ask import PeopleAlsoAskScraper
    scraper = PeopleAlsoAskScraper()
    keywords = scraper.fetch(seed_keywords=["gadgets baratos"])
"""

import re
from typing import Any

from src.utils.http_client import HttpClient
from src.utils.json_schemas import KeywordRaw, KeywordSource, KeywordMetadata
from src.utils.logger import setup_logger
from src.utils.retry import retry

logger = setup_logger(__name__, phase="phase1")

GOOGLE_SEARCH_URL = "https://www.google.com/search"

# Palabras interrogativas en espanol (con y sin acento)
SPANISH_QUESTION_STARTERS = [
    "que ", "qué ", "como ", "cómo ", "donde ", "dónde ",
    "cuando ", "cuándo ", "por que ", "por qué ",
    "cual ", "cuál ", "cuales ", "cuáles ",
    "cuanto ", "cuánto ", "cuanta ", "cuánta ",
    "quien ", "quién ", "quienes ", "quiénes ",
    "para que ", "para qué ",
    "es ", "son ", "se puede ", "se pueden ",
    "hay ", "tiene ", "tienen ",
    "vale ", "sirve ", "funciona ",
    # Ingles como fallback (Google a veces mezcla)
    "what ", "how ", "where ", "when ", "why ", "which ", "who ",
    "is ", "are ", "can ", "do ", "does ",
]


class PeopleAlsoAskScraper:
    """Scraper de preguntas People Also Ask de Google."""

    def __init__(self, config: dict[str, Any] | None = None):
        self.config = config or {}
        self.language = self.config.get("language", "es")
        self.max_questions = self.config.get("max_questions_per_seed", 8)
        delay = self.config.get("delay_between_requests", 2.0)
        self.client = HttpClient(delay=delay)

    @retry(max_attempts=3, base_delay=2.0)
    def _extract_paa_questions(self, query: str) -> list[str]:
        """Extrae preguntas PAA de los resultados de Google."""
        params = {
            "q": query,
            "hl": self.language,
            "gl": "mx",
        }

        soup = self.client.get_soup(GOOGLE_SEARCH_URL, params=params)
        questions: list[str] = []

        # =================================================================
        # ESTRATEGIA 1: Selectores directos del bloque PAA
        # Google usa varias clases y atributos para PAA, intentamos todos
        # =================================================================

        # 1a. Atributo data-q (metodo clasico)
        paa_divs = soup.find_all("div", attrs={"data-q": True})
        for div in paa_divs:
            q_text = div.get("data-q", "").strip()
            if q_text and len(q_text) > 10:
                questions.append(q_text)

        # 1b. Clase related-question-pair (metodo clasico)
        if not questions:
            for div in soup.find_all("div", class_="related-question-pair"):
                span = div.find("span")
                if span:
                    text = span.get_text(strip=True)
                    if text and len(text) > 10:
                        questions.append(text)

        # 1c. Atributo jsname con estructura de acordeon (metodo moderno)
        if not questions:
            # Google envuelve PAA en elementos con jsname
            # Buscar divs con role="heading" dentro de secciones expandibles
            for heading in soup.find_all(attrs={"role": "heading"}):
                text = heading.get_text(strip=True)
                if text and "?" in text and len(text) > 10:
                    questions.append(text)

        # 1d. Buscar en elementos con aria-expanded (acordeones PAA)
        if not questions:
            for elem in soup.find_all(attrs={"aria-expanded": True}):
                text = elem.get_text(strip=True)
                if text and "?" in text and 10 < len(text) < 200:
                    questions.append(text)

        # 1e. Buscar en divs con data-attrid que contengan "RelatedQuestion"
        if not questions:
            for div in soup.find_all("div", attrs={"data-attrid": True}):
                attrid = div.get("data-attrid", "")
                if "RelatedQuestion" in attrid or "PeopleAlsoAsk" in attrid:
                    inner_text = div.get_text(strip=True)
                    if inner_text and "?" in inner_text:
                        # Puede contener multiples preguntas, separar
                        parts = inner_text.split("?")
                        for part in parts:
                            part = part.strip()
                            if len(part) > 10:
                                questions.append(part + "?")

        # =================================================================
        # ESTRATEGIA 2: Busqueda heuristica de preguntas
        # Si los selectores especificos fallan, buscar patron de preguntas
        # =================================================================
        if not questions:
            # Buscar cualquier elemento que contenga texto con "?"
            # que empiece con palabra interrogativa
            seen_texts: set[str] = set()
            for element in soup.find_all(["div", "span", "h2", "h3"]):
                text = element.get_text(strip=True)
                if not text or "?" not in text:
                    continue
                if len(text) < 15 or len(text) > 250:
                    continue
                if text in seen_texts:
                    continue

                text_lower = text.lower()

                # Verificar que empieza con palabra interrogativa
                is_question = any(
                    text_lower.startswith(starter)
                    for starter in SPANISH_QUESTION_STARTERS
                )

                if is_question:
                    seen_texts.add(text)
                    questions.append(text)

        # =================================================================
        # ESTRATEGIA 3: Extraer de "La gente tambien busca" / sugerencias
        # =================================================================
        if not questions:
            # Buscar secciones con titulos tipo "La gente tambien pregunta"
            for h2 in soup.find_all(["h2", "h3", "div"]):
                h_text = h2.get_text(strip=True).lower()
                if any(phrase in h_text for phrase in [
                    "también pregunta", "tambien pregunta",
                    "people also ask", "preguntas relacionadas",
                    "preguntas frecuentes",
                ]):
                    # Buscar preguntas en los siblings/hijos cercanos
                    parent = h2.parent
                    if parent:
                        for child in parent.find_all(["div", "span"]):
                            child_text = child.get_text(strip=True)
                            if child_text and "?" in child_text and 10 < len(child_text) < 200:
                                questions.append(child_text)

        # Deduplicar manteniendo orden y limitar
        unique_questions = list(dict.fromkeys(questions))

        # Filtrar preguntas que son claramente navegacion o UI de Google
        filtered = []
        skip_phrases = [
            "buscar con google", "configuracion", "privacidad",
            "iniciar sesion", "herramientas de busqueda",
            "mas resultados", "pagina siguiente",
        ]
        for q in unique_questions:
            q_lower = q.lower()
            if not any(skip in q_lower for skip in skip_phrases):
                filtered.append(q)

        return filtered[:self.max_questions]

    def fetch(self, seed_keywords: list[str]) -> list[KeywordRaw]:
        """
        Obtiene preguntas People Also Ask de Google.

        Args:
            seed_keywords: Lista de keywords semilla.

        Returns:
            Lista de KeywordRaw con las preguntas encontradas.
        """
        all_keywords: list[KeywordRaw] = []
        seen: set[str] = set()

        for seed in seed_keywords:
            logger.info(f"People Also Ask: buscando '{seed}'...")

            try:
                questions = self._extract_paa_questions(seed)

                count = 0
                for i, question in enumerate(questions):
                    question_clean = question.strip()
                    question_lower = question_clean.lower()

                    if question_lower not in seen and len(question_lower) > 10:
                        seen.add(question_lower)
                        kw = KeywordRaw(
                            keyword=question_clean,
                            source=KeywordSource.PEOPLE_ALSO_ASK,
                            language=self.language,
                            metadata=KeywordMetadata(
                                position_in_source=i + 1,
                                parent_seed=seed,
                                extra={"is_question": True},
                            ),
                        )
                        all_keywords.append(kw)
                        count += 1

                logger.info(f"People Also Ask: {count} preguntas para '{seed}'")

            except Exception as e:
                logger.error(f"People Also Ask fallo para '{seed}': {e}")
                continue

        self.client.close()
        logger.info(f"People Also Ask: total {len(all_keywords)} preguntas recopiladas")
        return all_keywords
