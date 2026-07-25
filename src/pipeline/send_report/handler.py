"""SendReport — última etapa del pipeline.

Recolecta todos los `unmatched` que SyncBatch escribió en S3 durante la corrida
(`pipeline/unmatched/<execution_id>/*.json` — NO viajan inline por el límite de 256 KB de I/O de
Step Functions, ver §7 Fase 4.5), y —solo en la corrida designada— genera un Excel POR CATEGORÍA
(ordenado por marca y nombre) y los envía por email (Resend) para revisión/carga manual.

Gate de envío: el email se manda únicamente en la corrida del **viernes a las 14:00 hora de Chile**
(`America/Santiago`, con DST). En cualquier otra corrida se recolectan y **borran** los unmatched sin
enviar nada (limpieza — son artefactos transitorios de scraping). Tras un envío exitoso también se
borran; si el envío falla se conservan en S3 para reintento manual.
"""

import io
import json
import os
from collections import defaultdict
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

import boto3
import openpyxl
import resend

resend.api_key = os.environ.get("RESEND_API_KEY", "")
EMAIL_SENDER = os.environ.get("EMAIL_SENDER", "")
EMAIL_RECIPIENT = os.environ.get("EMAIL_RECIPIENT", "")

_s3 = boto3.client("s3")
_bucket = os.environ.get("S3_PIPELINE_BUCKET", "")

# Corrida designada para el envío (viernes 14:00 hora de Chile).
_TZ = ZoneInfo("America/Santiago")
_SEND_WEEKDAY = 4  # lunes=0 … viernes=4
_SEND_HOUR = 14

# Encabezado de columna → clave del dict ScrapedProduct (standard_format.py).
# `price` = precio sin descuento; `best_price` = precio final que paga el cliente.
COLUMNS = [
    ("Nombre", "name"),
    ("Marca", "brand"),
    ("Envase", "packaging"),
    ("Precio", "best_price"),
    ("Precio Original", "price"),
    ("URL", "url"),
    ("Fuente", "source"),
    ("Categoría", "category"),
    ("Volumen (ml)", "volume_ml"),
    ("ABV (%)", "abv"),
    ("Fecha Scraping", "scraped_at"),
]


def _should_send(start_time: str | None) -> bool:
    """True solo en la corrida del viernes 14:00 hora de Chile (America/Santiago)."""
    if not start_time:
        return False
    dt = datetime.fromisoformat(start_time).astimezone(_TZ)
    return dt.weekday() == _SEND_WEEKDAY and dt.hour == _SEND_HOUR


def list_unmatched_keys(execution_id: str) -> list[str]:
    prefix = f"pipeline/unmatched/{execution_id}/"
    keys: list[str] = []
    paginator = _s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=_bucket, Prefix=prefix):
        keys.extend(obj["Key"] for obj in page.get("Contents", []))
    return keys


def read_unmatched(keys: list[str]) -> list[dict]:
    unmatched: list[dict] = []
    for key in keys:
        body = _s3.get_object(Bucket=_bucket, Key=key)["Body"].read()
        unmatched.extend(json.loads(body))
    return unmatched


def delete_keys(keys: list[str]) -> None:
    for key in keys:
        _s3.delete_object(Bucket=_bucket, Key=key)


def handler(event, context):
    """
    Input:
        event["execution_id"]: str — namespacing de los archivos S3 de unmatched
        event["start_time"]:   str — $$.Execution.StartTime (ISO UTC), decide el gate de envío

    Returns:
        {"sent": bool, "count": int, ...}
    """
    execution_id = event.get("execution_id", "local")
    start_time = event.get("start_time")

    keys = list_unmatched_keys(execution_id)
    unmatched = read_unmatched(keys)

    if not unmatched:
        delete_keys(keys)
        print("[SendReport] No unmatched products — nothing to do")
        return {"sent": False, "count": 0}

    if not _should_send(start_time):
        delete_keys(keys)
        print(f"[SendReport] Fuera del slot de envío — {len(unmatched)} unmatched limpiados sin email")
        return {"sent": False, "count": len(unmatched), "reason": "not_send_slot"}

    try:
        attachments = _build_attachments(unmatched)
        _send_email(attachments, len(unmatched))
        delete_keys(keys)
        print(f"[SendReport] Enviado: {len(unmatched)} unmatched en {len(attachments)} categoría(s)")
        return {"sent": True, "count": len(unmatched), "categories": len(attachments)}
    except Exception as e:
        # No se borran los unmatched: quedan en S3 para reintento manual.
        print(f"[SendReport] Error al enviar: {e}")
        return {"sent": False, "count": len(unmatched), "error": str(e)}


def _group_by_category(products: list[dict]) -> dict[str, list[dict]]:
    groups: dict[str, list[dict]] = defaultdict(list)
    for p in products:
        groups[p.get("category") or "Sin categoría"].append(p)
    # Cada categoría ordenada por marca y luego nombre.
    for items in groups.values():
        items.sort(key=lambda p: ((p.get("brand") or "").lower(), (p.get("name") or "").lower()))
    return groups


def _slug(text: str) -> str:
    return "".join(c if c.isalnum() else "_" for c in text.lower()).strip("_") or "sin_categoria"


def _build_attachments(products: list[dict]) -> list[dict]:
    """Un adjunto Excel por categoría (ordenado por marca+nombre). Ordena las categorías por nombre."""
    date_str = datetime.now(UTC).strftime("%Y-%m-%d")
    groups = _group_by_category(products)
    attachments = []
    for category in sorted(groups):
        items = groups[category]
        attachments.append(
            {
                "filename": f"sin_match_{_slug(category)}_{date_str}.xlsx",
                "content": list(_build_excel(items, category)),
            }
        )
    return attachments


def _build_excel(products: list[dict], sheet_title: str) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = sheet_title[:31] or "Sin match"  # límite de 31 chars de openpyxl

    ws.append([header for header, _ in COLUMNS])
    for product in products:
        ws.append([product.get(key, "") for _, key in COLUMNS])

    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def _send_email(attachments: list[dict], count: int):
    date_str = datetime.now(UTC).strftime("%Y-%m-%d")

    params: resend.Emails.SendParams = {
        "from": EMAIL_SENDER,
        "to": [EMAIL_RECIPIENT],
        "subject": f"Reporte semanal — {count} producto(s) sin match en {len(attachments)} categoría(s) · {date_str}",
        "html": f"""
        <h2>Productos sin match — {date_str}</h2>
        <p>Se encontraron <strong>{count} producto(s)</strong> que no pudieron ser
        asociados a ningún item de la base de datos de bebidas.</p>
        <p>Se adjunta <strong>un Excel por categoría</strong> ({len(attachments)} archivo(s)),
        cada uno ordenado por marca y nombre, para revisión y carga manual.</p>
        <hr/>
        <p style="color:#888; font-size:12px;">Generado automáticamente por RDC Scraper</p>
        """,
        "attachments": attachments,
    }

    resend.Emails.send(params)
