import os

import boto3
from boto3.dynamodb.conditions import Attr

dynamodb = boto3.resource("dynamodb")
config_table = dynamodb.Table(os.environ["CONFIG_TABLE"])


def handler(event, context):
    """
    Load enabled spider configurations from DynamoDB.

    Returns:
        { "spiders": [ { "lambda_name": str, "config": dict }, ... ] }
    """
    try:
        response = config_table.scan(FilterExpression=Attr("enabled").eq(True))
        items = response.get("Items", [])

        spiders = [
            {
                "lambda_name": item["lambda_name"],
                "config": item.get("config", {}),
            }
            for item in items
        ]

        print(f"[LoadConfigs] {len(spiders)} enabled spider(s) loaded")
        return {"spiders": spiders}

    except Exception as e:
        print(f"[LoadConfigs] Error: {e}")
        return {"spiders": [], "error": str(e)}
