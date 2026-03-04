"""Schema para datos scrapeados de Temu bestsellers."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class TemuProduct(BaseModel):
    product_id: str = Field(..., description="ID del producto en Temu")
    title: str
    price: float = Field(..., description="Precio actual")
    original_price: Optional[float] = Field(default=None, description="Precio original antes de descuento")
    currency: str = Field(default="USD")
    discount_pct: Optional[int] = Field(default=None, description="Porcentaje de descuento")
    rating: Optional[float] = Field(default=None, ge=0, le=5)
    reviews_count: Optional[int] = Field(default=None)
    sold_text: Optional[str] = Field(default=None, description="Texto de ventas (ej: '10K+ sold')")
    image_url: Optional[str] = None
    permalink: Optional[str] = None
    category_name: str = Field(default="", description="Nombre de la categoria")
    ranking: Optional[int] = Field(default=None, description="Posicion en ranking bestsellers")


class TemuRawCollection(BaseModel):
    collection_timestamp: datetime
    country: str = Field(..., pattern="^(USA|MX|CO|EC)$")
    source: str = Field(default="temu")
    category_name: str = Field(default="Bestsellers")
    total_results: int
    products: list[TemuProduct]
