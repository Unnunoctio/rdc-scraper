"""Crea las colecciones y los índices de MongoDB para RDC Scraper.

Fuente de verdad de los índices: PLAN.md §6.2 (mantener en sincronía).
Idempotente: reejecutarlo no duplica nada (create_index es no-op si el índice ya existe con
la misma especificación; las colecciones sólo se crean si faltan). NO siembra datos —el seed de
`infos` vive en scripts/seed_infos.py (Fase 4).

Uso:
    uv run scripts/init_db.py --uri "$MONGODB_URI" --db "$MONGODB_DB"
"""

import argparse
import asyncio
import os

from pymongo import ASCENDING, DESCENDING, AsyncMongoClient
from pymongo.errors import CollectionInvalid

# TTL del histórico de precios (priceLogs.date). PLAN §6.2: 6 meses = 180 días.
PRICE_LOG_TTL_SECONDS = 180 * 24 * 60 * 60  # 15_552_000

# Colección → lista de índices (kwargs de create_index). Ver PLAN.md §6.2.
INDEXES: dict[str, list[dict]] = {
    "infos": [
        {"keys": [("code", ASCENDING)], "name": "unique_code", "unique": True},
    ],
    "products": [
        {"keys": [("sku", ASCENDING)], "name": "unique_sku", "unique": True},
        {"keys": [("slug", ASCENDING)], "name": "unique_slug", "unique": True},
        {"keys": [("websites.path", ASCENDING)], "name": "unique_website_path", "unique": True},
        {
            "keys": [
                ("drink.id", ASCENDING),
                ("drink.volume", ASCENDING),
                ("drink.packaging", ASCENDING),
                ("quantity", ASCENDING),
            ],
            "name": "unique_drink_variant",
            "unique": True,
        },
        {"keys": [("category", ASCENDING)], "name": "category"},
        {"keys": [("websites.lastUpdate", ASCENDING)], "name": "websites_last_update"},
    ],
    "priceLogs": [
        {
            "keys": [("productId", ASCENDING), ("websitePath", ASCENDING), ("date", DESCENDING)],
            "name": "product_website_date",
            "unique": True,
        },
        {"keys": [("date", ASCENDING)], "name": "ttl_date", "expireAfterSeconds": PRICE_LOG_TTL_SECONDS},
    ],
}


async def init_db(uri: str, db_name: str) -> None:
    client: AsyncMongoClient = AsyncMongoClient(uri)
    try:
        db = client[db_name]
        existing = set(await db.list_collection_names())

        for collection, indexes in INDEXES.items():
            if collection not in existing:
                try:
                    await db.create_collection(collection)
                    print(f"[init-db] colección creada: {collection}")
                except CollectionInvalid:
                    pass  # creada en carrera; seguimos
            else:
                print(f"[init-db] colección ya existe: {collection}")

            for spec in indexes:
                name = await db[collection].create_index(**spec)
                print(f"[init-db]   índice: {collection}.{name}")

        print("[init-db] listo.")
    finally:
        await client.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Crea colecciones e índices de MongoDB.")
    parser.add_argument("--uri", default=os.environ.get("MONGODB_URI"), help="MongoDB URI (o env MONGODB_URI)")
    parser.add_argument("--db", default=os.environ.get("MONGODB_DB"), help="Base de datos (o env MONGODB_DB)")
    args = parser.parse_args()

    if not args.uri or not args.db:
        parser.error("faltan --uri/--db (o las env MONGODB_URI/MONGODB_DB)")

    asyncio.run(init_db(args.uri, args.db))


if __name__ == "__main__":
    main()
