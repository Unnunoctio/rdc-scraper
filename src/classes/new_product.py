import re

from spiders.spider_types import CencosudProduct


class NewProduct:
    website: str
    url: str | None
    sku: str | None
    title: str | None
    brand: str | None
    category: str | None
    price: int | None
    best_price: int | None
    image: str | None
    average: float
    abv: float | None
    volume: int | None
    quantity: int | None
    packaging: str | None

    def __init__(self, website: str):
        self.website = website
        self.url = None
        self.sku = None
        self.title = None
        self.brand = None
        self.category = None
        self.price = None
        self.best_price = None
        self.image = None
        self.average = 0
        self.abv = None
        self.volume = None
        self.quantity = None
        self.packaging = None

    def __str__(self) -> str:
        return f"""
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

    def is_complete(self) -> bool:
        return (self.url is not None) and (self.sku is not None) and (self.title is not None) and (self.brand is not None) and (self.category is not None) and (self.price is not None) and (self.price > 0) and (self.best_price is not None) and (self.best_price > 0) and (self.image is not None) and (self.abv is not None) and (self.volume is not None) and (self.quantity is not None) and (self.packaging is not None)

    def set_cencosud_data(self, data: CencosudProduct, page_url: str) -> None:
        if "productName" not in data:
            return

        # Main Data
        try:
            self.url = f"{page_url}/{data['linkText']}/p"
            self.sku = data["productId"]
            self.title = data["productName"]
            self.brand = data["brand"]
            self.category = data["categories"][0].split("/")[2]
            self.price = data["items"][0]["sellers"][0]["commertialOffer"]["PriceWithoutDiscount"]
            self.best_price = data["items"][0]["sellers"][0]["commertialOffer"]["Price"]
        except Exception as e:
            print("Error setting main cencosud data: ", e)

        # Image Data
        try:
            self.image = data["items"][0]["images"][0]["imageUrl"]
        except Exception as e:
            print("Error setting image cencosud data: ", e)

        # ABV Data
        if "Graduación Alcohólica" in data:
            match = re.search(r'(\d+(?:\.\d+)?)°', data["Graduación Alcohólica"][0])
            self.abv = float(match.group(1)) if match else None

        if "°" in data["productName"] and self.abv is None:
            match = re.search(r'(\d+(?:\.\d+)?)°', data["productName"])
            self.abv = float(match.group(1)) if match else None

        # Volume Data
        if self.volume is None:
            match = re.search(r'(\d+(?:\.\d+)?) (cc|L)', data["productName"], re.IGNORECASE)
            if match:
                amount = float(match.group(1))
                unit = match.group(2).lower()
                self.volume = int(amount * 1000) if unit == 'l' else int(amount)

        # Quantity Data
        if "Pack" in data["productName"]:
            if "Cantidad" in data:
                match = re.search(r'(\d+) unidades', data["Cantidad"][0])
                self.quantity = int(match.group(1)) if match else None
            
            if self.quantity is None:
                match = re.search(r'(\d+)\s*un\.', data["productName"], re.IGNORECASE)
                self.quantity = int(match.group(1)) if match else None
        elif "Bipack" in data["productName"]:
            self.quantity = 2
        else:
            self.quantity = 1

        # Packaging Data
        if self.category == "Destilados":
            self.packaging = "Botella"
        
        if "Envase" in data:
            envase = data["Envase"][0].lower()
            if "botella" in envase:
                self.packaging = "Botella"
            elif "lata" in envase:
                self.packaging = "Lata"
            elif "barril" in envase:
                self.packaging = "Barril"
            elif "tetrapack" in envase:
                self.packaging = "Tetrapack"
            elif "caja" in envase:
                if self.category == "Destilados":
                    self.packaging = "Botella"
                elif self.category == "Vinos":
                    self.packaging = "Tetrapack"
        
        if self.packaging is None:
            title_lower = data["productName"].lower()
            if "botella" in title_lower:
                self.packaging = "Botella"
            elif "lata" in title_lower:
                self.packaging = "Lata"
            elif "barril" in title_lower:
                self.packaging = "Barril"
            elif "tetrapack" in title_lower or "caja" in title_lower:
                self.packaging = "Tetrapack"