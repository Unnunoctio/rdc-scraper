import asyncio
import math
import traceback
from itertools import chain

import aiohttp

from classes.new_product import NewProduct
from classes.update_product import UpdateProduct
from spiders.spider_interface import SpiderInterface
from spiders.spider_types import (
    CencosudAverage,
    CencosudProduct,
    CencosudResponse,
    SpiderName,
)
from utils.user_agent import get_random_user_agent


class JumboSpider(SpiderInterface):
    INFO = {
        "name": SpiderName.JUMBO.value,
        "logo": "https://assets.jumbo.cl/favicon/favicon-192.png",
    }

    HEADERS = {
        "apiKey": "WlVnnB7c1BblmgUPOfg",
        "x-consumer": "jumbo",
        "x-e-commerce": "jumbo"
    }

    START_URLS = [
        "https://sm-web-api.ecomm.cencosud.com/catalog/api/v4/products/vinos-cervezas-y-licores/cervezas",
        "https://sm-web-api.ecomm.cencosud.com/catalog/api/v4/products/vinos-cervezas-y-licores/destilados",
        "https://sm-web-api.ecomm.cencosud.com/catalog/api/v4/products/vinos-cervezas-y-licores/vinos"
    ]

    BASE_PAGE_URL = "https://www.jumbo.cl"
    BASE_PRODUCT_URL = "https://sm-web-api.ecomm.cencosud.com/catalog/api/v1/product"
    BASE_AVERAGE_URL = "https://sm-web-api.ecomm.cencosud.com/catalog/api/v1/reviews/ratings"
    AVERAGE_BATCH_SIZE = 300

    # TODO: RUN SPIDER
    async def run(self, paths: list[str]) -> list[list[UpdateProduct], list[NewProduct], list[NewProduct]]:
        page_urls = await self.get_all_page_urls()

        products = await self.process_page_urls(page_urls=page_urls)

        update_products: list[UpdateProduct] = []
        url_products: list[str] = []

        for product in products:
            if product is None or "linkText" not in product:
                continue
            if product["items"][0]["sellers"][0]["commertialOffer"]["AvailableQuantity"] == 0:
                continue

            path = f"{self.BASE_PAGE_URL}/{product['linkText']}/p"
            if path in paths:
                update_product = UpdateProduct()
                update_product.set_cencosud_data(product, self.BASE_PAGE_URL)

                if update_product.is_complete():
                    update_products.append(update_product)
                continue

            url_products.append(f"{self.BASE_PRODUCT_URL}/{product['linkText']}")
            
        [new_products, incomplete_products] = await self.process_product_urls(product_urls=url_products)
            
        await self.get_averages(items=update_products)
        await self.get_averages(items=new_products)

        return [update_products, new_products, incomplete_products]


    # TODO: FETCHING DATA
    async def fetch_url(self, url: str) -> dict | None:
        customHeaders = self.HEADERS
        customHeaders["User-Agent"] = get_random_user_agent()

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=customHeaders) as response:
                    return await response.json()
        except Exception as e:
            print("Error fetching URL:", url, " - ", e)
            traceback.print_exc()
            return None
        
    
    # TODO: GETTING PAGES TO SCRAPE
    async def get_page_urls_by_start_url(self, url: str) -> list[str]:
        data: CencosudResponse | None = await self.fetch_url(url)
        if data is None:
            return []
        
        last_page = math.ceil(data["recordsFiltered"] / 40)
        return [f"{url}?sc=11&page={i+1}" for i in range(last_page)]
    
    async def get_all_page_urls(self) -> list[str]:
        tasks = [self.get_page_urls_by_start_url(url) for url in self.START_URLS]
        results = await asyncio.gather(*tasks)
        return list(chain.from_iterable(results))
    
    
    # TODO: GETTING PRODUCTS BY PAGE URL
    async def get_products_by_page_url(self, url: str) -> list[CencosudProduct]:
        data: CencosudResponse | None = await self.fetch_url(url)
        if data is None:
            return []
        
        return data["products"]
    
    async def process_page_urls(self, page_urls: list[str]) -> list[CencosudProduct]:
        tasks = [self.get_products_by_page_url(url) for url in page_urls]
        results = await asyncio.gather(*tasks)
        return list(chain.from_iterable(results))

    
    # TODO: GETTING PRODUCTS BY PRODUCT URL
    async def get_product_by_product_url(self, url: str) -> CencosudProduct | None:
        try:
            data: list[CencosudProduct] | None = await self.fetch_url(url)
            if data is None:
                return None

            return data[0]
        except Exception as e:
            print("Error fetching product URL: ", url, " - ", e)
            return None

    async def process_product_urls(self, product_urls: list[str]) -> list[list[NewProduct], list[NewProduct]]:
        products: list[NewProduct] = []

        tasks = [self.get_product_by_product_url(url) for url in product_urls]
        results = await asyncio.gather(*tasks)
        for result in filter(None, results):
            product = NewProduct(self.INFO["name"])
            product.set_cencosud_data(result, self.BASE_PAGE_URL)
            products.append(product)

        new_products = [product for product in products if product.is_complete()]
        incomplete_products = [product for product in products if not product.is_complete()]
        return [new_products, incomplete_products]

    
    # TODO: GETTING AVERAGES
    async def get_averages(self, items: list[UpdateProduct] | list[NewProduct]) -> None:
        averages_dict: dict[str, CencosudAverage] = {}
        for i in range(0, len(items), self.AVERAGE_BATCH_SIZE):
            batch = items[i:i+self.AVERAGE_BATCH_SIZE]
            skus = ",".join([item.sku for item in batch])
            data: list[CencosudAverage] = await self.fetch_url(f"{self.BASE_AVERAGE_URL}?ids={skus}")
            for item in data:
                averages_dict[item["id"]] = item

        for item in items:
            if item.sku in averages_dict:
                item.average = averages_dict[item.sku]["average"] if averages_dict[item.sku]["totalCount"] > 0 else 0
            