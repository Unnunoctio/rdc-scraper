"""Colección `priceLogs`: un registro de precio por (producto, website, día).

Función unificada (en el prototipo estaba duplicada en find_by_path/db.py y sync_product/db.py).
"""

from datetime import UTC, datetime


async def upsert_today_price_log(db, product_id, website_path: str, price: int, best_price: int) -> None:
    today = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)

    existing = await db.priceLogs.find_one(
        {"productId": product_id, "websitePath": website_path, "date": today}
    )
    if existing:
        await db.priceLogs.update_one(
            {"_id": existing["_id"]},
            {"$set": {"price": price, "bestPrice": best_price}},
        )
    else:
        await db.priceLogs.insert_one(
            {
                "productId": product_id,
                "websitePath": website_path,
                "price": price,
                "bestPrice": best_price,
                "date": today,
            }
        )
