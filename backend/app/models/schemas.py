from pydantic import BaseModel
from typing import Optional


class Variant(BaseModel):
    label: str
    color: str


class ProductCreate(BaseModel):
    name: str
    description: str
    price: float
    categoryId: str
    subcategoryId: str
    variants: list[Variant]
    published: bool = True


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    categoryId: Optional[str] = None
    subcategoryId: Optional[str] = None
    variants: Optional[list[Variant]] = None
    published: Optional[bool] = None


class BgRemoveRequest(BaseModel):
    productId: str
    imageUrl: str


class Generate3DRequest(BaseModel):
    productId: str
    imageUrl: str
