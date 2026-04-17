import asyncio
from typing import Optional

import aiohttp
import drinks_client


def handler(event, context):
    """
    Input:
        event["remaining"]:   list[ScrapedProduct] — products not found by FindByPath
        event["sync_token"]:  str
        event["category"]:    str

    Returns:
        {
            "matched":    [{"product": ..., "drink": ...}],
            "unmatched":  [...ScrapedProduct],
            "sync_token": str,
            "category":   str,
        }
    """
    remaining = event.get("remaining", [])
    sync_token = event["sync_token"]
    category = event.get("category", "")

    matched, unmatched = asyncio.run(_search_all(remaining))
    print(f"[SearchDrinks] category={category} matched={len(matched)} unmatched={len(unmatched)}")
    return {"matched": matched, "unmatched": unmatched, "sync_token": sync_token, "category": category}


REQUIRED_FIELDS = ("name", "brand", "volume_ml", "abv", "packaging")


async def _search_all(products: list[dict]) -> tuple[list, list]:
    searchable, unmatched = [], []
    for p in products:
        if all(p.get(f) is not None for f in REQUIRED_FIELDS):
            searchable.append(p)
        else:
            missing = [f for f in REQUIRED_FIELDS if p.get(f) is None]
            print(f"[SearchDrinks] Skipping '{p.get('name')}' — missing: {missing}")
            unmatched.append(p)

    async with aiohttp.ClientSession() as session:
        results = await asyncio.gather(*[_search_one(session, p) for p in searchable])

    matched = [r for r in results if r is not None]
    unmatched += [p for p, r in zip(searchable, results) if r is None]
    return matched, unmatched


async def _search_one(session: aiohttp.ClientSession, product: dict) -> Optional[dict]:
    """Returns {"product": ..., "drink": ...} if a match is found, else None."""
    try:
        drinks = await drinks_client.search(session, product)
        drink = _best_match(product.get("name", ""), drinks)
        if drink:
            return {"product": product, "drink": drink}
    except Exception as e:
        print(f"[SearchDrinks] Error for '{product.get('name')}': {e}")
    return None


def _best_match(product_name: str, drinks: list[dict]) -> Optional[dict]:
    """
    Keep drinks where every word in the drink name appears in the product name
    (case-insensitive, order-independent). Among those, pick the one with the
    most words — most specific match wins.
    """
    product_words = set(product_name.lower().split())
    candidates = [
        d for d in drinks
        if set(d.get("name", "").lower().split()).issubset(product_words)
    ]
    return max(candidates, key=lambda d: len(d.get("name", "").split()), default=None)
