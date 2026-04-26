import asyncio
import json
import os

import boto3
import db

_s3 = boto3.client("s3")
_bucket = os.environ.get("S3_PIPELINE_BUCKET", "")


def load_batch(s3_key: str) -> list[dict]:
    obj = _s3.get_object(Bucket=_bucket, Key=s3_key)
    products = json.loads(obj["Body"].read())
    _s3.delete_object(Bucket=_bucket, Key=s3_key)
    return products


def handler(event, context):
    """
    Input:
        event["s3_key"]:     str — S3 key of the batch written by MergeResults
        event["category"]:   str
        event["sync_token"]: str — execution start time used as lastUpdate marker

    Returns:
        {"remaining": [...ScrapedProduct], "sync_token": str, "category": str}
    """
    s3_key = event["s3_key"]
    category = event.get("category", "")
    sync_token = event["sync_token"]

    products = load_batch(s3_key)
    remaining, updated = db.run(find_and_update(products, sync_token))

    print(f"[FindByPath] category={category} updated={updated} remaining={len(remaining)}")
    return {"remaining": remaining, "sync_token": sync_token, "category": category}


async def find_and_update(products: list[dict], sync_token: str) -> tuple[list, int]:
    database = db.get_db()
    await db.load_info_cache(database)

    tasks = [process_product(database, p, sync_token) for p in products]
    results = await asyncio.gather(*tasks)

    updated = sum(1 for changed, _ in results if changed)
    remaining = [p for _, p in results if p is not None]
    return remaining, updated


async def process_product(database, product: dict, sync_token: str) -> tuple[bool, dict | None]:
    """Returns (price_changed, product_if_not_found)."""
    url = product.get("url")
    try:
        existing = await database.products.find_one({"websites.path": url})
        if existing:
            changed = await db.update_price_if_changed(database, existing, product, sync_token)
            return changed, None
        return False, product
    except Exception as e:
        print(f"[FindByPath] Error processing {url}: {e}")
        return False, product
