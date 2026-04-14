import os

import boto3
import db
from boto3.dynamodb.conditions import Attr

_table = boto3.resource("dynamodb").Table(os.environ["CONFIG_TABLE"])


def handler(event, context):
    try:
        items = _table.scan(FilterExpression=Attr("enabled").eq(True)).get("Items", [])

        for item in items:
            info = item.get("info", {})
            if info.get("code"):
                db.insert_info_if_not_exists(info)

        spiders = [
            {
                "lambda_name": item["lambda_name"],
                "config": item.get("config", {}),
            }
            for item in items
        ]

        print(f"[LoadConfigs] {len(spiders)} spider(s) loaded")
        return {"spiders": spiders}

    except Exception as e:
        print(f"[LoadConfigs] Error: {e}")
        return {"spiders": [], "error": str(e)}
