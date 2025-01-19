from enum import Enum
from typing import Optional, TypedDict


# TODO: SPIDER TYPES
class SpiderName(Enum):
    JUMBO = "Jumbo"

# TODO: CENCOSUD TYPES
class CencosudCommertialOffer(TypedDict):
    Price: int
    PriceWithoutDiscount: int
    AvailableQuantity: int

class CencosudSeller(TypedDict):
    commertialOffer: CencosudCommertialOffer

class CencosudImage(TypedDict):
    imageUrl: str

class CencosudItem(TypedDict):
    images: list[CencosudImage]
    sellers: list[CencosudSeller]

class CencosudProduct(TypedDict, total=False):
    productId: str
    productName: str
    brand: str
    categories: list[str]
    linkText: str
    items: list[CencosudItem]
    Graduación_Alcohólica: Optional[list[str]]
    Grado: Optional[list[str]]
    Envase: Optional[list[str]]
    Cantidad: Optional[list[str]]
    Contenido: Optional[list[str]]

class CencosudResponse(TypedDict):
    products: list[CencosudProduct]
    recordsFiltered: int

class CencosudAverage(TypedDict):
    average: float
    totalCount: int
    id: str







