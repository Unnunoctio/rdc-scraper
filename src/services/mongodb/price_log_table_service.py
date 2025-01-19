import traceback
from datetime import datetime

from pymongo.collection import Collection

from services.mongodb.mongodb import MongoDB
from utils.generate import generate_price_log_id


class PriceLogTableService():
    collection: Collection

    def __init__(self, mongodb_connection: MongoDB):
        collection_name = "price_logs"

        collection_list = mongodb_connection.database.list_collection_names()
        if collection_name not in collection_list:
            mongodb_connection.database.create_collection(collection_name)

        self.collection = mongodb_connection.database[collection_name]

    def save_price_log(self, price: int) -> str | None:
        try:
            current_date = datetime.now()

            res = self.collection.insert_one({
                "_id": generate_price_log_id(),
                "date": current_date.strftime("%Y-%m-%d"),
                "price": price
            })
            return res.inserted_id
        except Exception:
            print("Error while saving price log")
            traceback.print_exc()
            return None
        
    def save_or_update_price_log(self, price_log_id: str, price: int) -> str | None:
        try:
            price_log_db = self.collection.find_one(filter={"_id": price_log_id})
            if price_log_db is None:
                return None
            
            current_date = datetime.now()

            if price_log_db["date"] == current_date.strftime("%Y-%m-%d"):
                self.collection.update_one(
                    filter={"_id": price_log_id},
                    update={"$set": {"price": price}}
                )
                return None

            return self.save_price_log(price=price)
        except Exception:
            print("Error while save or update price log")
            traceback.print_exc()
            return None