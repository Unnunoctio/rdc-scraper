"""Colección `products`: match por path, alta de website/producto y marcado de out-of-stock."""


from rdc_utils.mappings import PACKAGING_MAP_ES, SPIRIT_TYPE_MAP_ES
from rdc_utils.naming import generate_product_name, generate_product_slug, generate_sku

from rdc_database.infos import get_info_id
from rdc_database.price_logs import upsert_today_price_log


async def update_price_if_changed(db, db_product: dict, scraped: dict, sync_token: str) -> bool:
    url = scraped["url"]
    website = next((w for w in db_product.get("websites", []) if w.get("path") == url), None)
    if not website:
        return False

    price = scraped["price"]
    best_price = scraped["best_price"]
    price_changed = website.get("price") != price or website.get("bestPrice") != best_price

    await upsert_today_price_log(db, db_product["_id"], url, price, best_price)

    update = {"websites.$.lastUpdate": sync_token, "websites.$.inStock": True}
    if price_changed:
        update["websites.$.price"] = price
        update["websites.$.bestPrice"] = best_price

    await db.products.update_one(
        {"_id": db_product["_id"], "websites.path": url},
        {"$set": update},
    )
    return price_changed


async def unique_sku(db) -> str:
    """Genera un SKU garantizado inexistente en la colección products."""
    while True:
        sku = generate_sku()
        if not await db.products.find_one({"sku": sku}, {"_id": 1}):
            return sku


async def add_website(db, product_id: object, scraped: dict, sync_token: str) -> None:
    info_id = get_info_id(scraped.get("source", ""))
    url = scraped["url"]

    await db.products.update_one(
        {"_id": product_id},
        {
            "$push": {
                "websites": {
                    "info": info_id,
                    "path": url,
                    "price": scraped["price"],
                    "bestPrice": scraped["best_price"],
                    "lastUpdate": sync_token,
                    "inStock": True,
                }
            }
        },
    )
    await upsert_today_price_log(db, product_id, url, scraped["price"], scraped["best_price"])


async def create_product(
    db, drink: dict, scraped: dict, image_url: str | None, sync_token: str, sku: str
) -> None:
    info_id = get_info_id(scraped.get("source", ""))
    url = scraped["url"]
    quantity = scraped.get("quantity", 1)
    category = scraped.get("category", "")

    name = generate_product_name(drink=drink, category=category, quantity=quantity)
    slug = generate_product_slug(sku=sku, name=name, volume_ml=drink["volume"])

    result = await db.products.insert_one(
        {
            "sku": sku,
            "name": name,
            "slug": slug,
            "quantity": quantity,
            "category": category,
            "drink": {
                **drink,
                "packaging": PACKAGING_MAP_ES.get(drink.get("packaging", ""), drink.get("packaging", "")),
                **({"type": SPIRIT_TYPE_MAP_ES.get(drink["type"], drink["type"])} if drink.get("type") else {}),
            },
            "images": [image_url] if image_url else [],
            "websites": [
                {
                    "info": info_id,
                    "path": url,
                    "price": scraped["price"],
                    "bestPrice": scraped["best_price"],
                    "lastUpdate": sync_token,
                    "inStock": True,
                }
            ],
        }
    )
    await upsert_today_price_log(db, result.inserted_id, url, scraped["price"], scraped["best_price"])


async def mark_out_of_stock(db, sync_token: str) -> int:
    result = await db.products.update_many(
        {"websites": {"$elemMatch": {
            "lastUpdate": {"$ne": sync_token},
            "inStock": True,
        }}},
        {"$set": {
            "websites.$[elem].inStock": False,
            "websites.$[elem].price": 0,
            "websites.$[elem].bestPrice": 0,
        }},
        array_filters=[{
            "elem.lastUpdate": {"$ne": sync_token},
            "elem.inStock": True,
        }],
    )
    return result.modified_count
