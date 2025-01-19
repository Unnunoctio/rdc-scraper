import traceback

from pymongo.collection import Collection

from services.mongodb.mongodb import MongoDB
from utils.generate import generate_info_id


class InfoTableService():
    collection: Collection

    def __init__(self, mongodb_connection: MongoDB):
        collection_name = "infos"

        collection_list = mongodb_connection.database.list_collection_names()
        if collection_name not in collection_list:
            mongodb_connection.database.create_collection(collection_name)

        self.collection = mongodb_connection.database[collection_name]

    def get_info_id(self, info: dict) -> str | None:
        try:
            info_db = self.collection.find_one(filter={"name": info["name"]})
            if info_db is None:
                return self.save_info(info=info)
            return info_db["_id"]
        except Exception:
            print(f"Error getting info id: {info['name']}")
            traceback.print_exc()
            return None

    def save_info(self, info: dict) -> str | None:
        try:
            res = self.collection.insert_one({
                "_id": generate_info_id(),
                "name": info["name"],
                "logo": info["logo"]
            })
            return res.inserted_id
        except Exception:
            print(f"Error saving info: {info['name']}")
            traceback.print_exc()
            return None
