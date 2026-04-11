from itertools import chain

BATCH_SIZE = 500


def handler(event, context):
    """
    Flatten, deduplicate, and split products into batches for parallel sync.

    Input:
        event["products"]: list of lists — one list per spider

    Returns:
        { "batches": [ { "products": [...] }, ... ] }
        Each batch holds up to BATCH_SIZE products, shaped as sync_with_api input.
    """
    try:
        raw = event.get("products", [])

        all_products: list[dict] = list(chain.from_iterable(items if isinstance(items, list) else [] for items in raw))

        seen_urls: set[str] = set()
        unique: list[dict] = []
        for product in all_products:
            url = product.get("url")
            if url and url not in seen_urls:
                seen_urls.add(url)
                unique.append(product)

        batches = [
            {"products": unique[i : i + BATCH_SIZE]}
            for i in range(0, len(unique), BATCH_SIZE)
        ]

        print(f"[MergeResults] {len(all_products)} total → {len(unique)} unique → {len(batches)} batches")
        return {"batches": batches}

    except Exception as e:
        print(f"[MergeResults] Error: {e}")
        return {"batches": [], "error": str(e)}
