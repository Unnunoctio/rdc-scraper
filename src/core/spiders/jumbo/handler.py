import asyncio
import json
import os

import boto3
from spider import JumboSpider

_s3 = boto3.client("s3")


def handler(event, context):
    config: dict = event.get("config", {})
    execution_id: str = event.get("execution_id", "local")

    spider = JumboSpider(config)
    products = asyncio.run(spider.run())

    bucket = os.environ["S3_PIPELINE_BUCKET"]
    s3_key = f"pipeline/runs/jumbo/{execution_id}.json"
    _s3.put_object(
        Bucket=bucket,
        Key=s3_key,
        Body=json.dumps(products),
        ContentType="application/json",
    )

    print(f"[JumboHandler] {len(products)} products → s3://{bucket}/{s3_key}")
    return {"s3_key": s3_key, "count": len(products)}
