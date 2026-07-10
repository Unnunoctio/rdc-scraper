"""FindByPath — primera etapa del SyncPipeline (Map, un batch por invocación).

Carga un batch de S3 (y lo borra tras leerlo), y por cada producto:
- Gate de allowlist (§6.1): si el `source` no está sembrado en `infos`, se descarta y loguea
  (`unknown_source`) — no se escribe nada ni se propaga a las etapas siguientes.
- Si ya existe un producto con esa `websites.path`, actualiza precio/inStock (idempotente por día).
- Si no existe, lo devuelve en `remaining` para que SearchDrinks intente matchearlo.
"""

import asyncio
import json
import os

import boto3
import rdc_database as db

_s3 = boto3.client("s3")
_bucket = os.environ["S3_PIPELINE_BUCKET"]


def load_batch(s3_key: str) -> list[dict]:
    obj = _s3.get_object(Bucket=_bucket, Key=s3_key)
    products = json.loads(obj["Body"].read())
    _s3.delete_object(Bucket=_bucket, Key=s3_key)
    return products


def handler(event, context):
    """
    Input:
        event["s3_key"]:     str — S3 key del batch escrito por MergeResults
        event["category"]:   str
        event["sync_token"]: str — StartTime de la ejecución, marca de "visto en esta corrida"

    Returns:
        {"remaining": [...ScrapedProduct], "sync_token": str, "category": str}
    """
    s3_key = event["s3_key"]
    category = event.get("category", "")
    sync_token = event["sync_token"]

    products = load_batch(s3_key)
    remaining, updated, skipped = db.run(find_and_update(products, sync_token))

    print(
        f"[FindByPath] category={category} updated={updated} "
        f"remaining={len(remaining)} skipped_unknown_source={skipped}"
    )
    return {"remaining": remaining, "sync_token": sync_token, "category": category}


async def find_and_update(products: list[dict], sync_token: str) -> tuple[list, int, int]:
    database = db.get_db()
    await db.load_info_cache(database)

    # Gate de allowlist: descartar productos cuyo `source` no está sembrado en `infos`.
    allowed, skipped = [], 0
    for p in products:
        if db.get_info_id(p.get("source", "")) is not None:
            allowed.append(p)
        else:
            skipped += 1
            print(f"[FindByPath] unknown_source '{p.get('source')}' — descartado: {p.get('url')}")

    results = await asyncio.gather(*[process_product(database, p, sync_token) for p in allowed])

    updated = sum(1 for changed, _ in results if changed)
    remaining = [p for _, p in results if p is not None]
    return remaining, updated, skipped


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
