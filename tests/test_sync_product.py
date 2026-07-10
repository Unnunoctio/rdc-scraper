"""Test de la conversión a WebP de SyncProduct (_to_webp), sin red ni S3.

image_uploader hace `boto3.client("s3")` y lee S3_IMAGES_BUCKET en import (los provee el runtime
de Lambda). Se stubbea boto3 y se setea la env antes de cargar el módulo por ruta explícita.
"""

import importlib.util
import io
import os
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
_PATH = ROOT / "src" / "pipeline" / "sync_product" / "image_uploader.py"

os.environ.setdefault("S3_IMAGES_BUCKET", "test-bucket")


def _load_image_uploader():
    sys.modules.setdefault("boto3", SimpleNamespace(client=lambda *a, **k: MagicMock()))
    spec = importlib.util.spec_from_file_location("sync_product_image_uploader", _PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


uploader = _load_image_uploader()


def _png_bytes(color=(255, 0, 0)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (10, 10), color).save(buf, format="PNG")
    return buf.getvalue()


def test_to_webp_returns_valid_webp():
    out = uploader._to_webp(_png_bytes())
    img = Image.open(io.BytesIO(out))
    assert img.format == "WEBP"
    assert img.size == (10, 10)


def test_to_webp_accepts_rgba_source():
    buf = io.BytesIO()
    Image.new("RGBA", (8, 8), (0, 128, 0, 128)).save(buf, format="PNG")
    out = uploader._to_webp(buf.getvalue())
    assert Image.open(io.BytesIO(out)).format == "WEBP"
