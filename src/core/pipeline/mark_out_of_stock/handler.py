import asyncio

import db

loop = asyncio.new_event_loop()


def handler(event, context):
    sync_token = event["sync_token"]
    count = loop.run_until_complete(db.mark_out_of_stock(db.get_db(), sync_token))
    print(f"[MarkOutOfStock] marked={count}")
    return {"marked_out_of_stock": count}
