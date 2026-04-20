import os

from pymongo import AsyncMongoClient

MONGODB_URI = os.environ["MONGODB_URI"]
MONGODB_DB = os.environ["MONGODB_DB"]

_mongo_client = AsyncMongoClient(MONGODB_URI)


def get_db():
    return _mongo_client[MONGODB_DB]


async def mark_out_of_stock(db, sync_token: str) -> int:
    result = await db.products.update_many(
        {"websites": {"$elemMatch": {
            "lastUpdate": {"$ne": sync_token},
            "inStock": True,
        }}},
        {"$set": {
            "websites.$[elem].inStock": False,
            "websites.$[elem].price": 0,
            "websites.$[elem].bestPrice": 0,
        }},
        array_filters=[{
            "elem.lastUpdate": {"$ne": sync_token},
            "elem.inStock": True,
        }],
    )
    return result.modified_count
