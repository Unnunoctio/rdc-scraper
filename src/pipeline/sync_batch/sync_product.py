"""Fase 3 del SyncBatch — add_website | create_product (+imagen WebP a S3).

Para cada match {product, drink}: decide `add_website` (si ya existe la variante en `products`) o
`create_product` (alta nueva). En la creación reserva un SKU único ANTES de subir la imagen para no
dejar huérfanos en S3 si el insert fallara por colisión.

Gate de allowlist (§6.1): productos cuyo `source` no está sembrado en `infos` se enrutan a los
fallidos (`unknown_source`) sin tocar la DB. El caller (`handler._process_batch`) provee `database`
(cache de `infos` ya cargado) y la `aiohttp.ClientSession` compartida.
"""

import asyncio

import rdc_database as db
from image_uploader import upload_image
from rdc_utils.mappings import CATEGORY_MAP, PACKAGING_MAP_ES


async def sync_all(database, session, matched: list[dict], sync_token: str) -> tuple[int, int, list]:
    if not matched:
        return 0, 0, []

    results = await asyncio.gather(
        *[_sync_one(database, session, item["product"], item["drink"], sync_token) for item in matched]
    )

    added = sum(1 for status, _ in results if status == "added")
    created = sum(1 for status, _ in results if status == "created")
    failed = [p for status, p in results if p is not None]
    return added, created, failed


async def _sync_one(database, session, product: dict, drink: dict, sync_token: str) -> tuple:
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
