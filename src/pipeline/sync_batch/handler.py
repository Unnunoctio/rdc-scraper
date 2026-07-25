"""SyncBatch — etapa unificada del SyncPipeline (Map, un batch por invocación).

Fusiona las tres antiguas etapas del Map (FindByPath -> SearchDrinks -> SyncProduct) en una sola
invocación para recortar las state transitions de Step Functions (de 3 por batch a 1). El batch
corre en un único event loop persistente (el de `rdc_database`, al que está ligado el cliente Mongo)
compartiendo entre fases la conexión a Mongo, el cache de `infos` (allowlist, cargado una vez) y una
sola `aiohttp.ClientSession` (Drinks API + descarga de imágenes).

Flujo (todo en memoria dentro del batch, sin round-trips por Step Functions):
    load_batch(S3) -> find_and_update -> search_all -> sync_all -> escribe unmatched a S3
"""

import json
import os

import aiohttp
import boto3
import rdc_database as db
from find_by_path import find_and_update
from search_drinks import search_all
from sync_product import sync_all

_s3 = boto3.client("s3")
_bucket = os.environ["S3_PIPELINE_BUCKET"]


def load_batch(s3_key: str) -> list[dict]:
    obj = _s3.get_object(Bucket=_bucket, Key=s3_key)
    products = json.loads(obj["Body"].read())
    _s3.delete_object(Bucket=_bucket, Key=s3_key)
    return products


def handler(event, context):
    """
    Input:
        event["s3_key"]:       str — S3 key del batch escrito por MergeResults
        event["category"]:     str
        event["sync_token"]:   str — StartTime de la ejecución, marca de "visto en esta corrida"
        event["execution_id"]: str — namespacing de los archivos S3 de unmatched

    Returns:
        {"sync_token": str, "category": str, "unmatched_count": int, "unmatched_key": str | None}

    Los `unmatched` NO se devuelven inline (superarían el límite de 256 KB de I/O de Step Functions
    al agregar el resultado del Map): se escriben a S3 y se devuelve solo un puntero. La clave usa el
    `aws_request_id` (único por invocación) y no la categoría, porque hay varios batches por categoría
    corriendo en paralelo: con la categoría se pisarían entre sí. SendReport los recolecta con un glob
    del prefijo pipeline/unmatched/<exec>/.
    """
    s3_key = event["s3_key"]
    category = event.get("category", "")
    sync_token = event["sync_token"]
    execution_id = event.get("execution_id", "local")
    request_id = getattr(context, "aws_request_id", "local")

    products = load_batch(s3_key)
    unmatched = db.run(_process_batch(products, sync_token, category))

    unmatched_key = None
    if unmatched:
        unmatched_key = f"pipeline/unmatched/{execution_id}/{request_id}.json"
        _s3.put_object(
            Bucket=_bucket,
            Key=unmatched_key,
            Body=json.dumps(unmatched),
            ContentType="application/json",
        )

    print(f"[SyncBatch] category={category} unmatched={len(unmatched)} key={unmatched_key}")
    return {
        "sync_token": sync_token,
        "category": category,
        "unmatched_count": len(unmatched),
        "unmatched_key": unmatched_key,
    }


async def _process_batch(products: list[dict], sync_token: str, category: str) -> list[dict]:
    """Corre las tres fases sobre un único loop, cache de `infos` y sesión HTTP compartidos.

    Devuelve la lista de `unmatched` (los no matcheados por SearchDrinks + los fallidos de SyncProduct)
    para que el handler la persista a S3 fuera del loop.
    """
    database = db.get_db()
    await db.load_info_cache(database)

    async with aiohttp.ClientSession() as session:
        # Fase 1 — match por websites.path + update de precio; los no hallados van a `remaining`.
        remaining, updated, skipped = await find_and_update(database, products, sync_token)
        print(
            f"[SyncBatch] category={category} updated={updated} "
            f"remaining={len(remaining)} skipped_unknown_source={skipped}"
        )

        # Fase 2 — busca los `remaining` en la Drinks API.
        matched, unmatched = await search_all(session, remaining)
        print(f"[SyncBatch] category={category} matched={len(matched)} unmatched={len(unmatched)}")

        # Fase 3 — add_website | create_product (+imagen); los fallidos se suman a `unmatched`.
        added, created, failed = await sync_all(database, session, matched, sync_token)

    unmatched += failed
    print(f"[SyncBatch] category={category} added={added} created={created} errors={len(failed)}")
    return unmatched
