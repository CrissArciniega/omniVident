"""
Scraper de TikTok Trending Hashtags.

Recopila hashtags y terminos trending de TikTok mediante scraping web.
Nota: TikTok tiene proteccion anti-bot agresiva, por lo que este modulo
incluye delays generosos y manejo de errores robusto.

Uso:
    from src.phase1_keywords.tiktok_trends import TikTokTrendsScraper
    scraper = TikTokTrendsScraper()
    keywords = scraper.fetch(seed_keywords=["gadgets baratos"])
"""

from typing import Any

from src.utils.http_client import HttpClient
from src.utils.json_schemas import KeywordRaw, KeywordSource, KeywordMetadata
from src.utils.logger import setup_logger
from src.utils.retry import retry

logger = setup_logger(__name__, phase="phase1")

# URLs publicas de TikTok para tendencias
TIKTOK_TRENDING_URL = "https://www.tiktok.com/api/recommend/item_list/"
TIKTOK_DISCOVER_URL = "https://www.tiktok.com/node/share/discover"


class TikTokTrendsScraper:
    """Scraper de hashtags y tendencias de TikTok."""

    def __init__(self, config: dict[str, Any] | None = None):
        self.config = config or {}
        self.region = self.config.get("region", "MX")
        self.max_hashtags = self.config.get("max_hashtags", 50)
        delay = self.config.get("delay_between_requests", 3.0)
        self.client = HttpClient(delay=delay)

    @retry(max_attempts=2, base_delay=3.0)
    def _scrape_trending_hashtags(self) -> list[dict[str, Any]]:
        """
        Intenta obtener hashtags trending de TikTok.

        Dado que TikTok cambia frecuentemente sus endpoints,
        este metodo intenta multiples approaches.
        """
        hashtags = []

        # Approach 1: TikTok Discover page
        try:
            soup = self.client.get_soup(
                "https://www.tiktok.com/discover",
                headers={
                    "Accept-Language": "es-MX,es;q=0.9",
                },
            )

            # Buscar hashtags en la pagina
            for tag in soup.find_all("a", href=True):
                href = tag.get("href", "")
                if "/tag/" in href:
                    hashtag_text = tag.get_text(strip=True)
                    if hashtag_text:
                        hashtags.append({
                            "keyword": hashtag_text.replace("#", "").lower(),
                            "source_detail": "tiktok_discover",
                        })

        except Exception as e:
            logger.warning(f"TikTok Discover scraping fallo: {e}")

        # Approach 2: Construir hashtags basados en el nicho
        # Cuando el scraping directo falla, usamos prefijos comunes de TikTok
        if not hashtags:
            logger.info("TikTok scraping directo fallo, usando approach alternativo")
            niche_hashtags = [
                "productosvirales", "gadgets", "aliexpress", "hallazgos",
                "comprasinteligentes", "productoschinos", "tiktokmehizocomprarlo",
                "loquepedivsloquerecibi", "unboxing", "haul",
                "productosnovedosos", "gadgetsbaratos", "techreview",
                "cosasdealiexpress", "productosutiles", "hallazgostiktok",
                "productosinnovadores", "loquecompreenaliexpress",
                "regalosoriginales", "gadgetscool", "productostrending",
                "accesoriosbaratos", "tecnologia", "ofertas",
                "productosdechina", "tendencias", "viral",
            ]
            for h in niche_hashtags:
                hashtags.append({
                    "keyword": h,
                    "source_detail": "tiktok_niche_list",
                })

        return hashtags[: self.max_hashtags]

    def fetch(self, seed_keywords: list[str]) -> list[KeywordRaw]:
        """
        Obtiene hashtags trending de TikTok.

        Args:
            seed_keywords: Lista de keywords semilla (usadas como contexto).

        Returns:
            Lista de KeywordRaw con los hashtags encontrados.
        """
        all_keywords: list[KeywordRaw] = []
        seen: set[str] = set()

        logger.info("TikTok Trends: obteniendo hashtags trending...")

        try:
            hashtags = self._scrape_trending_hashtags()

            for i, hashtag in enumerate(hashtags):
                kw_text = hashtag["keyword"].lower().strip()
                if kw_text and kw_text not in seen:
                    seen.add(kw_text)
                    kw = KeywordRaw(
                        keyword=kw_text,
                        source=KeywordSource.TIKTOK_TRENDS,
                        language="es",
                        metadata=KeywordMetadata(
                            position_in_source=i + 1,
                            parent_seed="tiktok_trending",
                            extra={"source_detail": hashtag.get("source_detail", "")},
                        ),
                    )
                    all_keywords.append(kw)

            logger.info(f"TikTok Trends: {len(all_keywords)} hashtags recopilados")

        except Exception as e:
            logger.error(f"TikTok Trends fallo completamente: {e}")

        self.client.close()
        return all_keywords
