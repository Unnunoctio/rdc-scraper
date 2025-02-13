import asyncio
import time
import traceback
from datetime import datetime

from config import RESEND_SEND
from services.dynamo.slug_table_service import SlugTableService
from services.mongodb.drink_table_service import DrinkTableService
from services.mongodb.mongodb import MongoDB
from services.mongodb.product_table_service import ProductTableService
from services.mongodb.website_table_service import WebsiteTableService
from spiders.jumbo_spider import JumboSpider
from spiders.santa_spider import SantaSpider
from spiders.spider_interface import SpiderInterface
from spiders.spider_types import SpiderName
from utils.generate import generate_watcher
from utils.resend import send_email


async def run_spider(spider: SpiderInterface, name: SpiderName, paths: list[str], drinks: list[dict], watcher: str, product_service: ProductTableService, website_service: WebsiteTableService, drink_service: DrinkTableService) -> list:
    print(f"{name.value} -> start")
    start_time = time.time()

    [updates, news, incompletes] = await spider.run(paths=paths)
    await website_service.update_many_websites(updates=updates, watcher=watcher)
    not_found_products = await product_service.save_many_products(products=news, info=spider.INFO, drinks=drinks, watcher=watcher, drink_service=drink_service)

    end_time = time.time()
    print(f"Updated: {len(updates)} - Completed: {len(news)} - Incompleted: {len(incompletes)}")
    print(f"{name.value} -> time: {end_time - start_time} seconds.\n")

    return not_found_products + incompletes

async def main(mongodb_connection: MongoDB) -> None:
    product_service = ProductTableService(mongodb_connection=mongodb_connection)
    website_service = WebsiteTableService(mongodb_connection=mongodb_connection)
    drink_service = DrinkTableService(mongodb_connection=mongodb_connection)
    
    paths = website_service.get_all_paths()
    drinks = drink_service.get_drinks()
    watcher = generate_watcher()
    not_found_products = []

    print(f"Watcher: {watcher}\n")
    # TODO: JUMBO
    jumbo_not_found = await run_spider(spider=JumboSpider(), name=SpiderName.JUMBO, paths=paths, drinks=drinks, watcher=watcher, product_service=product_service, website_service=website_service, drink_service=drink_service)
    not_found_products.extend(jumbo_not_found)
    time.sleep(5)

    # TODO: SANTA
    santa_not_found = await run_spider(spider=SantaSpider(), name=SpiderName.SANTA, paths=paths, drinks=drinks, watcher=watcher, product_service=product_service, website_service=website_service, drink_service=drink_service)
    not_found_products.extend(santa_not_found)
    time.sleep(5)

    # TODO: LIDER

    # TODO: UPADTE DB
    website_service.update_websites_without_stock(watcher=watcher)
    
    # TODO: SAVE NEW SLUGS INTO DYNAMODB
    slug_products = product_service.get_all_slug_products()
    SlugTableService().save_slugs(slug_products=slug_products)

    # TODO: EMAIL 
    if RESEND_SEND == "SEND" and datetime.now().weekday() == 5:
        send_email(products=not_found_products)


try:
    process_start_time = time.time()
    print("Process started.")

    mongodb_connection = MongoDB()
    asyncio.run(main(mongodb_connection=mongodb_connection))
except Exception as e:
    print("Process failed with error:", e)
    traceback.print_exc()
finally:
    mongodb_connection.close_connection()

    process_end_time = time.time()
    print(f"Process finished in {process_end_time - process_start_time} seconds.")
    exit(0)