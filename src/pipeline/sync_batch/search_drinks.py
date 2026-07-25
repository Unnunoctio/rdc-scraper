"""Fase 2 del SyncBatch — busca los `remaining` en la RDC Drinks API.

Para los productos sin match por path, consulta la Drinks API y elige el mejor drink por subconjunto
de palabras. Usa la `aiohttp.ClientSession` compartida que provee el caller (sin abrir una propia).
"""

import asyncio

import drinks_client

REQUIRED_FIELDS = ("name", "brand", "volume_ml", "abv", "packaging")


async def search_all(session, products: list[dict]) -> tuple[list, list]:
    searchable, unmatched = [], []
    for p in products:
        if all(p.get(f) is not None for f in REQUIRED_FIELDS):
            searchable.append(p)
        else:
            missing = [f for f in REQUIRED_FIELDS if p.get(f) is None]
            print(f"[SearchDrinks] Skipping '{p.get('name')}' — missing: {missing}")
            unmatched.append(p)

    results = await asyncio.gather(*[_search_one(session, p) for p in searchable])

    matched = [r for r in results if r is not None]
    unmatched += [p for p, r in zip(searchable, results, strict=True) if r is None]
    return matched, unmatched


async def _search_one(session, product: dict) -> dict | None:
    """Returns {"product": ..., "drink": ...} si hay match, else None."""
    try:
        drinks = await drinks_client.search(session, product)
        drink = _best_match(product.get("name", ""), drinks)
        if drink:
            return {"product": product, "drink": drink}
    except Exception as e:
        print(f"[SearchDrinks] Error for '{product.get('name')}': {e}")
    return None


def _best_match(product_name: str, drinks: list[dict]) -> dict | None:
    """
    Conserva los drinks cuyo nombre (todas sus palabras) está contenido en el nombre del producto
    (case-insensitive, sin importar el orden). Entre esos, elige el de más palabras — el match más
    específico gana.
    """
    product_words = set(product_name.lower().split())
    candidates = [
        d for d in drinks
        if set(d.get("name", "").lower().split()).issubset(product_words)
    ]
    return max(candidates, key=lambda d: len(d.get("name", "").split()), default=None)
