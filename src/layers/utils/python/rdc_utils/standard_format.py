from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime


@dataclass
class ScrapedProduct:
    name: str
    price: int  # precio sin descuento (PriceWithoutDiscount)
    best_price: int  # precio final que paga el cliente (Price)
    url: str
    source: str
    scraped_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())
    brand: str | None = None
    image_url: str | None = None
    volume_ml: int | None = None
    abv: float | None = None
    category: str | None = None
    sku: str | None = None
    quantity: int | None = None  # unidades en el pack (1 si es individual)
    packaging: str | None = None  # Botella | Lata | Barril | Tetrapack

    def to_dict(self) -> dict:
        return {k: v for k, v in asdict(self).items() if v is not None}

    def is_complete(self) -> bool:
        return (
            self.url is not None
            and self.sku is not None
            and self.name is not None
            and self.brand is not None
            and self.category is not None
            and self.price is not None
            and self.price > 0
            and self.best_price is not None
            and self.best_price > 0
            and self.image_url is not None
            and self.abv is not None
            and self.volume_ml is not None
            and self.quantity is not None
            and self.packaging is not None
        )


def create_product(
    name: str,
    price: int,
    best_price: int,
    url: str,
    source: str,
    brand: str | None = None,
    image_url: str | None = None,
    volume_ml: int | None = None,
    abv: float | None = None,
    category: str | None = None,
    sku: str | None = None,
    quantity: int | None = None,
    packaging: str | None = None,
) -> dict:
    return ScrapedProduct(
        name=name,
        price=price,
        best_price=best_price,
        url=url,
        source=source,
        brand=brand,
        image_url=image_url,
        volume_ml=volume_ml,
        abv=abv,
        category=category,
        sku=sku,
        quantity=quantity,
        packaging=packaging,
    ).to_dict()
