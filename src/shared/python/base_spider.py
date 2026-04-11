import asyncio
from abc import ABC, abstractmethod
from itertools import chain
from typing import Any, Dict, Optional

from aiohttp import ClientSession

from fetchers import IFetcher


class BaseSpider(ABC):
    """
    Defines the contract every spider must follow.
    Subclasses implement the site-specific scraping logic.

    Config (from DynamoDB) expected keys:
        category_urls (list[str])  - pages to scrape
        headers       (dict)       - HTTP headers (API keys, etc.)
        body          (dict|None)  - request body for POST-based APIs

    The full config dict is also available as self.config for
    spider-specific values (urls, page_size, extra_params, etc.).
    """

    def __init__(self, config: dict):
        self.config = config
        self.category_urls: list[str] = config.get("category_urls", [])
        self.headers: dict = config.get("headers", {})
        self.body: Optional[dict] = config.get("body")
        self.session: Optional[ClientSession] = None
        self.fetchers: Dict[str, IFetcher] = {}
        self._setup_fetchers()

    # ============= FETCHERS =============

    @abstractmethod
    def _setup_fetchers(self):
        """Register the fetchers this spider needs."""
        pass

    async def fetch(self, fetcher_name: str, url: str, **kwargs) -> Any:
        if fetcher_name not in self.fetchers:
            raise ValueError(f"Fetcher '{fetcher_name}' not found in {self.__class__.__name__}")
        if self.session is None:
            raise ValueError("Session not initialized — call via run()")
        return await self.fetchers[fetcher_name].fetch(self.session, url, **kwargs)

    # ============= LIFECYCLE =============

    async def run(self) -> list[dict]:
        async with ClientSession() as session:
            self.session = session
            all_pages = await self._get_all_pages()
            all_products = await self._fetch_all_products(all_pages)
            unique = self._deduplicate(all_products)
            print(f"[{self.__class__.__name__}] {len(unique)} unique products scraped")
            return unique

    async def _get_all_pages(self) -> list[tuple[str, list[str]]]:
        tasks = [self._get_pages_for_category(url) for url in self.category_urls]
        results = await self._gather(tasks)
        return list(zip(self.category_urls, results))

    async def _fetch_all_products(self, pages_data: list[tuple[str, list[str]]]) -> list[dict]:
        tasks = [
            self._get_products_from_page(page, cat_url)
            for cat_url, pages in pages_data
            for page in pages
        ]
        results = await self._gather(tasks)
        return list(chain.from_iterable(r for r in results if r))

    def _deduplicate(self, products: list[dict]) -> list[dict]:
        seen: set[str] = set()
        unique = []
        for p in products:
            url = p.get("url")
            if url and url not in seen:
                seen.add(url)
                unique.append(p)
        return unique

    async def _gather(self, tasks: list) -> list:
        try:
            return await asyncio.gather(*tasks, return_exceptions=False)
        except Exception as e:
            print(f"[{self.__class__.__name__}] gather error: {e}")
            return []

    # ============= ABSTRACT METHODS =============

    @abstractmethod
    async def _get_pages_for_category(self, category_url: str) -> list[str]:
        """Return all paginated URLs for a given category."""
        pass

    @abstractmethod
    async def _get_products_from_page(self, page: str, category_url: str) -> list[dict]:
        """Scrape and return products from a single page."""
        pass

    @abstractmethod
    def _format_product(self, raw_data: Any, **kwargs) -> Optional[dict]:
        """Transform raw API/HTML data into a ScrapedProduct dict."""
        pass
