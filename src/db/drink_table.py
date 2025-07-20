import pymongo
import requests

from config import DRINKS_API_URL
from db.mongo_connection import MongoConnection
from utils.logger import Logger
from classes.product import Product


class DrinkTable:
    def __init__(self, mongodb_connection: MongoConnection) -> None:
        self.collection_name = "drinks"

        collection_list = mongodb_connection.database.list_collection_names()
        if self.collection_name not in collection_list:
            mongodb_connection.database.create_collection(self.collection_name)

        self.collection = mongodb_connection.database[self.collection_name]

    def get_drinks(self) -> list[dict]:
        self.save_drinks_from_api()

        drinks = list(self.collection.find())
        return drinks

    def save_drinks_from_api(self) -> None:
        try:
            response = requests.get(DRINKS_API_URL)
            response.raise_for_status()
            drinks_api = response.json()

            update_operations = []
            for drink in drinks_api["data"]:
                try:
                    base_document = {
                        "_id": drink["_id"],
                        "name": drink["name"],
                        "brand": drink["brand"],
                        "abv": drink["abv"],
                        "volume": drink["volume"],
                        "packaging": drink["packaging"],
                        "category": drink["category"],
                        "subCategory": drink["subCategory"],
                        "origin": drink["origin"],
                    }

                    optional_fields = ["variety", "ibu", "servingTemp", "strain", "vineyard"]
                    for field in optional_fields:
                        if field in drink and drink[field] is not None:
                            base_document[field] = drink[field]

                    update_operations.append(
                        pymongo.UpdateOne(
                            filter={"_id": drink["_id"]},
                            update={"$set": base_document},
                            upsert=True,
                        )
                    )
                except Exception as e:
                    Logger.error("DB", f"Error saving drink from API: {drink['_id']}, error: {e}")
                    continue

            self.collection.bulk_write(update_operations)
        except Exception as e:
            Logger.error("API", "Error saving drinks from API:", e)

    def find_drink_by_product(self, product: Product, drinks: list[dict]) -> dict | None:
        drinks_matched = [drink for drink in drinks if (drink["brand"] == product.brand) and (drink["abv"] == product.abv) and (drink["volume"] == product.volume) and (drink["packaging"] == product.packaging)]
        if len(drinks_matched) == 0:
            return None
        
        selected = None
        matched = -1

        title_split = [w for w in product.title.lower().split(" ") if w != ""]
        for drink in drinks_matched:
            name_split = [w for w in drink["name"].lower().split(" ") if w != ""]
            is_match = all(w in title_split for w in name_split)

            if is_match and len(name_split) > matched:
                matched = len(name_split)
                selected = drink

        return selected