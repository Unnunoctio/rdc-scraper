"""Fase 1 del SyncBatch — match por websites.path y update de precio.

Gate de allowlist (§6.1): si el `source` no está sembrado en `infos`, el producto se descarta y
loguea (`unknown_source`) — no se escribe nada ni se propaga a las fases siguientes. Los que ya
existen por path actualizan precio/inStock (idempotente por día); el resto se devuelve en `remaining`
para que SearchDrinks intente matchearlos.

El caller (`handler._process_batch`) provee `database` y ya cargó el cache de `infos`: aquí no se
abre conexión ni se recarga el cache.
"""

import asyncio

import rdc_database as db


async def find_and_update(database, products: list[dict], sync_token: str) -> tuple[list, int, int]:
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
