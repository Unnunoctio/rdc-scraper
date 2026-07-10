"""MarkOutOfStock — penúltima etapa del pipeline.

Tras el SyncPipeline, marca out-of-stock todo `website` que NO se tocó en esta corrida: los que
tienen `lastUpdate ≠ sync_token` (`sync_token` = StartTime de la ejecución) pasan a `inStock:false`
con precios en 0. Un solo `update_many` con `array_filters` (ver `rdc_database.mark_out_of_stock`).
"""

import rdc_database as db


def handler(event, context):
    """
    Input:
        event["sync_token"]: str — StartTime de la ejecución (marca de "visto en esta corrida")

    Returns:
        {"marked_out_of_stock": int}
    """
    sync_token = event["sync_token"]

    count = db.run(db.mark_out_of_stock(db.get_db(), sync_token))

    print(f"[MarkOutOfStock] marked={count}")
    return {"marked_out_of_stock": count}
