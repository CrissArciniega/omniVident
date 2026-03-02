"""
Scraper de busquedas relacionadas de Google.

Extrae la seccion "Busquedas relacionadas" del SERP de Google
para las seed keywords, usando multiples estrategias con fallbacks.

Uso:
    from src.phase1_keywords.google_related import GoogleRelatedScraper
    scraper = GoogleRelatedScraper()
    keywords = scraper.fetch(seed_keywords=["gadgets baratos"])
"""

from typing import Any

from src.utils.http_client import HttpClient
from src.utils.json_schemas import KeywordRaw, KeywordSource, KeywordMetadata
from src.utils.logger import setup_logger
from src.utils.retry import retry

logger = setup_logger(__name__, phase="phase1")

GOOGLE_SEARCH_URL = "https://www.google.com/search"

# Frases a excluir (navegacion, UI de Google, etc.)
SKIP_PHRASES = {
    "google", "privacidad", "condiciones", "configuracion",
    "configuración", "buscar", "siguiente", "anterior", "iniciar",
    "sesion", "sesión", "mas resultados", "más resultados",
    "herramientas", "imagenes", "imágenes", "videos",
    "noticias", "maps", "shopping", "todos",
    "ayuda", "enviar", "reportar", "copyright",
    "sign in", "settings", "privacy", "terms",
}


