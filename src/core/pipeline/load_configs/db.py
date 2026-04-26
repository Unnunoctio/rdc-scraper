import os

from pymongo import MongoClient

_client = MongoClient(os.environ["MONGODB_URI"])
_db = _client[os.environ["MONGODB_DB"]]


def insert_info_if_not_exists(info: dict):
    """Insert an info document only if its code doesn't exist yet."""
    existing = _db.infos.find_one({"code": info["code"]}, {"_id": 1})
    if existing:
        print(f"[DB] Info already exists, skipping: {info['code']}")
        return
    _db.infos.insert_one(info)
    print(f"[DB] Info inserted: {info['code']}")
