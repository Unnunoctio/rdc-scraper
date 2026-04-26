import math
import re
import unicodedata
from typing import Any, Optional

from aiohttp import ClientSession
from base_spider import BaseSpider
from fetchers import JsonFetcher
from standard_format import create_product


class JumboSpider(BaseSpider):
    """
    Config keys (from DynamoDB):
        source               (str)        - spider identifier, e.g. "jumbo"
        product_list_url     (str)        - PLP endpoint (POST)
        product_details_url  (str)        - PDP endpoint (POST)
        product_url          (dict)       - {"prefix": str, "postfix": str}
        page_size            (int)        - products per page (default 50)
        store                (str)        - store name for API bodies (default "jumbo")
        category_urls        (list[str])  - selectedFacets category path values
        headers              (dict)       - HTTP headers (Apikey, Content-Type, etc.)
    """

    def _setup_fetchers(self):
        self.fetchers["json"] = JsonFetcher()

    @property
    def _source(self) -> str:
        return self.config.get("source", "jumbo")

    @property
    def _product_list_url(self) -> str:
        return self.config.get("product_list_url", "")

    @property
    def _product_details_url(self) -> str:
        return self.config.get("product_details_url", "")

    @property
    def _product_url(self) -> dict:
        return self.config.get("product_url", {"prefix": "https://www.jumbo.cl/", "postfix": "/p"})

    @property
    def _page_size(self) -> int:
        return int(self.config.get("page_size", 50))

    @property
    def _store(self) -> str:
        return self.config.get("store", "jumbo")

    def _build_product_url(self, slug: str) -> str:
        prefix = self._product_url.get("prefix", "https://www.jumbo.cl/")
        postfix = self._product_url.get("postfix", "/p")
        return f"{prefix}{slug}{postfix}"

    def _build_plp_body(self, category_url: str, from_offset: int, to_offset: int) -> dict:
        return {
            "brands": [],
            "collections": [],
            "fullText": "",
            "hideUnavailableItems": True,
            "promotionalCards": True,
            "sponsoredProducts": True,
            "orderBy": "OrderByBestDiscountDESC",
            "selectedFacets": [{"key": "category2", "value": category_url}],
            "from": from_offset,
            "to": to_offset,
            "store": self._store,
        }

    def _build_pdp_body(self, slug: str) -> dict:
        return {"store": self._store, "slug": slug}

    # Override run to inject detail-fetch step
    async def run(self) -> list[dict]:
        async with ClientSession() as session:
            self.session = session
            all_pages = await self._get_all_pages()
            lightweight = await self._fetch_all_products(all_pages)
            detailed = await self._fetch_all_details(lightweight)
            unique = self._deduplicate(detailed)
            print(f"[JumboSpider] {len(unique)} unique products scraped")
            return unique

    # ============= STEP 1: pagination =============

    async def _get_pages_for_category(self, category_url: str) -> list[str]:
        body = self._build_plp_body(category_url, 0, self._page_size - 1)
        data = await self.fetch("json", self._product_list_url, headers=self.headers, method="POST", body=body)
        if not data:
            return []

        total: int = data.get("results", 0)
        num_pages = math.ceil(total / self._page_size)

        # Encode offset ranges as "from:to" strings (reusing the pages list mechanism)
        return [f"{i * self._page_size}:{(i + 1) * self._page_size - 1}" for i in range(num_pages)]

    # ============= STEP 2: slugs per page =============

    async def _get_products_from_page(self, page: str, category_url: str) -> list[dict]:
        from_offset, to_offset = (int(x) for x in page.split(":"))
        body = self._build_plp_body(category_url, from_offset, to_offset)
        data = await self.fetch("json", self._product_list_url, headers=self.headers, method="POST", body=body)
        if not data:
            return []

        result = []
        for product in data.get("products", []):
            slug = product.get("slug")
            if slug:
                result.append({"slug": slug})
        return result

    # ============= STEP 3: full product detail =============

    async def _fetch_all_details(self, lightweight: list[dict]) -> list[dict]:
        tasks = [self._fetch_detail(item) for item in lightweight]
        results = await self._gather(tasks)
        return [r for r in results if r is not None]

    async def _fetch_detail(self, item: dict) -> Optional[dict]:
        body = self._build_pdp_body(item["slug"])
        data = await self.fetch("json", self._product_details_url, headers=self.headers, method="POST", body=body)
        if not data:
            return None
        return self._format_product(data, slug=item["slug"])

    # ============= STEP 4: format =============

    def _format_product(self, raw: Any, slug: str = "", **kwargs) -> Optional[dict]:
        try:
            item = raw["items"][0]
            name: str = item.get("name", "")
            brand: str = raw.get("brand", "")
            sku: str = raw.get("reference", "")

            best_price = int(item.get("price", 0))
            price = int(item.get("listPrice", 0))

            images = item.get("images", [])
            image_url = re.sub(r"(/ids/\d+)-\d+-\d+/", r"\1/", images[0]) if images else None

            category_names = raw.get("categoryNames", [])
            category = category_names[1] if len(category_names) > 1 else (category_names[0] if category_names else None)

            slug = slug or raw.get("slug", "")

        except Exception as e:
            print(f"[JumboSpider] _format_product main data error: {e}")
            return None

        specs = raw.get("specifications", [])

        abv = _extract_abv(specs, name)
        volume_ml = _extract_volume(name)
        quantity = _extract_quantity(specs, name)
        packaging = _extract_packaging(specs, name, category)

        return create_product(
            name=name,
            brand=brand,
            price=price,
            best_price=best_price,
            url=self._build_product_url(slug),
            image_url=image_url,
            source=self._source,
            sku=sku,
            category=category,
            abv=abv,
            volume_ml=volume_ml,
            quantity=quantity,
            packaging=packaging,
        )


