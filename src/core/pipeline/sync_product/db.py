import asyncio
import os
from datetime import datetime, timezone
from typing import Optional

from pymongo import AsyncMongoClient
from utils import PACKAGING_MAP_ES, SPIRIT_TYPE_MAP_ES, generate_product_name, generate_product_slug, generate_sku

MONGODB_URI = os.environ["MONGODB_URI"]
MONGODB_DB = os.environ["MONGODB_DB"]

_loop = asyncio.new_event_loop()
asyncio.set_event_loop(_loop)
_client = AsyncMongoClient(MONGODB_URI)
_info_cache: dict[str, object] = {}


def run(coro):
    return _loop.run_until_complete(coro)


def get_db():
    return _client[MONGODB_DB]


def get_info_id(source: str) -> Optional[object]:
    return _info_cache.get(source)


async def load_info_cache(database):
    """Load Info documents keyed by source code. No-op on container reuse."""
    if _info_cache:
        return
    async for doc in database.infos.find({}, {"_id": 1, "code": 1}):
        _info_cache[doc["code"]] = doc["_id"]
    print(f"[DB] Info cache loaded: {list(_info_cache.keys())}")


async def unique_sku(database) -> str:
    """Generate a SKU guaranteed not to exist in the products collection."""
    while True:
        sku = generate_sku()
        if not await database.products.find_one({"sku": sku}, {"_id": 1}):
            return sku


async def add_website(database, product_id: object, scraped: dict, sync_token: str):
    info_id = get_info_id(scraped.get("source", ""))
    url = scraped["url"]

    await database.products.update_one(
        {"_id": product_id},
        {
            "$push": {
                "websites": {
                    "info": info_id,
                    "path": url,
                    "price": scraped["price"],
                    "bestPrice": scraped["best_price"],
                    "lastUpdate": sync_token,
                    "inStock": True,
                }
            }
        },
    )
    await _upsert_today_price_log(database, product_id, url, scraped["price"], scraped["best_price"])


async def create_product(database, drink: dict, scraped: dict, image_url: Optional[str], sync_token: str, sku: str):
    info_id = get_info_id(scraped.get("source", ""))
    url = scraped["url"]
    quantity = scraped.get("quantity", 1)
    category = scraped.get("category", "")

    name = generate_product_name(drink=drink, category=category, quantity=quantity)
    slug = generate_product_slug(sku=sku, name=name, volume_ml=drink["volume"])

    result = await database.products.insert_one(
        {
            "sku": sku,
            "name": name,
            "slug": slug,
            "quantity": quantity,
            "category": category,
            "drink": {
                **drink,
                "packaging": PACKAGING_MAP_ES.get(drink.get("packaging", ""), drink.get("packaging", "")),
                **({"type": SPIRIT_TYPE_MAP_ES.get(drink["type"], drink["type"])} if drink.get("type") else {}),
            },
            "images": [image_url] if image_url else [],
            "websites": [
                {
                    "info": info_id,
                    "path": url,
                    "price": scraped["price"],
                    "bestPrice": scraped["best_price"],
                    "lastUpdate": sync_token,
                    "inStock": True,
                }
            ],
        }
    )
    await _upsert_today_price_log(database, result.inserted_id, url, scraped["price"], scraped["best_price"])


async def _upsert_today_price_log(database, product_id, website_path: str, price: int, best_price: int):
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    existing = await database.priceLogs.find_one(
        {
            "productId": product_id,
            "websitePath": website_path,
            "date": today,
        }
    )
    if existing:
        await database.priceLogs.update_one(
            {"_id": existing["_id"]},
            {"$set": {"price": price, "bestPrice": best_price}},
        )
    else:
        await database.priceLogs.insert_one(
            {
                "productId": product_id,
                "websitePath": website_path,
                "price": price,
                "bestPrice": best_price,
                "date": today,
            }
        )
