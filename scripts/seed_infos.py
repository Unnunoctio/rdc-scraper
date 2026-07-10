"""Siembra la metadata de tiendas (`infos`) en MongoDB — el allowlist de `source` válidos.

`infos` es la única fuente de verdad de qué `source` puede escribir en Mongo (PLAN.md §6.1):
una tienda no sembrada aquí no existe para el pipeline, aunque su spider corra y scrapee.

Upsert idempotente por `code`: reejecutarlo no duplica ni pisa el `_id` de una tienda existente
(solo actualiza `name`/`logo`/`url`). NO crea colecciones ni índices (eso es scripts/init_db.py).

Uso:
    uv run scripts/seed_infos.py --uri "$MONGODB_URI" --db "$MONGODB_DB" --file seed/infos.json
"""

import argparse
import asyncio
import json
import os
from pathlib import Path

from pymongo import AsyncMongoClient

REQUIRED_FIELDS = ("code", "name", "logo", "url")


async def seed_infos(uri: str, db_name: str, file: Path) -> None:
    stores = json.loads(file.read_text())
    if not isinstance(stores, list):
        raise ValueError(f"{file}: se esperaba una lista de tiendas")

    client: AsyncMongoClient = AsyncMongoClient(uri)
    try:
        db = client[db_name]
        inserted = updated = 0
        for store in stores:
            missing = [f for f in REQUIRED_FIELDS if not store.get(f)]
            if missing:
                raise ValueError(f"tienda {store.get('code', '?')}: faltan campos {missing}")

            result = await db.infos.update_one(
                {"code": store["code"]},
                {"$set": {k: store[k] for k in REQUIRED_FIELDS}},
                upsert=True,
            )
            if result.upserted_id is not None:
                inserted += 1
                print(f"[seed] insertada: {store['code']}")
            else:
                updated += 1
                print(f"[seed] actualizada: {store['code']}")

        print(f"[seed] listo. insertadas={inserted} actualizadas={updated} total={len(stores)}")
    finally:
        await client.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Siembra tiendas (`infos`) en MongoDB.")
    parser.add_argument("--uri", default=os.environ.get("MONGODB_URI"), help="MongoDB URI (o env MONGODB_URI)")
    parser.add_argument("--db", default=os.environ.get("MONGODB_DB"), help="Base de datos (o env MONGODB_DB)")
    parser.add_argument("--file", default="seed/infos.json", help="JSON con la lista de tiendas")
    args = parser.parse_args()

    if not args.uri or not args.db:
        parser.error("faltan --uri/--db (o las env MONGODB_URI/MONGODB_DB)")

    asyncio.run(seed_infos(args.uri, args.db, Path(args.file)))


if __name__ == "__main__":
    main()