# ============= EXTRACTION HELPERS =============


def _normalize(text: str) -> str:
    """Lowercase + remove accents for fuzzy key matching."""
    return "".join(c for c in unicodedata.normalize("NFD", text.lower()) if unicodedata.category(c) != "Mn")


def _spec_value(specs: list[dict], *keys: str) -> Optional[str]:
    """Return the first value from specifications whose key matches any of the given keys (accent-insensitive)."""
    normalized_keys = [_normalize(k) for k in keys]
    for spec in specs:
        if _normalize(spec.get("key", "")) in normalized_keys:
            values = spec.get("value", [])
            return values[0] if values else None
    return None


def _extract_abv(specs: list[dict], name: str) -> Optional[float]:
    # 1. Spec "Graduacion Alcoholica" — valor numérico preciso (e.g. "4.5°")
    raw = _spec_value(specs, "Graduacion Alcoholica")
    if raw:
        match = re.search(r"(\d+(?:\.\d+)?)", raw)
        if match:
            return float(match.group(1))

    # 2. Nombre del producto — buscar patrón "4.5°"
    match = re.search(r"(\d+(?:\.\d+)?)°", name)
    if match:
        return float(match.group(1))

    # 3. Spec "Grado" como último recurso — solo aceptar si el valor es un número
    #    seguido de ° o % (e.g. "4.5°"), descartando categorías como "Bajo (<5%ABV)"
    raw = _spec_value(specs, "Grado")
    if raw:
        match = re.search(r"(?<![<>])(\d+(?:\.\d+)?)[°%]", raw)
        if match:
            return float(match.group(1))

    return None


def _extract_volume(name: str) -> Optional[int]:
    match = re.search(r"(\d+(?:\.\d+)?)\s*(cc|ml|l)\b", name, re.IGNORECASE)
    if match:
        amount = float(match.group(1))
        unit = match.group(2).lower()
        return int(amount * 1000) if unit == "l" else int(amount)
    return None


def _extract_quantity(specs: list[dict], name: str) -> Optional[int]:
    if "Pack" in name:
        raw = _spec_value(specs, "Cantidad")
        if raw:
            match = re.search(r"(\d+)", raw)
            if match:
                return int(match.group(1))
        match = re.search(r"(\d+)\s*un\.", name, re.IGNORECASE)
        if match:
            return int(match.group(1))

    if "Bipack" in name:
        return 2

    return 1


def _extract_packaging(specs: list[dict], name: str, category: Optional[str]) -> Optional[str]:
    if category and _normalize(category) == "destilados":
        return "Botella"

    raw = _spec_value(specs, "Envase")
    if raw:
        envase = raw.lower()
        if "botella" in envase:
            return "Botella"
        if "lata" in envase:
            return "Lata"
        if "barril" in envase:
            return "Barril"
        if "tetrapack" in envase or "tetra" in envase:
            return "Tetrapack"
        if "caja" in envase:
            if category and _normalize(category) == "vinos":
                return "Tetrapack"

    name_lower = name.lower()
    if "botella" in name_lower:
        return "Botella"
    if "lata" in name_lower:
        return "Lata"
    if "barril" in name_lower:
        return "Barril"
    if "tetrapack" in name_lower or "caja" in name_lower:
        return "Tetrapack"

    return None
