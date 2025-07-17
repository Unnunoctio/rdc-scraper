
class Product:
    def __init__(self, type: str, website: str) -> None:
        self.type = type
        self.website = website
        self.url: str = None
        self.sku: str = None
        self.title: str = None
        self.brand: str = None
        self.category: str = None
        self.price: int = None
        self.best_price: int = None
        self.image: str = None
        self.average: float = None
        self.abv: float = None
        self.volume: int = None
        self.quantity: int = None
        self.packaging: str = None
    
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
    