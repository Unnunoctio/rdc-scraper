"""Layer `database`: acceso a MongoDB (pymongo async) para las Lambdas del pipeline.

Consolidado por colección: `client` (conexión), `infos` (allowlist), `products`, `price_logs`.
Reexporta la superficie pública para que las Lambdas hagan un import plano desde `rdc_database`.
Depende de la layer `utils` (products usa `rdc_utils.naming`/`rdc_utils.mappings`).
"""

from rdc_database.client import get_db, run
from rdc_database.infos import get_info_id, load_info_cache
from rdc_database.price_logs import upsert_today_price_log
from rdc_database.products import (
    add_website,
    create_product,
    mark_out_of_stock,
    unique_sku,
    update_price_if_changed,
)

__all__ = [
    "run",
    "get_db",
    "load_info_cache",
    "get_info_id",
    "update_price_if_changed",
    "unique_sku",
    "add_website",
    "create_product",
    "mark_out_of_stock",
    "upsert_today_price_log",
]
