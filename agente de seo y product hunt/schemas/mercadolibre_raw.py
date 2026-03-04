"""Schema para datos crudos recolectados de MercadoLibre API."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class MLProduct(BaseModel):
    product_id: str = Field(..., description="ID del producto en MercadoLibre (ej: MLM123456789)")
    title: str
    price: float
    currency: str = Field(..., description="Código de moneda (MXN, COP, USD)")
    category_id: str
    category_name: str
    permalink: str
    seller_id: str
    sold_quantity: int = Field(default=0, description="Cantidad vendida")
    rating_average: Optional[float] = Field(default=None, ge=0, le=5)
    reviews_count: int = Field(default=0)
    available_quantity: int = Field(default=0)
    condition: str = Field(default="new")
    thumbnail: Optional[str] = None
    ranking: Optional[int] = Field(default=None, description="Posición en ranking de más vendidos")
    ranking_label: Optional[str] = Field(default=None, description="Etiqueta del ranking (ej: '1° MÁS VENDIDO')")


class MLRawCollection(BaseModel):
    collection_timestamp: datetime
    country: str = Field(..., pattern="^(EC|MX|CO)$")
    source: str = Field(default="mercadolibre")
    site_id: str = Field(..., description="Site ID de ML (MEC, MLM, MCO)")
    category_id: str
    category_name: str
    total_results: int
    products: list[MLProduct]
