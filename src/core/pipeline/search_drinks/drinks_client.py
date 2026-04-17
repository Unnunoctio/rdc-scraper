import os

import aiohttp

DRINKS_API_URL = os.environ["DRINKS_API_URL"].rstrip("/")
DRINKS_API_KEY = os.environ.get("DRINKS_API_KEY", "")

CATEGORY_MAP = {
    "Cervezas": "beers",
    "Destilados": "spirits",
    "Vinos": "wines",
}

PACKAGING_MAP = {
    "Botella":   "Bottle",
    "Lata":      "Can",
    "Barril":    "Barrel",
    "Tetrapack": "Box/Tetrapack",
    "Caja":      "Box/Tetrapack",
    "Growler":   "Growler",
}


async def search(session: aiohttp.ClientSession, product: dict) -> list[dict]:
    """
    Query the drinks API by category, brand, abv, packaging and volume.
    Returns all matching drinks — caller is responsible for name filtering and selection.
    """
    category = CATEGORY_MAP.get(product.get("category", ""))
    if not category:
        print(f"[DrinksClient] Unknown category '{product.get('category')}' for '{product.get('name')}'")
        return []

    params = {
        "brand":     product["brand"],
        "minAbv":    product["abv"],
        "maxAbv":    product["abv"],
        "packaging": PACKAGING_MAP.get(product["packaging"], product["packaging"]),
        "minVolume": product["volume_ml"],
        "maxVolume": product["volume_ml"],
        "limit":     1000,
    }

    headers = {"X-Internal-Key": DRINKS_API_KEY} if DRINKS_API_KEY else {}

    async with session.get(f"{DRINKS_API_URL}/{category}", params=params, headers=headers) as resp:
        if resp.status == 200:
            return (await resp.json()).get("data", [])
        print(f"[DrinksClient] HTTP {resp.status} for '{product.get('name')}'")
        return []
