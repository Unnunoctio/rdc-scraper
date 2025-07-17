
class Product:
    def __init__(self, type: str, website: str) -> None:
        self.type = type
        self.website = website
        self.url: str | None = None
        self.sku: str | None = None
        self.title: str | None = None
        self.brand: str | None = None
        self.category: str | None = None
        self.price: int | None = None
        self.best_price: int | None = None
        self.image: str | None = None
        self.average: float | None = None
        self.abv: float | None = None
        self.volume: int | None = None
        self.quantity: int | None = None
        self.packaging: str | None = None
    
    def __str__(self) -> str:
        return f"""
        Product: {self.type}
        Website: {self.website}
        URL: {self.url}
        SKU: {self.sku}
        Title: {self.title}
        Brand: {self.brand}
        Category: {self.category}
        Price: {self.price}
        Best Price: {self.best_price}
        Image: {self.image}
        Average: {self.average}
        ABV: {self.abv}
        Volume: {self.volume}
        Quantity: {self.quantity}
        Packaging: {self.packaging}
        """
    