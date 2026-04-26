import asyncio

import aiohttp
import db
from image_uploader import upload_image
from utils import CATEGORY_MAP, PACKAGING_MAP_ES


def handler(event, context):
    """
    Input:
        event["matched"]:    [{"product": ..., "drink": ...}]
        event["unmatched"]:  [...ScrapedProduct]
        event["sync_token"]: str
        event["category"]:   str

    Returns:
        {"sync_token": str}
    """
    matched = event.get("matched", [])
    sync_token = event["sync_token"]
    category = event.get("category", "")

    if matched:
        added, created, failed = asyncio.run(_sync_all(matched, sync_token))
        print(f"[SyncProduct] category={category} added={added} created={created} errors={len(failed)}")

    return {"sync_token": sync_token}


async def _sync_all(matched: list[dict], sync_token: str) -> tuple[int, int, list]:
    database = db.get_db()
    await db.load_info_cache(database)

    async with aiohttp.ClientSession() as session:
        results = await asyncio.gather(*[_sync_one(database, session, item["product"], item["drink"], sync_token) for item in matched])

    added = sum(1 for status, _ in results if status == "added")
    created = sum(1 for status, _ in results if status == "created")
    failed = [p for status, p in results if status == "error"]
    return added, created, failed


async def _sync_one(database, session: aiohttp.ClientSession, product: dict, drink: dict, sync_token: str) -> tuple:
    try:
        packaging_es = PACKAGING_MAP_ES.get(drink.get("packaging", ""), drink.get("packaging", ""))
        existing = await database.products.find_one(
            {
                "drink.id": drink["id"],
                "drink.volume": drink["volume"],
                "drink.packaging": packaging_es,
                "quantity": product.get("quantity", 1),
            }
        )
        if existing:
            await db.add_website(database, existing["_id"], product, sync_token)
            return "added", None

        # Reserve a unique SKU before uploading the image — avoids orphaned S3 files
        # if the DB insert were to fail due to a collision.
        sku = await db.unique_sku(database)
        category = CATEGORY_MAP.get(product.get("category", ""), "").lower()
        image_url = await upload_image(session, sku, category, product.get("image_url"))
        await db.create_product(database, drink, product, image_url, sync_token, sku)
        return "created", None
    except Exception as e:
        print(f"[SyncProduct] Error for '{product.get('url')}': {e}")
        return "error", product
