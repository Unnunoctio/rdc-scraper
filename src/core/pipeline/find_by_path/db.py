import asyncio
import os
from datetime import datetime, timezone

from pymongo import AsyncMongoClient

MONGODB_URI = os.environ["MONGODB_URI"]
MONGODB_DB = os.environ["MONGODB_DB"]

# Persistent loop reused across Lambda invocations (container reuse).
# AsyncMongoClient binds to the loop active at creation time —
# using asyncio.run() each invocation would create a new loop and break the client.
_loop = asyncio.new_event_loop()
asyncio.set_event_loop(_loop)

_client = AsyncMongoClient(MONGODB_URI)
_info_cache: dict[str, str] = {}


def run(coro):
    """Run a coroutine on the persistent event loop."""
    return _loop.run_until_complete(coro)


def get_db():
    return _client[MONGODB_DB]


async def load_info_cache(db) -> None:
    """Populate info cache keyed by code. No-op on container reuse."""
    if _info_cache:
        return
    async for doc in db.infos.find({}, {"_id": 1, "code": 1}):
        _info_cache[doc["code"]] = doc["_id"]
    print(f"[DB] Info cache loaded: {list(_info_cache.keys())}")


async def update_price_if_changed(db, db_product: dict, scraped: dict, sync_token: str) -> bool:
    url = scraped["url"]
    website = next((w for w in db_product.get("websites", []) if w.get("path") == url), None)
    if not website:
        return False

    price = scraped["price"]
    best_price = scraped["best_price"]
    price_changed = website.get("price") != price or website.get("bestPrice") != best_price

    await _upsert_price_log_today(db, db_product["_id"], url, price, best_price)

    update = {"websites.$.lastUpdate": sync_token, "websites.$.inStock": True}
    if price_changed:
        update["websites.$.price"] = price
        update["websites.$.bestPrice"] = best_price

    await db.products.update_one(
        {"_id": db_product["_id"], "websites.path": url},
        {"$set": update},
    )
    return price_changed


async def _upsert_price_log_today(db, product_id, website_path: str, price: int, best_price: int) -> None:
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    existing = await db.priceLogs.find_one({"productId": product_id, "websitePath": website_path, "date": today})

    if existing:
        await db.priceLogs.update_one({"_id": existing["_id"]}, {"$set": {"price": price, "bestPrice": best_price}})
    else:
        await db.priceLogs.insert_one({
            "productId": product_id,
            "websitePath": website_path,
            "price": price,
            "bestPrice": best_price,
            "date": today,
        })
