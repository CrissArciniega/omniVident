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
    category: str
    url: Optional[str] = None
    image_url: Optional[str] = None


class AmazonRawCollection(BaseModel):
    collection_timestamp: datetime
    country: str = Field(..., pattern="^(USA|MX)$")
    source: str = Field(default="amazon")
    domain: str
    category: str
    total_results: int
    products: list[AmazonProduct]
