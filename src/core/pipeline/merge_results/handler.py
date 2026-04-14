import json
import os
from collections import defaultdict

import boto3

BATCH_SIZE = 250
_s3 = boto3.client("s3")


def handler(event, context):
    """
    Input:
        event["s3_keys"]:      list of {"s3_key": str, "count": int}
        event["execution_id"]: str

    Returns:
        list of {"s3_key": str, "category": str, "count": int}
    """
    try:
        bucket = os.environ["S3_PIPELINE_BUCKET"]
        s3_refs = event.get("s3_keys", [])
        execution_id = event.get("execution_id", "local")

        all_products: list[dict] = []
        for ref in s3_refs:
            obj = _s3.get_object(Bucket=bucket, Key=ref["s3_key"])
            all_products.extend(json.loads(obj["Body"].read()))
            _s3.delete_object(Bucket=bucket, Key=ref["s3_key"])

        seen_urls: set[str] = set()
        unique: list[dict] = []
        for p in all_products:
            url = p.get("url")
            if url and url not in seen_urls:
                seen_urls.add(url)
                unique.append(p)

        by_category: dict[str, list[dict]] = defaultdict(list)
        for p in unique:
            by_category[p.get("category", "")].append(p)

        batch_refs = []
        index = 0
        for category, products in by_category.items():
            for i in range(0, len(products), BATCH_SIZE):
                batch = products[i : i + BATCH_SIZE]
                s3_key = f"pipeline/batches/{execution_id}/{index}.json"
                _s3.put_object(
                    Bucket=bucket,
                    Key=s3_key,
                    Body=json.dumps(batch),
                    ContentType="application/json",
                )
                batch_refs.append({"s3_key": s3_key, "category": category, "count": len(batch)})
                index += 1

        print(f"[MergeResults] {len(all_products)} total → {len(unique)} unique → {len(batch_refs)} batches ({len(by_category)} categories)")
        return batch_refs

    except Exception as e:
        print(f"[MergeResults] Error: {e}")
        raise
