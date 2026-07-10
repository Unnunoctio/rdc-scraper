import json
import os
from collections import defaultdict

import boto3

BATCH_SIZE = 250

_s3 = boto3.client("s3")
_bucket = os.environ.get("S3_PIPELINE_BUCKET", "")


def load_spider_results(s3_refs: list[dict]) -> list[dict]:
    """Descarga cada run del Parallel y borra el objeto tras leerlo."""
    products = []
    for ref in s3_refs:
        key = ref["s3_key"]
        obj = _s3.get_object(Bucket=_bucket, Key=key)
        products.extend(json.loads(obj["Body"].read()))
        _s3.delete_object(Bucket=_bucket, Key=key)
    return products


def deduplicate(products: list[dict]) -> list[dict]:
    """Dedup por url; descarta productos sin url."""
    seen = set()
    unique = []
    for p in products:
        url = p.get("url")
        if url and url not in seen:
            seen.add(url)
            unique.append(p)
    return unique


def group_by_category(products: list[dict]) -> dict[str, list[dict]]:
    groups: dict[str, list[dict]] = defaultdict(list)
    for p in products:
        groups[p.get("category", "")].append(p)
    return groups


def write_batches(groups: dict[str, list[dict]], execution_id: str) -> list[dict]:
    batch_refs = []
    index = 0
    for category, products in groups.items():
        for i in range(0, len(products), BATCH_SIZE):
            batch = products[i : i + BATCH_SIZE]
            key = f"pipeline/batches/{execution_id}/{index}.json"
            _s3.put_object(
                Bucket=_bucket,
                Key=key,
                Body=json.dumps(batch),
                ContentType="application/json",
            )
            batch_refs.append({"s3_key": key, "category": category, "count": len(batch)})
            index += 1
    return batch_refs


def handler(event, context):
    """
    Input:
        event["s3_keys"]:      list of {"s3_key": str, "count": int}  (salida de ScrapeParallel)
        event["execution_id"]: str

    Returns:
        list of {"s3_key": str, "category": str, "count": int}
    """
    s3_refs = event.get("s3_keys", [])
    execution_id = event.get("execution_id", "local")

    all_products = load_spider_results(s3_refs)
    unique = deduplicate(all_products)
    groups = group_by_category(unique)
    batch_refs = write_batches(groups, execution_id)

    print(
        f"[MergeResults] {len(all_products)} total -> {len(unique)} unique -> "
        f"{len(batch_refs)} batches ({len(groups)} categories)"
    )
    return batch_refs
