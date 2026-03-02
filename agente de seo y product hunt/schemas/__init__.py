"""Schemas de datos para el pipeline de investigación de mercado."""

from .mercadolibre_raw import MLProduct, MLRawCollection
from .amazon_raw import AmazonProduct, AmazonRawCollection
from .enriched_trends import EnrichedProduct, EnrichedTrendsCollection, TrendData
from .analysis_report import AnalysisReport, AnalyzedProduct, PriceAnalysis, MarketGap

__all__ = [
    "MLProduct", "MLRawCollection",
    "AmazonProduct", "AmazonRawCollection",
    "EnrichedProduct", "EnrichedTrendsCollection", "TrendData",
    "AnalysisReport", "AnalyzedProduct", "PriceAnalysis", "MarketGap",
]
