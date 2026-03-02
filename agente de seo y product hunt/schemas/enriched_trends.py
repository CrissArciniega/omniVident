"""Schema para datos enriquecidos con Google Trends."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class SourceReference(BaseModel):
    source: str = Field(..., description="'amazon' o 'mercadolibre'")
    product_id: str
    country: str


class TrendData(BaseModel):
    keyword: str
    demand_trend: str = Field(..., pattern="^(rising|stable|declining)$")
    trend_score: int = Field(..., ge=0, le=100)
    interest_over_time: list[int] = Field(default_factory=list, description="Últimas 4 semanas")
    related_queries_rising: list[str] = Field(default_factory=list)


class EnrichedProduct(BaseModel):
    unified_id: str = Field(..., description="ID normalizado del producto")
    product_name: str
    category: str
    source_products: list[SourceReference]
    trend_data: Optional[TrendData] = None


class EnrichedTrendsCollection(BaseModel):
    processing_timestamp: datetime
    total_products: int
    products_with_trends: int
    products: list[EnrichedProduct]
