import asyncio

from spider import JumboSpider


def handler(event, context):
    config: dict = event.get("config", {})
    spider = JumboSpider(config)
    products = asyncio.run(spider.run())
    return products
