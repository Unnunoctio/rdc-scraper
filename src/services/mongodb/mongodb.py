from pymongo import MongoClient
from pymongo.database import Database

from config import MONGO_DB, MONGO_URI


class MongoDB():
    client: MongoClient
    database: Database

    def __init__(self):
        self.client = MongoClient(MONGO_URI)
        self.database = self.client[MONGO_DB]
        print("MongoDB connection started.")

    def close_connection(self) -> None:
        self.client.close()
        print("MongoDB connection closed.")