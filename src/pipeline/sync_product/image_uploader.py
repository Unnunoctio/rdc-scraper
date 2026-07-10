"""Descarga la imagen del producto, la convierte a WebP (Pillow) y la sube a S3.

Ruta: images/{category}/{sku}/{sku}.webp. Falla suave: cualquier error devuelve None (el producto
se crea sin imagen) para no tumbar el sync por una imagen rota.
"""

import io
import os

import aiohttp
import boto3
from PIL import Image

S3_IMAGES_BUCKET = os.environ["S3_IMAGES_BUCKET"]

_s3 = boto3.client("s3")


async def upload_image(
    session: aiohttp.ClientSession,
    sku: str,
    category: str,
    image_url: str | None,
) -> str | None:
    if not image_url:
        return None
    try:
        async with session.get(image_url) as resp:
            if resp.status != 200:
                return None
            raw = await resp.read()

        webp_data = _to_webp(raw)
        key = f"images/{category}/{sku}/{sku}.webp"
        _s3.put_object(
            Bucket=S3_IMAGES_BUCKET,
            Key=key,
            Body=webp_data,
            ContentType="image/webp",
        )
        return f"https://{S3_IMAGES_BUCKET}.s3.amazonaws.com/{key}"
    except Exception as e:
        print(f"[ImageUploader] Error for sku={sku}: {e}")
        return None


def _to_webp(data: bytes, quality: int = 85) -> bytes:
    img = Image.open(io.BytesIO(data))
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=quality)
    return buf.getvalue()
