"""Cliente de la RDC Drinks API para SearchDrinks.

Mapas locales (ES → slug/inglés que exige la API), distintos de los de la layer `utils`:
- CATEGORY_MAP: categoría del scraper → endpoint de la API.
- PACKAGING_MAP: packaging ES → valor inglés del parámetro `packaging`.
"""

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
    Consulta la Drinks API por categoría, brand, abv, packaging y volumen.
    Devuelve todos los drinks que matchean — el filtrado por nombre y la selección los hace el caller.
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