class GoogleRelatedScraper:
    """Scraper de busquedas relacionadas de Google."""

    def __init__(self, config: dict[str, Any] | None = None):
        self.config = config or {}
        self.language = self.config.get("language", "es")
        delay = self.config.get("delay_between_requests", 2.0)
        self.client = HttpClient(delay=delay)

    def _is_valid_related(self, text: str) -> bool:
        """Verifica si un texto es una busqueda relacionada valida."""
        if not text or len(text) < 4 or len(text) > 150:
            return False

        text_lower = text.lower()

        # Excluir textos de navegacion/UI
        if any(skip in text_lower for skip in SKIP_PHRASES):
            return False

        # Excluir textos que son solo numeros o muy cortos
        if text.strip().isdigit():
            return False

        # Excluir URLs
        if "http" in text_lower or "www." in text_lower:
            return False

        return True

    @retry(max_attempts=3, base_delay=2.0)
    def _extract_related_searches(self, query: str) -> list[str]:
        """Extrae busquedas relacionadas del SERP de Google."""
        params = {
            "q": query,
            "hl": self.language,
            "gl": "mx",
        }

        soup = self.client.get_soup(GOOGLE_SEARCH_URL, params=params)
        related: list[str] = []

        # =================================================================
        # ESTRATEGIA 1: Selectores CSS conocidos del bloque "Busquedas relacionadas"
        # Google cambia estos frecuentemente, por eso probamos varios
        # =================================================================

        # 1a. Clase k8XOCe (clasico)
        for div in soup.find_all("div", class_="k8XOCe"):
            link = div.find("a")
            if link:
                text = link.get_text(strip=True)
                if self._is_valid_related(text):
                    related.append(text)

        # 1b. Clase s75CSd (variante reciente)
        if not related:
            for div in soup.find_all("div", class_="s75CSd"):
                text = div.get_text(strip=True)
                if self._is_valid_related(text):
                    related.append(text)

        # 1c. Clase brs_col (otra variante)
        if not related:
            for div in soup.find_all("div", class_="brs_col"):
                for link in div.find_all("a"):
                    text = link.get_text(strip=True)
                    if self._is_valid_related(text):
                        related.append(text)

        # 1d. Buscar en la tabla de busquedas relacionadas
        if not related:
            for table in soup.find_all("table", class_="EIaa9b"):
                for link in table.find_all("a"):
                    text = link.get_text(strip=True)
                    if self._is_valid_related(text):
                        related.append(text)

        # =================================================================
        # ESTRATEGIA 2: Buscar links /search?q= en la parte inferior de la pagina
        # =================================================================
        if not related:
            # Los resultados relacionados estan tipicamente en la segunda mitad del HTML
            all_links = soup.find_all("a")
            # Tomar solo la mitad inferior
            lower_half = all_links[len(all_links) // 2:]

            for a_tag in lower_half:
                href = a_tag.get("href", "")
                if "/search?q=" not in href:
                    continue

                text = a_tag.get_text(strip=True)
                if self._is_valid_related(text):
                    related.append(text)

        # =================================================================
        # ESTRATEGIA 3: Carousel de busquedas (chips interactivos)
        # =================================================================
        if not related:
            # Google a veces muestra busquedas como chips/carousel
            for item in soup.find_all("div", attrs={"role": "listitem"}):
                text = item.get_text(strip=True)
                if self._is_valid_related(text):
                    related.append(text)

            # Tambien buscar en elementos con role="list"
            for list_elem in soup.find_all(attrs={"role": "list"}):
                for child in list_elem.find_all(["a", "div", "span"]):
                    text = child.get_text(strip=True)
                    if self._is_valid_related(text) and text not in related:
                        related.append(text)

        # =================================================================
        # ESTRATEGIA 4: Buscar la seccion por su titulo "Busquedas relacionadas"
        # =================================================================
        if not related:
            for heading in soup.find_all(["h2", "h3", "div"]):
                h_text = heading.get_text(strip=True).lower()
                if any(phrase in h_text for phrase in [
                    "búsquedas relacionadas", "busquedas relacionadas",
                    "related searches", "también buscaron",
                    "tambien buscaron",
                ]):
                    # Buscar en el contenedor padre
                    parent = heading.parent
                    if parent:
                        for link in parent.find_all("a"):
                            text = link.get_text(strip=True)
                            if self._is_valid_related(text):
                                related.append(text)
                    break

        # =================================================================
        # ESTRATEGIA 5: Extraer sugerencias de "Refinar" (chips de refinamiento)
        # =================================================================
        if len(related) < 3:
            # Chips de refinamiento tipo "gadgets baratos + amazon"
            for div in soup.find_all("div", class_=True):
                classes = " ".join(div.get("class", []))
                # Buscar clases que suelen contener refinamientos
                if any(c in classes for c in ["MRfBrb", "rllt__link", "AJLUJb"]):
                    text = div.get_text(strip=True)
                    if self._is_valid_related(text) and text not in related:
                        related.append(text)

        # Deduplicar manteniendo orden
        return list(dict.fromkeys(related))

    def fetch(self, seed_keywords: list[str]) -> list[KeywordRaw]:
        """
        Obtiene busquedas relacionadas de Google.

        Args:
            seed_keywords: Lista de keywords semilla.

        Returns:
            Lista de KeywordRaw con las busquedas relacionadas.
        """
        all_keywords: list[KeywordRaw] = []
        seen: set[str] = set()

        for seed in seed_keywords:
            logger.info(f"Google Related: buscando '{seed}'...")

            try:
                related = self._extract_related_searches(seed)

                count = 0
                for i, text in enumerate(related):
                    text_clean = text.strip()
                    text_lower = text_clean.lower()

                    if text_lower and text_lower not in seen:
                        seen.add(text_lower)
                        kw = KeywordRaw(
                            keyword=text_lower,
                            source=KeywordSource.GOOGLE_RELATED,
                            language=self.language,
                            metadata=KeywordMetadata(
                                position_in_source=i + 1,
                                parent_seed=seed,
                            ),
                        )
                        all_keywords.append(kw)
                        count += 1

                logger.info(f"Google Related: {count} busquedas para '{seed}'")

            except Exception as e:
                logger.error(f"Google Related fallo para '{seed}': {e}")
                continue

        self.client.close()
        logger.info(f"Google Related: total {len(all_keywords)} keywords recopiladas")
        return all_keywords
