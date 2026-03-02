"""
Scraper de Google Trends usando trendspyg.

Usa la funcion download_google_trends_rss() de trendspyg para obtener
las tendencias actuales de Google en la region configurada (default: Mexico).
Tambien intenta download_google_trends_csv() como fuente complementaria.

Uso:
    from src.phase1_keywords.google_trends import GoogleTrendsScraper
    scraper = GoogleTrendsScraper()
    keywords = scraper.fetch(seed_keywords=["gadgets baratos"])
"""

import re
from typing import Any

from src.utils.json_schemas import KeywordRaw, KeywordSource, KeywordMetadata
from src.utils.logger import setup_logger
from src.utils.retry import retry

logger = setup_logger(__name__, phase="phase1")


class GoogleTrendsScraper:
    """Scraper de Google Trends usando trendspyg (RSS + CSV)."""

    def __init__(self, config: dict[str, Any] | None = None):
        self.config = config or {}
        self.geo = self.config.get("geo", "MX")
        self.language = self.config.get("language", "es")
        self.max_keywords_per_seed = self.config.get("max_keywords_per_seed", 25)

    @retry(max_attempts=2, base_delay=3.0)
    def _fetch_rss_trends(self) -> list[dict[str, Any]]:
        """Obtiene tendencias actuales via RSS feed (rapido, ~0.2s)."""
        try:
            from trendspyg import download_google_trends_rss

            trends = download_google_trends_rss(
                geo=self.geo,
                output_format="dict",
                include_images=False,
                include_articles=True,
                max_articles_per_trend=3,
                cache=False,
            )

            results: list[dict[str, Any]] = []

            if not trends:
                logger.warning("Google Trends RSS: respuesta vacia")
                return results

            for i, trend in enumerate(trends):
                trend_name = trend.get("trend", "")
                traffic = trend.get("traffic", "0+")

                if trend_name:
                    # Agregar la tendencia principal
                    results.append({
                        "keyword": trend_name.strip().lower(),
                        "score": self._parse_traffic(traffic),
                        "type": "rss_trend",
                        "position": i + 1,
                    })

                    # Extraer keywords de los titulares de articulos relacionados
                    articles = trend.get("news_articles", [])
                    for article in articles:
                        headline = article.get("headline", "")
                        if headline and len(headline) > 10:
                            results.append({
                                "keyword": headline.strip().lower(),
                                "score": self._parse_traffic(traffic) * 0.7,
                                "type": "rss_article_headline",
                                "position": i + 1,
                            })

            logger.info(f"Google Trends RSS: {len(results)} keywords extraidas de {len(trends)} tendencias")
            return results

        except ImportError:
            logger.error(
                "trendspyg no esta instalado. Ejecutar: pip install trendspyg"
            )
            return []

    @retry(max_attempts=2, base_delay=5.0)
    def _fetch_csv_trends(self) -> list[dict[str, Any]]:
        """
        Obtiene tendencias via CSV export (mas datos, ~10s, requiere browser).
        Se usa como fuente complementaria si esta disponible.
        """
        try:
            from trendspyg import download_google_trends_csv

            logger.info("Google Trends CSV: descargando (puede tomar ~10s)...")
            df = download_google_trends_csv(
                geo=self.geo,
                hours=24,
                category="all",
                active_only=False,
                sort_by="relevance",
                headless=True,
                output_format="dataframe",
            )

            results: list[dict[str, Any]] = []

            if df is None or (hasattr(df, "empty") and df.empty):
                logger.warning("Google Trends CSV: sin resultados o DataFrame vacio")
                return results

            # Iterar filas del DataFrame
            for i, row in df.iterrows():
                # trendspyg CSV suele tener columnas como 'title', 'traffic', etc.
                keyword = ""
                score = 0.0

                # Intentar diferentes nombres de columna
                for col_name in ["title", "query", "keyword", "trend", "name"]:
                    if col_name in df.columns:
                        keyword = str(row[col_name]).strip().lower()
                        break

                if not keyword:
                    # Tomar la primera columna como keyword
                    keyword = str(row.iloc[0]).strip().lower()

                for col_name in ["traffic", "volume", "value", "score"]:
                    if col_name in df.columns:
                        score = self._parse_traffic(str(row[col_name]))
                        break

                if keyword and keyword != "nan" and len(keyword) > 2:
                    results.append({
                        "keyword": keyword,
                        "score": score,
                        "type": "csv_trend",
                        "position": int(i) + 1 if isinstance(i, (int, float)) else 0,
                    })

            logger.info(f"Google Trends CSV: {len(results)} keywords extraidas")
            return results

        except ImportError:
            logger.warning("trendspyg CSV requiere dependencias de browser, saltando")
            return []
        except Exception as e:
            logger.warning(f"Google Trends CSV no disponible: {e}")
            return []

    def _parse_traffic(self, traffic_str: str) -> float:
        """Convierte strings como '200+', '2K+', '500,000+' a float."""
        if not traffic_str:
            return 0.0

        clean = str(traffic_str).replace(",", "").replace("+", "").strip().upper()

        try:
            if "M" in clean:
                return float(clean.replace("M", "")) * 1_000_000
            elif "K" in clean:
                return float(clean.replace("K", "")) * 1_000
            else:
                # Extraer primer numero
                nums = re.findall(r"[\d.]+", clean)
                return float(nums[0]) if nums else 0.0
        except (ValueError, IndexError):
            return 0.0

    def _is_relevant_to_seeds(self, keyword: str, seed_keywords: list[str]) -> bool:
        """Verifica si una keyword es relevante para las seeds del nicho."""
        # Terminos relevantes al nicho de productos importados
        niche_terms = {
            "gadget", "producto", "tecnologia", "barato", "china",
            "aliexpress", "amazon", "tiktok", "viral", "oferta",
            "comprar", "precio", "accesorio", "novedoso", "hogar",
            "cocina", "belleza", "juguete", "electronico", "importado",
            "dispositivo", "herramienta", "envio", "tienda", "online",
            "descuento", "promocion", "inventos", "tendencia",
            "moda", "regalo", "util", "celular", "telefono",
        }

        kw_lower = keyword.lower()
        kw_words = set(kw_lower.split())

        # Si intersecta con terminos del nicho, es relevante
        if kw_words & niche_terms:
            return True

        # Si contiene alguna seed (parcial), es relevante
        for seed in seed_keywords:
            seed_words = set(seed.lower().split())
            if seed_words & kw_words:
                return True

        return False

    def fetch(self, seed_keywords: list[str]) -> list[KeywordRaw]:
        """
        Obtiene keywords de Google Trends.

        Estrategia:
        1. RSS feed (rapido): obtiene ~10-20 tendencias actuales
        2. CSV export (lento, opcional): obtiene ~480 tendencias si browser disponible
        3. Filtra por relevancia al nicho

        Args:
            seed_keywords: Lista de keywords semilla.

        Returns:
            Lista de KeywordRaw con las keywords encontradas.
        """
        all_results: list[dict[str, Any]] = []
        seen_keywords: set[str] = set()

        # --- Fuente 1: RSS (siempre disponible, rapido) ---
        logger.info(f"Google Trends: obteniendo tendencias RSS para geo={self.geo}...")
        try:
            rss_results = self._fetch_rss_trends()
            for r in rss_results:
                kw = r["keyword"]
                if kw not in seen_keywords:
                    seen_keywords.add(kw)
                    all_results.append(r)
        except Exception as e:
            logger.error(f"Google Trends RSS fallo: {e}")

        # --- Fuente 2: CSV (opcional, mas datos) ---
        logger.info("Google Trends: intentando fuente CSV complementaria...")
        try:
            csv_results = self._fetch_csv_trends()
            for r in csv_results:
                kw = r["keyword"]
                if kw not in seen_keywords:
                    seen_keywords.add(kw)
                    all_results.append(r)
        except Exception as e:
            logger.warning(f"Google Trends CSV no disponible: {e}")

        # --- Convertir a KeywordRaw ---
        all_keywords: list[KeywordRaw] = []

        for result in all_results:
            keyword_text = result["keyword"]

            # Filtrar keywords demasiado cortas o basura
            if len(keyword_text) < 3:
                continue

            kw = KeywordRaw(
                keyword=keyword_text,
                source=KeywordSource.GOOGLE_TRENDS,
                language=self.language,
                raw_score=result.get("score"),
                metadata=KeywordMetadata(
                    position_in_source=result.get("position", 0),
                    parent_seed=f"google_trends_{self.geo}",
                    extra={
                        "query_type": result.get("type", "unknown"),
                        "is_niche_relevant": self._is_relevant_to_seeds(
                            keyword_text, seed_keywords
                        ),
                    },
                ),
            )
            all_keywords.append(kw)

        logger.info(f"Google Trends: total {len(all_keywords)} keywords recopiladas")
        return all_keywords
