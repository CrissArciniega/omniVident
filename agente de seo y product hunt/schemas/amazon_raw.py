"""Schema para datos scrapeados de Amazon bestsellers."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class AmazonProduct(BaseModel):
    asin: Optional[str] = Field(default=None, description="Amazon Standard Identification Number")
    title: str
    price: Optional[float] = Field(default=None, description="Precio puede no estar disponible")
    currency: str = Field(default="USD")
    rating: Optional[float] = Field(default=None, ge=0, le=5)
    reviews_count: Optional[int] = Field(default=None)
    bestseller_rank: Optional[int] = Field(default=None)
    category: str = Field(default="")
    category_name: str = Field(default="", description="Nombre legible de la categoria")
    url: Optional[str] = None
    image_url: Optional[str] = None
    seller_id: Optional[str] = Field(default=None, description="Nombre del vendedor")
    ranking: Optional[int] = Field(default=None, description="Posicion en ranking bestsellers")
    ranking_label: Optional[str] = Field(default=None, description="Etiqueta del ranking (ej: '#1 Best Seller')")


class AmazonRawCollection(BaseModel):
    collection_timestamp: datetime
    country: str = Field(..., pattern="^(USA|MX|CO)$")
    source: str = Field(default="amazon")
    domain: str
    site_id: str = Field(default="", description="ID del sitio (ej: USA, MX)")
    category_id: str = Field(default="all")
    category_name: str = Field(default="Bestsellers - All Categories")
    total_results: int
    products: list[AmazonProduct]
