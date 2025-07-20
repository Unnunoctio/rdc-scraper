from pymongo import MongoClient

from config import MONGO_DB, MONGO_URI
from utils.logger import Logger


class MongoConnection:
    def __init__(self) -> None:
        try:
            self.client = MongoClient(MONGO_URI)
            self.database = self.client[MONGO_DB]
            Logger.info("DB", "MongoDB connection established")
        except Exception as e:
            Logger.error("DB", "Error connecting to MongoDB:", e)

    def close_connection(self) -> None:
        try:
            self.client.close()
            Logger.info("DB", "MongoDB connection closed")
        except Exception as e:
            Logger.error("DB", "Error closing MongoDB connection:", e)
