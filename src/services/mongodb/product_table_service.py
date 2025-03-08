
import asyncio
import traceback

from pymongo.collection import Collection

from classes.new_product import NewProduct
from services.mongodb.drink_table_service import DrinkTableService
from services.mongodb.image_table_service import ImageTableService
from services.mongodb.info_table_service import InfoTableService
from services.mongodb.mongodb import MongoDB
from services.mongodb.website_table_service import WebsiteTableService
from utils.generate import generate_product_sku, generate_slug, generate_title


class ProductTableService():
    collection: Collection
    info_service: InfoTableService
    website_service: WebsiteTableService
    image_service: ImageTableService

    def __init__(self, mongodb_connection: MongoDB):
        collection_name = "products"

        collection_list = mongodb_connection.database.list_collection_names()
        if collection_name not in collection_list:
            mongodb_connection.database.create_collection(collection_name)

        self.collection = mongodb_connection.database[collection_name]
        self.info_service = InfoTableService(mongodb_connection=mongodb_connection)
        self.website_service = WebsiteTableService(mongodb_connection=mongodb_connection)
        self.image_service = ImageTableService(mongodb_connection=mongodb_connection)

    async def save_product(self, info_id: str, product: NewProduct, drink: dict | None, watcher: str) -> NewProduct | None:
        if drink is None:
            return NewProduct

        try:
            product_db = self.collection.find_one(filter={"drinkId": drink["_id"], "quantity": product.quantity})
            if product_db is not None:
                new_website_id = await self.website_service.save_website(product=product, info_id=info_id, watcher=watcher)
                if new_website_id is not None:
                    self.collection.update_one(filter={"_id": product_db["_id"]}, update={"$push": {"websites": new_website_id}})
                    return None
            else:
                new_sku = generate_product_sku()
                new_product = self.collection.insert_one({
                    "_id": new_sku,
                    "title": generate_title(drink=drink, quantity=product.quantity),
                    "slug": generate_slug(drink=drink, quantity=product.quantity, sku=new_sku),
                    "quantity": product.quantity,
                    "drinkId": drink["_id"],
                    # TENER UNA IMAGEN POR DEFECTO
                    "websites": []
                })
                if new_product is not None:
                    new_website_id = await self.website_service.save_website(product=product, info_id=info_id, watcher=watcher)
                    new_image_id = self.image_service.save_image(image_url=product.image, category=product.category, brand=product.brand, sku=new_sku)
                    if (new_website_id is not None) and (new_image_id is not None):
                        self.collection.update_one(
                            filter={"_id": new_product.inserted_id},
                            update={"$set": { "imageId": new_image_id }, "$push": {"websites": new_website_id}}
                        )
                        return None

            return NewProduct
        except Exception:
            print("Error while saving product")
            traceback.print_exc()
            return NewProduct

    async def save_many_products(self, products: list[NewProduct], info: dict, drinks: list[dict], watcher: str, drink_service: DrinkTableService) -> list[NewProduct]:
        info_id = self.info_service.get_info_id(info=info)
        if info_id is None:
            return products

        tasks = [self.save_product(info_id=info_id, product=product, drink=drink_service.find_drink_by_product(product=product, drinks=drinks), watcher=watcher) for product in products]
        not_found_products = await asyncio.gather(*tasks)
        return [product for product in not_found_products if product is not None]
