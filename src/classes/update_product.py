from spiders.spider_types import CencosudProduct

class UpdateProduct:
    url: str | None
    sku: str | None
    price: int | None
    best_price: int | None
    average: int

    def __init__(self):
        self.url = None
        self.sku = None
        self.price = None
        self.best_price = None
        self.average = 0

    def is_complete(self) -> bool:
        return (self.url is not None) and (self.sku is not None) and (self.price is not None) and (self.price > 0) and (self.best_price is not None) and (self.best_price > 0)
    
    def set_cencosud_data(self, data: CencosudProduct, page_url: str) -> None:
        try:
            self.url = f"{page_url}/{data['linkText']}/p"
            self.sku = data["productId"]
            self.price = data["items"][0]["sellers"][0]["commertialOffer"]["PriceWithoutDiscount"]
            self.best_price = data["items"][0]["sellers"][0]["commertialOffer"]["Price"]
        except Exception as e:
            print("Error setting cencosud data: ", e)