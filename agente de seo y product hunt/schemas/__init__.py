"""Schemas de datos para el pipeline de investigación de mercado."""

from .mercadolibre_raw import MLProduct, MLRawCollection
from .amazon_raw import AmazonProduct, AmazonRawCollection
from .temu_raw import TemuProduct, TemuRawCollection
from .alibaba_raw import AlibabaProduct, AlibabaRawCollection
from .enriched_trends import EnrichedProduct, EnrichedTrendsCollection, TrendData
from .analysis_report import AnalysisReport, AnalyzedProduct, PriceAnalysis, MarketGap

__all__ = [
    "MLProduct", "MLRawCollection",
    "AmazonProduct", "AmazonRawCollection",
    "TemuProduct", "TemuRawCollection",
    "AlibabaProduct", "AlibabaRawCollection",
    "EnrichedProduct", "EnrichedTrendsCollection", "TrendData",
    "AnalysisReport", "AnalyzedProduct", "PriceAnalysis", "MarketGap",
]
