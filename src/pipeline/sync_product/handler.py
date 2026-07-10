"""SyncProduct — tercera etapa del SyncPipeline.

Para cada match {product, drink}: decide `add_website` (si ya existe la variante en `products`) o
`create_product` (alta nueva). En la creación reserva un SKU único ANTES de subir la imagen para no
dejar huérfanos en S3 si el insert fallara por colisión.

Gate de allowlist (§6.1): productos cuyo `source` no está sembrado en `infos` se enrutan a
`unmatched` (`unknown_source`) sin tocar la DB. `unmatched` (el de SearchDrinks + estos) se propaga
para el reporte final (SendReport, Fase 5).
"""

import asyncio
import json
import os

import aiohttp
import boto3
import rdc_database as db
from image_uploader import upload_image
from rdc_utils.mappings import CATEGORY_MAP, PACKAGING_MAP_ES

_s3 = boto3.client("s3")
_bucket = os.environ["S3_PIPELINE_BUCKET"]


def handler(event, context):
    """
    Input:
        event["matched"]:      [{"product": ..., "drink": ...}]
        event["unmatched"]:    [...ScrapedProduct] — vienen de SearchDrinks
        event["sync_token"]:   str
        event["category"]:     str
        event["execution_id"]: str — namespacing de los archivos S3 de unmatched

    Returns:
        {"sync_token": str, "category": str, "unmatched_count": int, "unmatched_key": str | None}

    Los `unmatched` NO se devuelven inline (superarían el límite de 256 KB de I/O de Step Functions
    al agregar el resultado del Map): se escriben a S3 y se devuelve solo un puntero. La clave usa el
    `aws_request_id` (único por invocación) y no la categoría, porque hay varios batches por categoría
    corriendo en paralelo: con la categoría se pisarían entre sí. SendReport (Fase 5) los recolecta
    con un glob del prefijo pipeline/unmatched/<exec>/.
    """
    matched = event.get("matched", [])
    unmatched = list(event.get("unmatched", []))
    sync_token = event["sync_token"]
    category = event.get("category", "")
    execution_id = event.get("execution_id", "local")
    request_id = getattr(context, "aws_request_id", "local")

    if matched:
        added, created, failed = db.run(_sync_all(matched, sync_token))
        unmatched += failed
        print(
            f"[SyncProduct] category={category} added={added} created={created} errors={len(failed)}"
        )

    unmatched_key = None
    if unmatched:
        unmatched_key = f"pipeline/unmatched/{execution_id}/{request_id}.json"
        _s3.put_object(
            Bucket=_bucket,
            Key=unmatched_key,
            Body=json.dumps(unmatched),
            ContentType="application/json",
        )

    print(f"[SyncProduct] category={category} unmatched={len(unmatched)} key={unmatched_key}")
    return {
        "sync_token": sync_token,
        "category": category,
        "unmatched_count": len(unmatched),
        "unmatched_key": unmatched_key,
    }


async def _sync_all(matched: list[dict], sync_token: str) -> tuple[int, int, list]:
    database = db.get_db()
    await db.load_info_cache(database)

    async with aiohttp.ClientSession() as session:
        results = await asyncio.gather(
            *[_sync_one(database, session, item["product"], item["drink"], sync_token) for item in matched]
        )

    added = sum(1 for status, _ in results if status == "added")
    created = sum(1 for status, _ in results if status == "created")
    failed = [p for status, p in results if p is not None]
    return added, created, failed


async def _sync_one(database, session: aiohttp.ClientSession, product: dict, drink: dict, sync_token: str) -> tuple:
    # Gate de allowlist: no escribir para una tienda no sembrada.
    if db.get_info_id(product.get("source", "")) is None:
        print(f"[SyncProduct] unknown_source '{product.get('source')}' — a unmatched: {product.get('url')}")
        return "error", product
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

        # Reserva un SKU único antes de subir la imagen — evita huérfanos en S3 si el insert
        # fallara por colisión.
        sku = await db.unique_sku(database)
        category = CATEGORY_MAP.get(product.get("category", ""), "").lower()
        image_url = await upload_image(session, sku, category, product.get("image_url"))
        await db.create_product(database, drink, product, image_url, sync_token, sku)
        return "created", None
    except Exception as e:
        print(f"[SyncProduct] Error for '{product.get('url')}': {e}")
        return "error", product
