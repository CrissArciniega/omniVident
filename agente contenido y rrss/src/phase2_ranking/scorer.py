"""
Modulo de scoring multi-factor para keywords.

Calcula 5 puntuaciones independientes (0-100) para cada keyword deduplicada
y las pondera segun los pesos configurados en config.yaml.

Factores:
    1. volume_estimate    - Estimacion de volumen (fuentes + posiciones)
    2. trend_direction    - Direccion de tendencia (datos de Trends + recencia)
    3. competition_level  - Nivel de competencia (invertido: generico = mas competencia)
    4. commercial_intent  - Intencion comercial (terminos transaccionales)
    5. virality_potential - Potencial viral (fuentes sociales + terminos trending)

Uso:
    from src.phase2_ranking.scorer import KeywordScorer
    scorer = KeywordScorer(weights=scoring_weights)
    scored = scorer.score(dedup_keyword)
"""

import math

from src.phase2_ranking.deduplicator import DeduplicatedKeyword
from src.utils.json_schemas import (
    KeywordScores,
    ScoringWeights,
    TrendData,
    TrendDirection,
)
from src.utils.logger import setup_logger
from src.utils.text_utils import normalize_keyword, remove_spanish_stopwords

logger = setup_logger(__name__, phase="phase2")

# ============================================================================
# CONSTANTES PARA SCORING
# ============================================================================

# Terminos con intencion comercial en espanol
COMMERCIAL_TERMS = frozenset([
    "comprar", "precio", "barato", "baratos", "barata", "baratas",
    "oferta", "ofertas", "descuento", "descuentos", "tienda",
    "envio", "envios", "gratis", "economico", "economicos",
    "economica", "economicas", "costo", "venta", "vender",
    "mayoreo", "mayorista", "proveedor", "proveedores",
    "aliexpress", "amazon", "mercadolibre", "mercado libre",
    "shopee", "shein", "temu", "wish",
    "donde comprar", "cuanto cuesta", "vale la pena",
    "review", "resena", "unboxing", "mejor", "mejores",
    "top", "recomendado", "recomendados", "comparativa",
])

# Terminos indicadores de viralidad / tendencia social
VIRALITY_TERMS = frozenset([
    "viral", "virales", "trending", "trend", "tendencia",
    "tiktok", "tiktoker", "hack", "hacks", "life hack",
    "truco", "trucos", "increible", "increibles",
    "no sabias", "no creerás", "debes tener", "necesitas",
    "challenge", "reto", "nuevo", "nueva", "nuevos", "nuevas",
    "2024", "2025", "2026",
    "moda", "popular", "populares", "favorito", "favoritos",
    "reels", "shorts", "stories",
])

# Fuentes consideradas "sociales" para virality scoring
SOCIAL_SOURCES = frozenset([
    "tiktok_trends",
    "reddit_trends",
    "youtube_autocomplete",
])

# Maximo de fuentes posibles (8 scrapers en Phase 1)
MAX_SOURCES = 8


