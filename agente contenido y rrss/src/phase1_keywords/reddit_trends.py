"""
Scraper de tendencias de Reddit.

Usa la API publica JSON de Reddit (no requiere autenticacion) para
obtener posts trending en subreddits relevantes en espanol.

Uso:
    from src.phase1_keywords.reddit_trends import RedditTrendsScraper
    scraper = RedditTrendsScraper()
    keywords = scraper.fetch(seed_keywords=["gadgets baratos"])
"""

from typing import Any

from src.utils.http_client import HttpClient
from src.utils.json_schemas import KeywordRaw, KeywordSource, KeywordMetadata
from src.utils.logger import setup_logger
from src.utils.retry import retry
from src.utils.text_utils import extract_potential_keywords

logger = setup_logger(__name__, phase="phase1")


class RedditTrendsScraper:
    """Scraper de tendencias de Reddit usando API publica JSON."""

    def __init__(self, config: dict[str, Any] | None = None):
        self.config = config or {}
        self.subreddits = self.config.get("subreddits", [
            "mexico", "LatinAmerica", "compras",
        ])
        self.max_posts = self.config.get("max_posts_per_sub", 25)
        delay = self.config.get("delay_between_requests", 1.0)
        self.client = HttpClient(delay=delay)

    @retry(max_attempts=3, base_delay=2.0)
    def _fetch_subreddit_hot(self, subreddit: str) -> list[dict[str, Any]]:
        """Obtiene posts hot de un subreddit."""
        url = f"https://www.reddit.com/r/{subreddit}/hot.json"
        params = {
            "limit": self.max_posts,
            "t": "month",
        }

        data = self.client.get_json(url, params=params)
        posts = []

        if "data" in data and "children" in data["data"]:
            for child in data["data"]["children"]:
                post_data = child.get("data", {})
                title = post_data.get("title", "")
                selftext = post_data.get("selftext", "")
                score = post_data.get("score", 0)
                num_comments = post_data.get("num_comments", 0)

                if title:
                    posts.append({
                        "title": title,
                        "selftext": selftext[:500],
                        "score": score,
                        "num_comments": num_comments,
                        "subreddit": subreddit,
                    })

        return posts

    def _extract_keywords_from_posts(
        self, posts: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """Extrae keywords potenciales de los titulos y textos de posts."""
        keywords_found: list[dict[str, Any]] = []

        # Keywords del nicho para filtrar relevancia
        niche_terms = {
            "gadget", "producto", "compra", "aliexpress", "amazon",
            "barato", "importa", "china", "tecnologia", "accesorio",
            "novedoso", "innovador", "oferta", "descuento", "envio",
            "tienda", "online", "precio", "calidad", "recomend",
            "tiktok", "viral", "trending", "review", "unboxing",
        }

        for post in posts:
            title = post["title"].lower()

            # Verificar si el post es relevante al nicho
            is_relevant = any(term in title for term in niche_terms)

            if is_relevant:
                # El titulo completo como keyword si es suficientemente corto
                if len(title.split()) <= 8:
                    keywords_found.append({
                        "keyword": title,
                        "source_detail": f"reddit_title_r/{post['subreddit']}",
                        "relevance": post["score"] + post["num_comments"],
                    })

                # Extraer keywords individuales del titulo
                potential = extract_potential_keywords(title, min_length=4)
                for word in potential:
                    if word in niche_terms or len(word) >= 6:
                        keywords_found.append({
                            "keyword": word,
                            "source_detail": f"reddit_word_r/{post['subreddit']}",
                            "relevance": post["score"],
                        })

        return keywords_found

    def fetch(self, seed_keywords: list[str]) -> list[KeywordRaw]:
        """
        Obtiene keywords de tendencias en Reddit.

        Args:
            seed_keywords: Lista de keywords semilla (usadas como contexto).

        Returns:
            Lista de KeywordRaw con las keywords encontradas.
        """
        all_keywords: list[KeywordRaw] = []
        seen: set[str] = set()

        for subreddit in self.subreddits:
            logger.info(f"Reddit: obteniendo posts de r/{subreddit}...")

            try:
                posts = self._fetch_subreddit_hot(subreddit)
                keywords_from_posts = self._extract_keywords_from_posts(posts)

                count = 0
                for i, kw_data in enumerate(keywords_from_posts):
                    kw_text = kw_data["keyword"].lower().strip()
                    if kw_text and kw_text not in seen:
                        seen.add(kw_text)
                        kw = KeywordRaw(
                            keyword=kw_text,
                            source=KeywordSource.REDDIT_TRENDS,
                            language="es",
                            raw_score=float(kw_data.get("relevance", 0)),
                            metadata=KeywordMetadata(
                                position_in_source=i + 1,
                                parent_seed=subreddit,
                                extra={
                                    "source_detail": kw_data.get("source_detail", ""),
                                },
                            ),
                        )
                        all_keywords.append(kw)
                        count += 1

                logger.info(f"Reddit: {count} keywords de r/{subreddit}")

            except Exception as e:
                logger.error(f"Reddit fallo para r/{subreddit}: {e}")
                continue

        self.client.close()
        logger.info(f"Reddit: total {len(all_keywords)} keywords recopiladas")
        return all_keywords
