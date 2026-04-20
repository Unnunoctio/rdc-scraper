"""
MongoDB database initializer for RDC Scraper.

Creates all collections, indexes, and unique constraints.
Safe to run multiple times — PyMongo skips index creation if it already exists.

Usage:
    MONGODB_URI="mongodb+srv://..." python scripts/init_db.py

Collections
-----------
infos
    Stores metadata for each e-commerce source (website).
    Schema:
        {
            "_id":      ObjectId    (auto-generated),
            "code":     str         (source identifier, e.g. "jumbo"),
            "name":     str         (display name, e.g. "Jumbo"),
            "logo":     str         (URL of the e-commerce logo),
            "url":      str         (base URL of the store),
        }

products
    Main collection. Embeds drink data and all website listings.
    Schema:
        {
            "_id":      ObjectId    (auto-generated),
            "sku":      str         (8-char alphanumeric, unique),
            "slug":     str
            "name":     str
            "quantity": int         (units per pack, 1 if individual),
            "category": str         ("beers" | "spirits" | "wines"),
            "drink": {
                "id":               str,   (same id can appear at different volumes/packaging — see unique_drink_variant index)
                "name":             str,
                "brand":            str,
                "abv":              float,
                "packaging":        str,   ("bottle" | "can" | "keg" | "tetrapack")
                "volume":           int,   (ml)
                "country":          str,
                # Optional (present only when available):
                "style":            str,   (beers)
                "ibu":              int,   (beers)
                "servingTempMinC":  int,   (beers)
                "servingTempMaxC":  int,   (beers)
                "type":             str,   (spirits)
                "agingContainer":   str,   (spirits)
                "agingTimeMonths":  int,   (spirits)
                "region":           str,
            },
            "images": [str],  (S3 URLs)
            "websites": [{
                "info":        ObjectId,   (infos._id reference)
                "path":        str,   (full product URL — globally unique: no two products or stores share the same URL)
                "price":       int,   (price without discount, CLP)
                "bestPrice":   int,   (final price paid by customer, CLP)
                "lastUpdate":  str,   (Step Functions execution StartTime used as sync token)
                "inStock":     bool,
            }],
        }

priceLogs
    Daily price history. References product and website path (relational style).
    One document per (productId, websitePath, date) — upserted each scrape run.
    Schema:
        {
            "_id":          ObjectId  (auto-generated),
            "productId":    ObjectId  (products._id reference),
            "websitePath":  str       (website URL — matches products.websites[].path),
            "price":        int       (CLP, updated to latest value seen that day),
            "bestPrice":    int       (CLP, updated to latest value seen that day),
            "date":         datetime  (midnight UTC of the day),
        }
"""

import sys

from pymongo import ASCENDING, DESCENDING, MongoClient

##MONGODB_URI = "mongodb+srv://scraper-user:R6xiRpu9VVIRJc3o@rincon-del-curao-cluste.trpc8.mongodb.net/"
MONGODB_URI = "mongodb://scraper-user:R6xiRpu9VVIRJc3o@rincon-del-curao-cluste-shard-00-00.trpc8.mongodb.net:27017,rincon-del-curao-cluste-shard-00-01.trpc8.mongodb.net:27017,rincon-del-curao-cluste-shard-00-02.trpc8.mongodb.net:27017/?ssl=true&replicaSet=atlas-2eopo2-shard-0&authSource=admin&appName=Rincon-del-Curao-Cluster"
MONGODB_DB = "dev"

if not MONGODB_URI:
    print("Error: MONGODB_URI environment variable is not set.")
    sys.exit(1)
if not MONGODB_DB:
    print("Error: MONGODB_DB environment variable is not set.")
    sys.exit(1)

SIX_MONTHS_SECONDS = 15_552_000  # 180 days


def init(uri: str, db_name: str) -> None:
    client = MongoClient(uri)
    db = client[db_name]
    print(f"Connected to database: {db.name}")

    # ── infos ────────────────────────────────────────────────────────────────
    print("\n[infos]")
    db.infos.create_index("code", unique=True, name="unique_code")
    print("  ✓ unique_code")

    # ── products ─────────────────────────────────────────────────────────────
    print("\n[products]")

    # Drop legacy single-field index if it still exists (replaced by unique_drink_variant)
    try:
        db.products.drop_index("unique_drink_id")
        print("  ✓ dropped legacy unique_drink_id")
    except Exception:
        pass

    # A drink variant is uniquely identified by (drink.id, volume, packaging, quantity).
    # The same drink.id can appear at different volumes (750ml vs 1000ml) or packaging
    # (Bottle vs Can), each of which is a distinct physical product.
    db.products.create_index(
        [
            ("drink.id", ASCENDING),
            ("drink.volume", ASCENDING),
            ("drink.packaging", ASCENDING),
            ("quantity", ASCENDING),
        ],
        unique=True,
        name="unique_drink_variant",
    )
    print("  ✓ unique_drink_variant")

    # SKU is a public-facing unique identifier
    db.products.create_index("sku", unique=True, name="unique_sku")
    print("  ✓ unique_sku")

    # FindByPath Lambda looks up products by website URL — globally unique across all products
    db.products.create_index("websites.path", unique=True, name="unique_websites_path")
    print("  ✓ unique_websites_path")

    # Useful for category filtering from the API
    db.products.create_index("category", name="category")
    print("  ✓ category")

    # ── priceLogs ────────────────────────────────────────────────────────────
    print("\n[priceLogs]")

    # Primary lookup: find today's log for a given product+website
    db.priceLogs.create_index(
        [("productId", ASCENDING), ("websitePath", ASCENDING), ("date", DESCENDING)],
        unique=True,
        name="product_website_date",
    )
    print("  ✓ product_website_date (unique)")

    # TTL: automatically delete logs older than 6 months
    db.priceLogs.create_index(
        "date",
        expireAfterSeconds=SIX_MONTHS_SECONDS,
        name="ttl_date",
    )
    print(f"  ✓ ttl_date (expireAfterSeconds={SIX_MONTHS_SECONDS})")

    print("\nDatabase initialized successfully.")
    client.close()


if __name__ == "__main__":
    init(MONGODB_URI, MONGODB_DB)