class KeywordScorer:
    """
    Calculador de scores multi-factor para keywords deduplicadas.

    Cada factor produce un score entre 0 y 100. El total ponderado se
    calcula como la suma de (score_factor * peso_factor) para los 5
    factores, resultando tambien en un valor 0-100 si los pesos suman 1.0.
    """

    def __init__(self, weights: ScoringWeights | None = None):
        """
        Args:
            weights: Pesos para cada factor. Si None, usa pesos iguales.
        """
        if weights is None:
            weights = ScoringWeights(
                volume_estimate=0.25,
                trend_direction=0.25,
                competition_level=0.15,
                commercial_intent=0.20,
                virality_potential=0.15,
            )
        self.weights = weights
        logger.info(
            f"KeywordScorer inicializado con pesos: "
            f"vol={weights.volume_estimate}, trend={weights.trend_direction}, "
            f"comp={weights.competition_level}, comm={weights.commercial_intent}, "
            f"viral={weights.virality_potential}"
        )

    # ========================================================================
    # FACTOR 1: VOLUME ESTIMATE (0-100)
    # ========================================================================

    def _score_volume_estimate(self, kw: DeduplicatedKeyword) -> float:
        """
        Estima el volumen de busqueda basado en:
        - Cantidad de fuentes donde aparece (mas fuentes = mas volumen probable)
        - Posiciones promedio en las fuentes (posicion mas alta = mejor)
        - raw_score si esta disponible

        Logica:
        - source_count / MAX_SOURCES contribuye el 60% del score
        - Posicion promedio contribuye el 25% (posicion 1 = 100, posicion 50+ = 0)
        - raw_score normalizado contribuye el 15%
        """
        # Componente de fuentes (60%)
        source_ratio = min(kw.source_count / MAX_SOURCES, 1.0)
        source_component = source_ratio * 60.0

        # Componente de posicion (25%)
        valid_positions = [p for p in kw.positions if p is not None and p > 0]
        if valid_positions:
            avg_position = sum(valid_positions) / len(valid_positions)
            # Posicion 1 = 100%, posicion 50 = 0%
            position_component = max(0.0, (1.0 - (avg_position - 1) / 49.0)) * 25.0
        else:
            position_component = 12.5  # Neutral si no hay datos de posicion

        # Componente de raw_score (15%)
        if kw.best_raw_score is not None and kw.best_raw_score > 0:
            # Normalizar raw_score: asumimos rango 0-100
            raw_normalized = min(kw.best_raw_score / 100.0, 1.0)
            raw_component = raw_normalized * 15.0
        else:
            raw_component = 7.5  # Neutral

        score = source_component + position_component + raw_component
        return min(max(score, 0.0), 100.0)

    # ========================================================================
    # FACTOR 2: TREND DIRECTION (0-100)
    # ========================================================================

    def _score_trend_direction(self, kw: DeduplicatedKeyword) -> float:
        """
        Evalua la tendencia de la keyword basado en:
        - Datos de Google Trends (trend_info del deduplicator)
        - Presencia en fuentes de tendencia (TikTok, Google Trends)

        Scoring:
        - RISING / NEW: base 80-100
        - STABLE: base 50-65
        - DECLINING: base 10-30
        - Sin datos: base 40-50 (neutral con bonus por fuentes de tendencia)
        """
        trend_info = kw.trend_info
        base_score = 45.0  # Default neutral

        if trend_info:
            direction = trend_info.get("direction")
            growth = trend_info.get("growth_percentage")

            if direction in ("rising", "new"):
                base_score = 80.0
                if growth is not None and growth > 0:
                    # Bonus por crecimiento, max +20 para growth >= 200%
                    growth_bonus = min(growth / 200.0, 1.0) * 20.0
                    base_score += growth_bonus
            elif direction == "stable":
                base_score = 55.0
                if growth is not None and growth > 0:
                    base_score += min(growth / 100.0, 1.0) * 10.0
            elif direction == "declining":
                base_score = 20.0
                if growth is not None and growth < 0:
                    # Penalizacion por caida fuerte
                    decline_penalty = min(abs(growth) / 100.0, 1.0) * 10.0
                    base_score -= decline_penalty

        # Bonus si aparece en fuentes de tendencia (+5 por cada fuente social)
        social_count = sum(1 for s in kw.sources if s in SOCIAL_SOURCES)
        trend_source_bonus = social_count * 5.0

        # Bonus si aparece en google_trends directamente (+10)
        if "google_trends" in kw.sources:
            trend_source_bonus += 10.0

        score = base_score + trend_source_bonus
        return min(max(score, 0.0), 100.0)

    # ========================================================================
    # FACTOR 3: COMPETITION LEVEL (0-100, invertido: menos competencia = mejor)
    # ========================================================================

    def _score_competition_level(self, kw: DeduplicatedKeyword) -> float:
        """
        Estima el nivel de competencia (invertido: score alto = menos competencia).

        Heuristica:
        - Keywords mas largas (mas palabras) = long tail = menos competencia
        - Keywords con mas palabras despues de quitar stopwords = mas especificas
        - Keywords muy cortas/genericas = alta competencia

        Scoring:
        - 1 palabra (sin stopwords): 15-25 (muy competida)
        - 2 palabras: 35-50
        - 3 palabras: 55-70
        - 4+ palabras: 70-90 (long tail, poca competencia)
        """
        cleaned = remove_spanish_stopwords(kw.keyword)
        word_count = len(cleaned.split()) if cleaned else 0
        total_word_count = len(normalize_keyword(kw.keyword).split())

        # Score base por longitud de keyword (sin stopwords)
        if word_count <= 1:
            base_score = 20.0
        elif word_count == 2:
            base_score = 42.0
        elif word_count == 3:
            base_score = 62.0
        elif word_count == 4:
            base_score = 78.0
        else:
            base_score = 88.0

        # Bonus por longitud total (incluyendo stopwords, refleja especificidad)
        if total_word_count >= 5:
            base_score += 8.0
        elif total_word_count >= 4:
            base_score += 4.0

        # Penalizacion leve si aparece en muchas fuentes (señal de keyword generica)
        if kw.source_count >= 6:
            base_score -= 10.0
        elif kw.source_count >= 4:
            base_score -= 5.0

        return min(max(base_score, 0.0), 100.0)

    # ========================================================================
    # FACTOR 4: COMMERCIAL INTENT (0-100)
    # ========================================================================

    def _score_commercial_intent(self, kw: DeduplicatedKeyword) -> float:
        """
        Evalua la intencion comercial de la keyword.

        Busca terminos transaccionales, de comparacion y de marketplaces
        en el texto de la keyword.

        Scoring:
        - Cada termino comercial encontrado suma puntos
        - Terminos de marketplace suman bonus extra
        - Cap a 100
        """
        normalized = normalize_keyword(kw.keyword)
        words = set(normalized.split())

        # Contar coincidencias con terminos comerciales (palabras individuales)
        commercial_matches = 0
        for term in COMMERCIAL_TERMS:
            if " " in term:
                # Termino multi-palabra: buscar en el texto completo
                if term in normalized:
                    commercial_matches += 1
            else:
                if term in words:
                    commercial_matches += 1

        if commercial_matches == 0:
            # Sin ningun indicador comercial
            return 10.0

        # Score base: primer termino vale 35 puntos, cada adicional +15
        base_score = 35.0 + (commercial_matches - 1) * 15.0

        # Bonus si viene de fuentes con alta intencion comercial
        # (google_autocomplete tiende a reflejar busquedas transaccionales)
        if "google_autocomplete" in kw.sources:
            base_score += 5.0

        return min(max(base_score, 0.0), 100.0)

    # ========================================================================
    # FACTOR 5: VIRALITY POTENTIAL (0-100)
    # ========================================================================

    def _score_virality_potential(self, kw: DeduplicatedKeyword) -> float:
        """
        Evalua el potencial viral de la keyword.

        Factores:
        - Presencia en fuentes sociales (TikTok, Reddit, YouTube)
        - Presencia de terminos virales/trending en la keyword
        - Combinacion de ambos factores
        """
        normalized = normalize_keyword(kw.keyword)
        words = set(normalized.split())

        # Componente de fuentes sociales (max 50 puntos)
        social_count = sum(1 for s in kw.sources if s in SOCIAL_SOURCES)
        social_component = min(social_count / len(SOCIAL_SOURCES), 1.0) * 50.0

        # Componente de terminos virales (max 40 puntos)
        virality_matches = 0
        for term in VIRALITY_TERMS:
            if " " in term:
                if term in normalized:
                    virality_matches += 1
            else:
                if term in words:
                    virality_matches += 1

        if virality_matches > 0:
            # Primer termino = 20 puntos, siguientes +8 cada uno, cap 40
            term_component = min(20.0 + (virality_matches - 1) * 8.0, 40.0)
        else:
            term_component = 0.0

        # Bonus sinergico: si tiene ambos (fuentes sociales + terminos virales)
        synergy_bonus = 0.0
        if social_count > 0 and virality_matches > 0:
            synergy_bonus = 10.0

        score = social_component + term_component + synergy_bonus
        return min(max(score, 0.0), 100.0)

    # ========================================================================
    # SCORING COMPLETO
    # ========================================================================

    def score(self, kw: DeduplicatedKeyword) -> tuple[KeywordScores, float, TrendData | None]:
        """
        Calcula todos los scores y el total ponderado para una keyword.

        Args:
            kw: Keyword deduplicada con info fusionada de fuentes.

        Returns:
            Tupla de (KeywordScores, weighted_total, TrendData | None).
        """
        vol = self._score_volume_estimate(kw)
        trend = self._score_trend_direction(kw)
        comp = self._score_competition_level(kw)
        comm = self._score_commercial_intent(kw)
        viral = self._score_virality_potential(kw)

        scores = KeywordScores(
            volume_estimate=round(vol, 2),
            trend_direction=round(trend, 2),
            competition_level=round(comp, 2),
            commercial_intent=round(comm, 2),
            virality_potential=round(viral, 2),
        )

        weighted_total = (
            vol * self.weights.volume_estimate
            + trend * self.weights.trend_direction
            + comp * self.weights.competition_level
            + comm * self.weights.commercial_intent
            + viral * self.weights.virality_potential
        )
        weighted_total = round(min(max(weighted_total, 0.0), 100.0), 2)

        # Construir TrendData si hay info disponible
        trend_data = None
        if kw.trend_info:
            direction_str = kw.trend_info.get("direction")
            if direction_str:
                try:
                    direction_enum = TrendDirection(direction_str)
                except ValueError:
                    direction_enum = TrendDirection.STABLE
            else:
                direction_enum = TrendDirection.STABLE

            trend_data = TrendData(
                direction=direction_enum,
                growth_percentage=kw.trend_info.get("growth_percentage"),
            )

        logger.debug(
            f"Scores para '{kw.keyword}': vol={vol:.1f} trend={trend:.1f} "
            f"comp={comp:.1f} comm={comm:.1f} viral={viral:.1f} "
            f"=> total={weighted_total:.2f}"
        )

        return scores, weighted_total, trend_data

    def score_batch(
        self, keywords: list[DeduplicatedKeyword]
    ) -> list[tuple[DeduplicatedKeyword, KeywordScores, float, TrendData | None]]:
        """
        Calcula scores para una lista de keywords deduplicadas.

        Args:
            keywords: Lista de DeduplicatedKeyword.

        Returns:
            Lista de tuplas (keyword, scores, weighted_total, trend_data)
            ordenada por weighted_total descendente.
        """
        logger.info(f"Scoring de {len(keywords)} keywords...")

        results = []
        for kw in keywords:
            scores, total, trend_data = self.score(kw)
            results.append((kw, scores, total, trend_data))

        # Ordenar por total ponderado descendente
        results.sort(key=lambda x: x[2], reverse=True)

        if results:
            logger.info(
                f"Scoring completo. Mejor: '{results[0][0].keyword}' "
                f"({results[0][2]:.2f}), Peor: '{results[-1][0].keyword}' "
                f"({results[-1][2]:.2f})"
            )

        return results
