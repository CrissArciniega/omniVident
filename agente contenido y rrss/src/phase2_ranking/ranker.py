"""
Pipeline principal de Phase 2 - Ranking de Keywords.

Lee las keywords crudas de Phase 1, las deduplicada, las puntua con
5 factores ponderados y selecciona el top N para las fases siguientes.

Uso directo:
    python -m src.phase2_ranking.ranker

Uso programatico:
    from src.phase2_ranking.ranker import KeywordRanker
    ranker = KeywordRanker()
    result = ranker.run()
"""

from datetime import datetime, timezone
from pathlib import Path

from src.phase2_ranking.deduplicator import KeywordDeduplicator
from src.phase2_ranking.scorer import KeywordScorer
from src.utils.file_helpers import (
    ensure_dir,
    get_run_id,
    load_yaml_config,
    read_json,
    write_json,
)
from src.utils.json_schemas import (
    KeywordsRawCollection,
    Phase2Metadata,
    ScoredKeyword,
    ScoringWeights,
    TopKeywordsCollection,
)
from src.utils.logger import setup_logger
from src.utils.text_utils import to_slug

logger = setup_logger(__name__, phase="phase2")


class KeywordRanker:
    """
    Orquestador de Phase 2: deduplicacion, scoring y seleccion top N.

    Pipeline:
    1. Lee keywords_raw.json de output/phase1_raw/
    2. Deduplicada por similitud fuzzy
    3. Calcula scores multi-factor para cada keyword
    4. Ordena por score ponderado descendente
    5. Selecciona top N (default 10)
    6. Genera slugs URL-safe
    7. Escribe top_keywords.json en output/phase2_ranked/
    """

    def __init__(self, config_path: str | Path | None = None):
        """
        Args:
            config_path: Ruta a config.yaml. Si None, busca en la ubicacion
                         por defecto del proyecto.
        """
        if config_path is None:
            config_path = Path(__file__).parent.parent.parent / "config" / "config.yaml"

        self.config = load_yaml_config(config_path)

        # Configuracion de scoring
        scoring_config = self.config.get("scoring", {})
        weights_config = scoring_config.get("weights", {})

        self.weights = ScoringWeights(
            volume_estimate=weights_config.get("volume_estimate", 0.25),
            trend_direction=weights_config.get("trend_direction", 0.25),
            competition_level=weights_config.get("competition_level", 0.15),
            commercial_intent=weights_config.get("commercial_intent", 0.20),
            virality_potential=weights_config.get("virality_potential", 0.15),
        )

        self.dedup_threshold = scoring_config.get("deduplication_threshold", 0.85)
        # El threshold en config esta como ratio 0-1, convertir a 0-100 si es necesario
        if self.dedup_threshold <= 1.0:
            self.dedup_threshold *= 100.0

        self.min_sources = scoring_config.get("min_sources_required", 1)

        # Configuracion de pipeline
        pipeline_config = self.config.get("pipeline", {})
        self.top_n = pipeline_config.get("top_keywords_count", 10)

        # Rutas de entrada y salida
        output_config = self.config.get("output", {})
        self.input_dir = Path(output_config.get("phase1_dir", "output/phase1_raw"))
        self.output_dir = Path(output_config.get("phase2_dir", "output/phase2_ranked"))

    def _load_raw_keywords(self) -> KeywordsRawCollection:
        """
        Carga keywords crudas desde el archivo de salida de Phase 1.

        Returns:
            KeywordsRawCollection validada con Pydantic.

        Raises:
            FileNotFoundError: Si keywords_raw.json no existe.
        """
        input_file = self.input_dir / "keywords_raw.json"
        logger.info(f"Cargando keywords crudas desde: {input_file}")

        raw_data = read_json(input_file)
        collection = KeywordsRawCollection.model_validate(raw_data)

        logger.info(
            f"Keywords crudas cargadas: {len(collection.keywords)} "
            f"(run={collection.metadata.pipeline_run_id})"
        )
        return collection

    def run(self, run_id: str | None = None) -> TopKeywordsCollection:
        """
        Ejecuta el pipeline completo de Phase 2.

        Args:
            run_id: ID de ejecucion del pipeline. Si no se proporciona,
                    se intenta reutilizar el de Phase 1 o se genera uno nuevo.

        Returns:
            TopKeywordsCollection con el top N de keywords rankeadas.
        """
        logger.info("=== PHASE 2: Keyword Ranking START ===")

        # -- Paso 1: Cargar keywords crudas -----------------------------------
        raw_collection = self._load_raw_keywords()

        if run_id is None:
            run_id = raw_collection.metadata.pipeline_run_id
        logger.info(f"Pipeline run ID: {run_id}")

        total_raw = len(raw_collection.keywords)

        # -- Paso 2: Deduplicar -----------------------------------------------
        logger.info(f"--- Deduplicacion (threshold={self.dedup_threshold:.0f}%) ---")
        deduplicator = KeywordDeduplicator(threshold=self.dedup_threshold)
        deduplicated = deduplicator.deduplicate(raw_collection.keywords)

        # Filtrar por minimo de fuentes requeridas
        if self.min_sources > 1:
            before_filter = len(deduplicated)
            deduplicated = [
                d for d in deduplicated if d.source_count >= self.min_sources
            ]
            logger.info(
                f"Filtrado por min_sources={self.min_sources}: "
                f"{before_filter} -> {len(deduplicated)}"
            )

        after_dedup = len(deduplicated)

        # -- Paso 3: Scoring multi-factor --------------------------------------
        logger.info("--- Scoring multi-factor ---")
        scorer = KeywordScorer(weights=self.weights)
        scored_results = scorer.score_batch(deduplicated)

        # -- Paso 4: Seleccionar top N -----------------------------------------
        top_results = scored_results[: self.top_n]
        logger.info(f"Top {self.top_n} seleccionados de {len(scored_results)} candidatos")

        # -- Paso 5: Construir modelos de salida --------------------------------
        top_keywords: list[ScoredKeyword] = []
        for rank, (kw, scores, total, trend_data) in enumerate(top_results, start=1):
            slug = to_slug(kw.keyword)

            scored_kw = ScoredKeyword(
                rank=rank,
                keyword=kw.keyword,
                slug=slug,
                scores=scores,
                weighted_total=total,
                sources_found_in=kw.sources,
                source_count=kw.source_count,
                trend_data=trend_data,
            )
            top_keywords.append(scored_kw)

            logger.info(
                f"  #{rank}: '{kw.keyword}' (slug={slug}) "
                f"score={total:.2f} fuentes={kw.source_count}"
            )

        # -- Paso 6: Construir metadata -----------------------------------------
        metadata = Phase2Metadata(
            generated_at=datetime.now(timezone.utc),
            pipeline_run_id=run_id,
            total_raw_keywords=total_raw,
            after_deduplication=after_dedup,
            scoring_weights=self.weights,
        )

        result = TopKeywordsCollection(
            metadata=metadata,
            top_keywords=top_keywords,
        )

        # -- Paso 7: Escribir resultado -----------------------------------------
        ensure_dir(self.output_dir)
        output_file = self.output_dir / "top_keywords.json"
        write_json(output_file, result.model_dump(mode="json"))

        logger.info("=== PHASE 2: COMPLETADA ===")
        logger.info(f"Keywords crudas: {total_raw}")
        logger.info(f"Despues de deduplicacion: {after_dedup}")
        logger.info(f"Top keywords seleccionadas: {len(top_keywords)}")
        logger.info(f"Output: {output_file}")

        return result


# Entry point para ejecucion directa
if __name__ == "__main__":
    from dotenv import load_dotenv

    load_dotenv()

    ranker = KeywordRanker()
    result = ranker.run()

    print(f"\nPhase 2 completada: {len(result.top_keywords)} top keywords seleccionadas")
    print("\nRanking:")
    for kw in result.top_keywords:
        print(
            f"  #{kw.rank}: {kw.keyword} "
            f"(score={kw.weighted_total:.2f}, fuentes={kw.source_count})"
        )
