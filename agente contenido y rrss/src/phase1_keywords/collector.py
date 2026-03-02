"""
Collector de Phase 1 - Orquesta todos los scrapers de keywords.

Ejecuta los 8 scrapers de keywords, unifica los resultados y escribe
el archivo de salida keywords_raw.json.

Uso directo:
    python -m src.phase1_keywords.collector

Uso programatico:
    from src.phase1_keywords.collector import KeywordCollector
    collector = KeywordCollector()
    result = collector.run()
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from src.phase1_keywords.google_autocomplete import GoogleAutocompleteScraper
from src.phase1_keywords.google_related import GoogleRelatedScraper
from src.phase1_keywords.google_trends import GoogleTrendsScraper
from src.phase1_keywords.people_also_ask import PeopleAlsoAskScraper
from src.phase1_keywords.perplexity_trends import PerplexityTrendsScraper
from src.phase1_keywords.reddit_trends import RedditTrendsScraper
from src.phase1_keywords.tiktok_trends import TikTokTrendsScraper
from src.phase1_keywords.youtube_autocomplete import YouTubeAutocompleteScraper
from src.utils.file_helpers import load_yaml_config, write_json, get_run_id, ensure_dir
from src.utils.json_schemas import (
    KeywordRaw,
    KeywordsRawCollection,
    Phase1Metadata,
)
from src.utils.logger import setup_logger

logger = setup_logger(__name__, phase="phase1")

# Mapeo de nombre de fuente a clase scraper
SCRAPERS = {
    "google_trends": GoogleTrendsScraper,
    "google_autocomplete": GoogleAutocompleteScraper,
    "youtube_autocomplete": YouTubeAutocompleteScraper,
    "tiktok_trends": TikTokTrendsScraper,
    "people_also_ask": PeopleAlsoAskScraper,
    "reddit_trends": RedditTrendsScraper,
    "google_related": GoogleRelatedScraper,
    "perplexity_trends": PerplexityTrendsScraper,
}


class KeywordCollector:
    """Orquestador de Phase 1 que ejecuta todos los scrapers."""

    def __init__(self, config_path: str | Path | None = None):
        if config_path is None:
            config_path = Path(__file__).parent.parent.parent / "config" / "config.yaml"

        self.config = load_yaml_config(config_path)
        self.seed_keywords = self.config.get("seed_keywords", [])
        self.sources_config = self.config.get("sources", {})
        self.output_dir = Path(self.config.get("output", {}).get("phase1_dir", "output/phase1_raw"))

    def run(self, run_id: str | None = None) -> KeywordsRawCollection:
        """
        Ejecuta todos los scrapers habilitados y recopila keywords.

        Args:
            run_id: ID de ejecucion del pipeline. Si no se proporciona, se genera uno.

        Returns:
            KeywordsRawCollection con todas las keywords recopiladas.
        """
        if run_id is None:
            run_id = get_run_id()

        logger.info(f"=== PHASE 1: Keyword Research START (run={run_id}) ===")
        logger.info(f"Seed keywords: {len(self.seed_keywords)}")
        logger.info(f"Fuentes configuradas: {len(self.sources_config)}")

        all_keywords: list[KeywordRaw] = []
        sources_attempted = 0
        sources_succeeded = 0
        sources_with_results = 0
        sources_empty: list[str] = []
        sources_failed: list[str] = []

        for source_name, scraper_class in SCRAPERS.items():
            source_config = self.sources_config.get(source_name, {})

            # Verificar si la fuente esta habilitada
            if not source_config.get("enabled", True):
                logger.info(f"Fuente '{source_name}' deshabilitada, saltando")
                continue

            sources_attempted += 1
            logger.info(f"--- Ejecutando fuente: {source_name} ---")

            try:
                scraper = scraper_class(config=source_config)
                keywords = scraper.fetch(seed_keywords=self.seed_keywords)

                if keywords:
                    all_keywords.extend(keywords)
                    sources_succeeded += 1
                    sources_with_results += 1
                    logger.info(
                        f"Fuente '{source_name}': {len(keywords)} keywords OK"
                    )
                else:
                    sources_succeeded += 1  # No fallo, solo vacio
                    sources_empty.append(source_name)
                    logger.warning(
                        f"Fuente '{source_name}': ejecuto sin error pero 0 keywords. "
                        f"Posible problema con selectores o API."
                    )

            except Exception as e:
                logger.error(f"Fuente '{source_name}' FALLO: {e}")
                sources_failed.append(source_name)

        # Construir la coleccion de salida
        metadata = Phase1Metadata(
            generated_at=datetime.now(timezone.utc),
            pipeline_run_id=run_id,
            seed_keywords=self.seed_keywords,
            sources_attempted=sources_attempted,
            sources_succeeded=sources_succeeded,
            sources_failed=sources_failed,
            total_keywords_collected=len(all_keywords),
        )

        result = KeywordsRawCollection(
            metadata=metadata,
            keywords=all_keywords,
        )

        # Guardar resultado
        ensure_dir(self.output_dir)
        output_file = self.output_dir / "keywords_raw.json"
        write_json(output_file, result.model_dump(mode="json"))

        logger.info(f"=== PHASE 1: COMPLETADA ===")
        logger.info(f"Total keywords: {len(all_keywords)}")
        logger.info(
            f"Fuentes con resultados: {sources_with_results}/{sources_attempted} "
            f"(exitosas: {sources_succeeded}, fallidas: {len(sources_failed)})"
        )
        if sources_empty:
            logger.warning(
                f"Fuentes que ejecutaron OK pero sin resultados: {sources_empty}"
            )
        if sources_failed:
            logger.error(f"Fuentes fallidas: {sources_failed}")
        logger.info(f"Output: {output_file}")

        return result


# Entry point para ejecucion directa
if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()

    collector = KeywordCollector()
    result = collector.run()
    print(f"\nPhase 1 completada: {result.metadata.total_keywords_collected} keywords recopiladas")
