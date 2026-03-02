"""Schema del reporte de análisis final - contrato principal entre analyzer y publisher."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class CountryPrice(BaseModel):
    price: Optional[float] = None
    currency: str
    price_usd: Optional[float] = None
    available: bool = Field(default=False, description="Si el producto está disponible en este país")


class PriceAnalysis(BaseModel):
    prices_by_country: dict[str, CountryPrice]
    price_range_usd: Optional[dict] = Field(default=None, description="{'min': float, 'max': float}")
    median_price_usd: Optional[float] = None
    price_variance: Optional[float] = Field(default=None, description="Varianza de precio entre países (0-1)")


class DemandMetrics(BaseModel):
    total_sales_estimate: int = Field(default=0)
    average_rating: Optional[float] = Field(default=None, ge=0, le=5)
    trend_score: Optional[int] = Field(default=None, ge=0, le=100)
    demand_trend: Optional[str] = Field(default=None, pattern="^(rising|stable|declining)$")


class MarketGap(BaseModel):
    gap_type: str = Field(..., description="price_arbitrage|low_competition|high_demand|supply_gap|regional_trend")
    description: str
    confidence: str = Field(..., pattern="^(high|medium|low)$")


class AnalyzedProduct(BaseModel):
    rank: int
    opportunity_score: float = Field(..., ge=0, le=100)
    product_name: str
    category: str
    price_analysis: PriceAnalysis
    demand_metrics: DemandMetrics
    market_gaps: list[MarketGap] = Field(default_factory=list)
    top_country: Optional[str] = None
    sources: list[str] = Field(default_factory=list, description="ej: ['mercadolibre_MX', 'amazon_USA']")
    product_urls: dict[str, str] = Field(default_factory=dict, description="URLs por fuente")


class AnalysisReport(BaseModel):
    report_timestamp: datetime
    report_week: str = Field(..., description="Formato ISO: 2026-W06")
    total_products_analyzed: int
    top_products: list[AnalyzedProduct]
    insights: list[str] = Field(default_factory=list, description="Insights generados por el analyzer")
