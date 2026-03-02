"""
Modulo de deduplicacion de keywords por similitud fuzzy.

Agrupa keywords similares usando rapidfuzz (via src.utils.text_utils.similarity_score)
y conserva la que aparece en mas fuentes, fusionando la informacion de origen.

Uso:
    from src.phase2_ranking.deduplicator import KeywordDeduplicator
    deduplicator = KeywordDeduplicator(threshold=85)
    deduplicated = deduplicator.deduplicate(keywords_raw)
"""

from dataclasses import dataclass, field

from src.utils.json_schemas import KeywordRaw
from src.utils.logger import setup_logger
from src.utils.text_utils import normalize_keyword, similarity_score

logger = setup_logger(__name__, phase="phase2")


@dataclass
class DeduplicatedKeyword:
    """Keyword deduplicada con informacion fusionada de multiples fuentes."""

    keyword: str
    normalized: str
    sources: list[str] = field(default_factory=list)
    source_count: int = 0
    best_raw_score: float | None = None
    positions: list[int | None] = field(default_factory=list)
    raw_entries: list[KeywordRaw] = field(default_factory=list)
    trend_info: dict | None = None


class KeywordDeduplicator:
    """
    Deduplicador de keywords basado en similitud fuzzy.

    Agrupa keywords cuya similitud (rapidfuzz ratio) supera el umbral
    configurado. De cada grupo conserva la keyword representante que
    aparece en mas fuentes distintas y fusiona la informacion de origen.
    """

    def __init__(self, threshold: float = 85.0):
        """
        Args:
            threshold: Umbral de similitud (0-100) para considerar dos
                       keywords como duplicadas. Default 85 (configurable
                       desde config.yaml scoring.deduplication_threshold).
        """
        self.threshold = threshold
        logger.info(f"KeywordDeduplicator inicializado (threshold={self.threshold})")

    def deduplicate(
        self, keywords: list[KeywordRaw]
    ) -> list[DeduplicatedKeyword]:
        """
        Deduplicar una lista de keywords crudas.

        Proceso:
        1. Normaliza cada keyword.
        2. Agrupa por similitud fuzzy (ratio >= threshold).
        3. Para cada grupo selecciona la keyword representante (la que
           aparece en mas fuentes distintas; si empatan, la de mejor
           raw_score).
        4. Fusiona las fuentes y metadatos del grupo en la representante.

        Args:
            keywords: Lista de KeywordRaw provenientes de Phase 1.

        Returns:
            Lista de DeduplicatedKeyword con fuentes fusionadas, ordenada
            por source_count descendente.
        """
        if not keywords:
            logger.warning("Lista de keywords vacia, nada que deduplicar")
            return []

        logger.info(f"Deduplicando {len(keywords)} keywords (threshold={self.threshold})")

        # -- Paso 1: construir mapa normalizado -> lista de KeywordRaw ----------
        norm_map: dict[str, list[KeywordRaw]] = {}
        for kw in keywords:
            norm = normalize_keyword(kw.keyword)
            if not norm:
                continue
            norm_map.setdefault(norm, []).append(kw)

        logger.debug(f"Keywords unicas por normalizacion exacta: {len(norm_map)}")

        # -- Paso 2: agrupar por similitud fuzzy --------------------------------
        groups: list[list[str]] = []
        assigned: set[str] = set()
        norm_keys = list(norm_map.keys())

        for i, key_a in enumerate(norm_keys):
            if key_a in assigned:
                continue

            group = [key_a]
            assigned.add(key_a)

            for j in range(i + 1, len(norm_keys)):
                key_b = norm_keys[j]
                if key_b in assigned:
                    continue

                sim = similarity_score(key_a, key_b)
                if sim >= self.threshold:
                    group.append(key_b)
                    assigned.add(key_b)

            groups.append(group)

        logger.info(f"Grupos formados: {len(groups)} (de {len(norm_keys)} normalizados)")

        # -- Paso 3: seleccionar representante y fusionar -----------------------
        deduplicated: list[DeduplicatedKeyword] = []

        for group_norms in groups:
            # Reunir todas las entradas crudas del grupo
            all_entries: list[KeywordRaw] = []
            for norm in group_norms:
                all_entries.extend(norm_map[norm])

            # Calcular fuentes unicas
            unique_sources = list({entry.source.value for entry in all_entries})

            # Seleccionar la keyword representante: la que aparece en mas
            # fuentes distintas. Si empatan, usar la de mayor raw_score.
            candidate_scores: dict[str, tuple[int, float]] = {}
            for entry in all_entries:
                norm = normalize_keyword(entry.keyword)
                sources_of_entry = {
                    e.source.value
                    for e in all_entries
                    if normalize_keyword(e.keyword) == norm
                }
                raw = entry.raw_score if entry.raw_score is not None else 0.0
                prev = candidate_scores.get(norm, (0, 0.0))
                candidate_scores[norm] = (
                    max(prev[0], len(sources_of_entry)),
                    max(prev[1], raw),
                )

            # Ordenar candidatos: mas fuentes primero, luego mayor raw_score
            best_norm = max(
                candidate_scores,
                key=lambda n: (candidate_scores[n][0], candidate_scores[n][1]),
            )

            # Elegir la forma textual original mas comun de la keyword ganadora
            original_forms: dict[str, int] = {}
            for entry in all_entries:
                if normalize_keyword(entry.keyword) == best_norm:
                    original_forms[entry.keyword] = original_forms.get(entry.keyword, 0) + 1

            representative_text = max(original_forms, key=original_forms.get)  # type: ignore[arg-type]

            # Recopilar posiciones en fuentes
            positions = [
                entry.metadata.position_in_source
                for entry in all_entries
                if entry.metadata.position_in_source is not None
            ]

            # Mejor raw_score del grupo
            raw_scores = [
                entry.raw_score
                for entry in all_entries
                if entry.raw_score is not None
            ]
            best_raw = max(raw_scores) if raw_scores else None

            # Extraer info de tendencia si existe (de Google Trends u otra fuente)
            trend_info = None
            for entry in all_entries:
                extra = entry.metadata.extra
                if extra.get("trend_direction") or extra.get("growth_percentage"):
                    trend_info = {
                        "direction": extra.get("trend_direction"),
                        "growth_percentage": extra.get("growth_percentage"),
                    }
                    break

            dedup = DeduplicatedKeyword(
                keyword=representative_text,
                normalized=best_norm,
                sources=unique_sources,
                source_count=len(unique_sources),
                best_raw_score=best_raw,
                positions=positions,
                raw_entries=all_entries,
                trend_info=trend_info,
            )
            deduplicated.append(dedup)

        # Ordenar por cantidad de fuentes descendente
        deduplicated.sort(key=lambda d: d.source_count, reverse=True)

        logger.info(
            f"Deduplicacion completa: {len(keywords)} -> {len(deduplicated)} keywords"
        )

        return deduplicated
