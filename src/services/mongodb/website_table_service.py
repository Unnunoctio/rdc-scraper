import asyncio
import traceback

from pymongo import ReturnDocument
from pymongo.collection import Collection

from classes.new_product import NewProduct
from classes.update_product import UpdateProduct
from services.mongodb.mongodb import MongoDB
from services.mongodb.price_log_table_service import PriceLogTableService
from utils.generate import generate_website_id


class WebsiteTableService():
    collection: Collection
    price_log_service: PriceLogTableService

    def __init__(self, mongodb_connection: MongoDB):
        collection_name = "websites"

        collection_list = mongodb_connection.database.list_collection_names()
        if collection_name not in collection_list:
            mongodb_connection.database.create_collection(collection_name)

        self.collection = mongodb_connection.database[collection_name]
        self.price_log_service = PriceLogTableService(mongodb_connection=mongodb_connection)

    def get_all_paths(self) -> list[str] | None:
        try:
            websites = list(self.collection.find())
            return [website["url"] for website in websites]
        except Exception:
            print("Error getting all paths")
            traceback.print_exc()
            return None
        
    async def save_website(self, product: NewProduct, info_id: str, watcher: str) -> str | None:
        try:
            res = self.collection.insert_one({
                "_id": generate_website_id(),
                "infoId": info_id,
                "url": product.url,
                "price": product.price,
                "bestPrice": product.best_price,
                "average": product.average,
                "lastUpdate": watcher,
                "inStock": True,
                "priceLogs": []
            })

            price_log_id = self.price_log_service.save_price_log(price=product.best_price)
            if price_log_id is not None:
                self.collection.update_one(
                    filter={"_id": res.inserted_id},
                    update={"$push": {"priceLogs": price_log_id}}
                )

            return res.inserted_id
        except Exception:
            print("Error saving website")
            traceback.print_exc()
            return None
        
    async def update_website(self, update: UpdateProduct, watcher: str) -> None:
        try:
            website = self.collection.find_one_and_update(
                filter={"url": update.url},
                update={
                    "$set": {
                        "price": update.price,
                        "bestPrice": update.best_price,
                        "average": update.average,
                        "lastUpdate": watcher,
                        "inStock": True
                    }
                },
                upsert=False,
                return_document=ReturnDocument.AFTER
            )
            if website is None:
                return
            
            price_log_id: str | None = None
            if len(website["priceLogs"]) == 0:
                price_log_id = self.price_log_service.save_price_log(price=update.best_price)
            else:
                price_log_id = self.price_log_service.save_or_update_price_log(price_log_id=website["priceLogs"][0], price=update.best_price)

            if price_log_id is not None:
                self.collection.update_one(
                    filter={"_id": website["_id"]},
                    update={"$push": {"priceLogs": price_log_id}}
                )
        except Exception:
            print(f"Error updating website: {update.url}")
            traceback.print_exc()
            return
        
    async def update_many_websites(self, updates: list[UpdateProduct], watcher: str) -> None:
        tasks = [self.update_website(update=update, watcher=watcher) for update in updates]
        await asyncio.gather(*tasks)

    def update_websites_without_stock(self, watcher: str) -> None:
        try:
            self.collection.update_many(
                filter={"lastUpdate": { "$ne": watcher }, "inStock": True },
                update={"$set": { "price": 0, "bestPrice": 0, "inStock": False }}
            )
        except Exception:
            print("Error updating websites without stock")
            traceback.print_exc()
    