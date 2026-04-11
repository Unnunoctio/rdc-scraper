import asyncio
import os
from datetime import datetime, timezone
from typing import Optional

import aiohttp
import boto3

s3 = boto3.client("s3")

DRINKS_API_URL = os.environ["DRINKS_API_URL"].rstrip("/")
DRINKS_API_KEY = os.environ.get("DRINKS_API_KEY", "")
S3_IMAGES_BUCKET = os.environ["S3_IMAGES_BUCKET"]


# ============= ENTRY POINT =============

def handler(event, context):
    """
    For each scraped product:
      1. URL exists in DB?  -> update price if changed
      2. URL not found      -> search drinks API by product data
         a. Match found + product in DB  -> add web_source
         b. Match found + product NOT in DB  -> create product + upload image to S3
         c. No match  -> add to unmatched list

    Returns:
        {
            "updated": int,
            "added_to_existing": int,
            "created": int,
            "unmatched_count": int,
            "unmatched": [ ...ScrapedProduct dicts... ]
        }
    """
    products = event.get("products", [])

    if not products:
        return _empty_result()

    result = asyncio.run(_sync_all(products))
    print(
        f"[SyncWithApi] updated={result['updated']} "
        f"added_to_existing={result['added_to_existing']} "
        f"created={result['created']} "
        f"unmatched={result['unmatched_count']}"
    )
    return result


# ============= ORCHESTRATION =============

async def _sync_all(products: list[dict]) -> dict:
    stats: dict = {"updated": 0, "added_to_existing": 0, "created": 0, "unmatched": []}

    async with aiohttp.ClientSession() as session:
        tasks = [_process_product(session, product, stats) for product in products]
        await asyncio.gather(*tasks, return_exceptions=True)

    stats["unmatched_count"] = len(stats["unmatched"])
    return stats


async def _process_product(session: aiohttp.ClientSession, product: dict, stats: dict):
    url = product.get("url")
    price = product.get("price")

    try:
        # 1. Check if URL already exists in DB
        existing = await _get_product_by_url(session, url)

        if existing:
            if existing.get("current_price") != price:
                await _update_price(session, existing["_id"], product)
                stats["updated"] += 1
            return

        # 2. URL not found — search drinks API
        drink = await _search_drinks(session, product)

        if not drink:
            stats["unmatched"].append(product)
            return

        drink_id = drink["_id"]

        # 3. Check if drink already has a DB product
        db_product = await _get_product_by_drink_id(session, drink_id)

        if db_product:
            # 4a. Product exists — just add this web source
            await _add_web_source(session, db_product["_id"], product)
            stats["added_to_existing"] += 1
        else:
            # 4b. New product — upload image + create
            image_url = await _upload_image(session, drink_id, product.get("image_url"))
            await _create_product(session, drink, product, image_url)
            stats["created"] += 1

    except Exception as e:
        print(f"[SyncWithApi] Error processing {url}: {e}")
        stats["unmatched"].append(product)


# ============= DRINKS API CLIENT =============

def _headers() -> dict:
    h: dict = {"Content-Type": "application/json"}
    if DRINKS_API_KEY:
        h["Authorization"] = f"Bearer {DRINKS_API_KEY}"
    return h


async def _get_product_by_url(session: aiohttp.ClientSession, url: str) -> Optional[dict]:
    try:
        async with session.get(
            f"{DRINKS_API_URL}/products/by-url",
            params={"url": url},
            headers=_headers(),
        ) as resp:
            return await resp.json() if resp.status == 200 else None
    except Exception as e:
        print(f"[SyncWithApi] get_product_by_url error: {e}")
        return None


async def _search_drinks(session: aiohttp.ClientSession, product: dict) -> Optional[dict]:
    params: dict = {"q": product["name"]}
    if product.get("brand"):
        params["brand"] = product["brand"]
    if product.get("volume_ml"):
        params["volume_ml"] = str(product["volume_ml"])

    try:
        async with session.get(
            f"{DRINKS_API_URL}/drinks/search",
            params=params,
            headers=_headers(),
        ) as resp:
            if resp.status == 200:
                results = await resp.json()
                return results[0] if results else None
            return None
    except Exception as e:
        print(f"[SyncWithApi] search_drinks error for '{product['name']}': {e}")
        return None


