"""Schema para datos scrapeados de Alibaba (B2B wholesale marketplace)."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class AlibabaProduct(BaseModel):
    product_id: str = Field(..., description="ID del producto en Alibaba")
    title: str
    price_min: Optional[float] = Field(default=None, description="Precio minimo del rango")
    price_max: Optional[float] = Field(default=None, description="Precio maximo del rango")
    currency: str = Field(default="USD")
    moq: Optional[int] = Field(default=None, description="Minimum Order Quantity")
    moq_text: Optional[str] = Field(default=None, description="Texto MOQ original (ej: '100 Pieces')")
    supplier_name: Optional[str] = Field(default=None)
    supplier_country: Optional[str] = Field(default=None)
    supplier_verified: bool = Field(default=False, description="Verified Supplier badge")
    orders_count: Optional[int] = Field(default=None, description="Total orders/transactions")
    rating: Optional[float] = Field(default=None, ge=0, le=5)
    reviews_count: Optional[int] = Field(default=None)
    image_url: Optional[str] = None
    permalink: Optional[str] = None
    category_name: str = Field(default="", description="Nombre de la categoria")


class AlibabaRawCollection(BaseModel):
    collection_timestamp: datetime
    country: str = Field(default="GLOBAL", pattern="^GLOBAL$")
    source: str = Field(default="alibaba")
    category_name: str = Field(default="Top Products")
    total_results: int
    products: list[AlibabaProduct]
