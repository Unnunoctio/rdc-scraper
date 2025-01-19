import traceback

import pymongo
import requests
from pymongo.collection import Collection

from classes.new_product import NewProduct
from config import DRINKS_API
from services.mongodb.mongodb import MongoDB


class DrinkTableService():
    collection: Collection
    
    def __init__(self, mongodb_connection: MongoDB):
        collection_name = "drinks"

        collection_list = mongodb_connection.database.list_collection_names()
        if collection_name not in collection_list:
            mongodb_connection.database.create_collection(collection_name)

        self.collection = mongodb_connection.database[collection_name]

    def get_drinks(self) -> list[dict]:
        self.save_drinks_from_api()

        drinks = list(self.collection.find())
        return drinks

    def save_drinks_from_api(self) -> None:
        try:
            res = requests.get(DRINKS_API)
            res.raise_for_status()
            drinks_api = res.json()

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
                            upsert=True
                        )
                    )
                except Exception:
                    print(f"Error saving drink: {drink['_id']}")
                    traceback.print_exc()

            self.collection.bulk_write(update_operations)
        except Exception as e:
            print(f"Error getting drins from API: {e}")

    def find_drink_by_product(self, product: NewProduct, drinks: list[dict]) -> dict | None:
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