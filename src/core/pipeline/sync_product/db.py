import asyncio
import os
from datetime import datetime, timezone
from typing import Optional

from pymongo import AsyncMongoClient

from utils import CATEGORY_MAP, OPTIONAL_DRINK_FIELDS, generate_sku

MONGODB_URI = os.environ["MONGODB_URI"]
MONGODB_DB = os.environ["MONGODB_DB"]

_loop = asyncio.new_event_loop()
asyncio.set_event_loop(_loop)

_mongo_client = AsyncMongoClient(MONGODB_URI)
_info_cache: dict[str, str] = {}


def run(coro):
    """Run a coroutine on the persistent event loop."""
    return _loop.run_until_complete(coro)


def get_db():
    return _mongo_client[MONGODB_DB]


def get_info_id(source: str) -> Optional[str]:
    return _info_cache.get(source)


async def load_info_cache(db):
    """Load Info documents keyed by code. No-op if already populated (container reuse)."""
    if _info_cache:
        return
    async for doc in db.infos.find({}, {"_id": 1, "code": 1}):
        _info_cache[doc["code"]] = doc["_id"]
    print(f"[DB] Info cache loaded: {list(_info_cache.keys())}")


async def add_website(db, product_id: str, scraped: dict, sync_token: str):
    info_id = get_info_id(scraped.get("source", ""))

    await db.products.update_one(
        {"_id": product_id},
        {"$push": {"websites": {
            "info": info_id,
            "path": scraped["url"],
            "price": scraped["price"],
            "bestPrice": scraped["best_price"],
            "lastUpdate": sync_token,
            "inStock": True,
        }}},
    )
    await _upsert_today_price_log(db, product_id, scraped["url"], scraped["price"], scraped["best_price"])


async def create_product(db, drink: dict, scraped: dict, image_url: Optional[str], sync_token: str):
    info_id = get_info_id(scraped.get("source", ""))
    category = CATEGORY_MAP.get(scraped.get("category", ""), "")

    drink_doc = {
        "id": drink["id"],
        "name": drink["name"],
        "brand": drink["brand"],
        "abv": drink["abv"],
        "packaging": drink["packaging"],
        "volume": drink["volume"],
        "country": drink["country"],
        **{k: drink[k] for k in OPTIONAL_DRINK_FIELDS if drink.get(k) is not None},
    }

    result = await db.products.insert_one({
        "sku": generate_sku(),
        "quantity": scraped.get("quantity", 1),
        "category": category,
        "drink": drink_doc,
        "images": [image_url] if image_url else [],
        "websites": [{
            "info": info_id,
            "path": scraped["url"],
            "price": scraped["price"],
            "bestPrice": scraped["best_price"],
            "lastUpdate": sync_token,
            "inStock": True,
        }],
    })
    await _upsert_today_price_log(db, result.inserted_id, scraped["url"], scraped["price"], scraped["best_price"])


async def _upsert_today_price_log(db, product_id, website_path: str, price: int, best_price: int) -> None:
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    existing = await db.priceLogs.find_one({
        "productId": product_id,
        "websitePath": website_path,
        "date": today,
    })
    if existing:
        await db.priceLogs.update_one(
            {"_id": existing["_id"]},
            {"$set": {"price": price, "bestPrice": best_price}},
        )
    else:
        await db.priceLogs.insert_one({
            "productId": product_id,
            "websitePath": website_path,
            "price": price,
            "bestPrice": best_price,
            "date": today,
        })
