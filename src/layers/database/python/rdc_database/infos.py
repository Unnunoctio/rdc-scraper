"""Colección `infos`: cache de tiendas sembradas. Actúa como allowlist de `source` válidos.

Si un `source` scrapeado no está en el cache (no fue sembrado), `get_info_id` devuelve None y el
llamador debe bloquear la escritura y enrutar el producto a `unmatched` (`unknown_source`).
"""


_info_cache: dict[str, object] = {}


async def load_info_cache(db) -> None:
    """Puebla el cache keyed por `code`. No-op en reuso de contenedor (ya poblado)."""
    if _info_cache:
        return
    async for doc in db.infos.find({}, {"_id": 1, "code": 1}):
        _info_cache[doc["code"]] = doc["_id"]
    print(f"[DB] Info cache loaded: {list(_info_cache.keys())}")


def get_info_id(source: str) -> object | None:
    return _info_cache.get(source)