async def _get_product_by_drink_id(session: aiohttp.ClientSession, drink_id: str) -> Optional[dict]:
    try:
        async with session.get(
            f"{DRINKS_API_URL}/products/by-drink/{drink_id}",
            headers=_headers(),
        ) as resp:
            return await resp.json() if resp.status == 200 else None
    except Exception as e:
        print(f"[SyncWithApi] get_product_by_drink_id error: {e}")
        return None


async def _update_price(session: aiohttp.ClientSession, product_id: str, scraped: dict):
    now = _now()
    payload = {
        "current_price": scraped["price"],
        "updated_at": now,
        "price_history_entry": {"price": scraped["price"], "date": now},
    }
    try:
        async with session.patch(
            f"{DRINKS_API_URL}/products/{product_id}/price",
            json=payload,
            headers=_headers(),
        ) as resp:
            if resp.status not in (200, 204):
                print(f"[SyncWithApi] update_price failed for {product_id}: HTTP {resp.status}")
    except Exception as e:
        print(f"[SyncWithApi] update_price error for {product_id}: {e}")


async def _add_web_source(session: aiohttp.ClientSession, product_id: str, scraped: dict):
    now = _now()
    payload = {
        "source": scraped["source"],
        "url": scraped["url"],
        "current_price": scraped["price"],
        "original_price": scraped.get("original_price"),
        "price_history": [{"price": scraped["price"], "date": now}],
        "added_at": now,
    }
    try:
        async with session.post(
            f"{DRINKS_API_URL}/products/{product_id}/sources",
            json=payload,
            headers=_headers(),
        ) as resp:
            if resp.status not in (200, 201):
                print(f"[SyncWithApi] add_web_source failed for {product_id}: HTTP {resp.status}")
    except Exception as e:
        print(f"[SyncWithApi] add_web_source error for {product_id}: {e}")


async def _create_product(
    session: aiohttp.ClientSession,
    drink: dict,
    scraped: dict,
    image_url: Optional[str],
):
    now = _now()
    payload = {
        "drink_id": drink["_id"],
        "image_url": image_url,
        "web_sources": [
            {
                "source": scraped["source"],
                "url": scraped["url"],
                "current_price": scraped["price"],
                "original_price": scraped.get("original_price"),
                "price_history": [{"price": scraped["price"], "date": now}],
                "added_at": now,
            }
        ],
        "created_at": now,
        "last_synced": now,
    }
    try:
        async with session.post(
            f"{DRINKS_API_URL}/products",
            json=payload,
            headers=_headers(),
        ) as resp:
            if resp.status not in (200, 201):
                body = await resp.text()
                print(f"[SyncWithApi] create_product failed for drink {drink['_id']}: HTTP {resp.status} — {body}")
    except Exception as e:
        print(f"[SyncWithApi] create_product error for drink {drink['_id']}: {e}")


# ============= S3 IMAGE UPLOAD =============

async def _upload_image(
    session: aiohttp.ClientSession,
    drink_id: str,
    image_url: Optional[str],
) -> Optional[str]:
    if not image_url:
        return None

    try:
        async with session.get(image_url) as resp:
            if resp.status != 200:
                return None
            image_data = await resp.read()
            content_type = resp.headers.get("Content-Type", "image/jpeg")

        key = f"images/drinks/{drink_id}.jpg"
        s3.put_object(
            Bucket=S3_IMAGES_BUCKET,
            Key=key,
            Body=image_data,
            ContentType=content_type,
        )
        return f"https://{S3_IMAGES_BUCKET}.s3.amazonaws.com/{key}"

    except Exception as e:
        print(f"[SyncWithApi] upload_image error for {drink_id}: {e}")
        return None


# ============= HELPERS =============

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _empty_result() -> dict:
    return {
        "updated": 0,
        "added_to_existing": 0,
        "created": 0,
        "unmatched_count": 0,
        "unmatched": [],
    }
