import io
import os
from datetime import datetime, timezone

import openpyxl
import resend

resend.api_key = os.environ["RESEND_API_KEY"]
EMAIL_SENDER = os.environ["EMAIL_SENDER"]
EMAIL_RECIPIENT = os.environ["EMAIL_RECIPIENT"]

# Column headers and their corresponding product dict keys
COLUMNS = [
    ("Nombre", "name"),
    ("Marca", "brand"),
    ("Precio", "price"),
    ("Precio Original", "original_price"),
    ("URL", "url"),
    ("Fuente", "source"),
    ("Categoría", "category"),
    ("Volumen (ml)", "volume_ml"),
    ("ABV (%)", "abv"),
    ("Fecha Scraping", "scraped_at"),
]


def handler(event, context):
    """
    Generate an Excel report of unmatched products and send it via email.

    Input (batch mode — output of SyncWithApiParallel Map):
        event["results"]: list of sync_with_api result dicts, one per batch
    Input (legacy):
        event["unmatched"]: list of ScrapedProduct dicts

    Returns:
        { "sent": bool, "count": int }
    """
    results: list[dict] = event.get("results", [])
    if results:
        unmatched: list[dict] = []
        for r in results:
            unmatched.extend(r.get("unmatched", []))
    else:
        unmatched = event.get("unmatched", [])

    if not unmatched:
        print("[SendReport] No unmatched products — skipping email")
        return {"sent": False, "count": 0}

    try:
        excel_bytes = _build_excel(unmatched)
        _send_email(excel_bytes, len(unmatched))
        print(f"[SendReport] Sent report with {len(unmatched)} unmatched product(s)")
        return {"sent": True, "count": len(unmatched)}

    except Exception as e:
        print(f"[SendReport] Error: {e}")
        return {"sent": False, "count": len(unmatched), "error": str(e)}


def _build_excel(products: list[dict]) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Sin match"

    ws.append([col[0] for col in COLUMNS])

    for product in products:
        ws.append([product.get(key, "") for _, key in COLUMNS])

    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def _send_email(excel_bytes: bytes, count: int):
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    params: resend.Emails.SendParams = {
        "from": EMAIL_SENDER,
        "to": [EMAIL_RECIPIENT],
        "subject": f"[RDC Scraper] {count} producto(s) sin match — {date_str}",
        "html": f"""
        <h2>Productos sin match — {date_str}</h2>
        <p>Se encontraron <strong>{count} producto(s)</strong> que no pudieron ser
        asociados a ningún item de la base de datos de bebidas.</p>
        <p>Adjunto el Excel con el detalle para revisión y carga manual.</p>
        <hr/>
        <p style="color:#888; font-size:12px;">Generado automáticamente por RDC Scraper</p>
        """,
        "attachments": [
            {
                "filename": f"unmatched_{date_str}.xlsx",
                "content": list(excel_bytes),
            }
        ],
    }

    resend.Emails.send(params)
