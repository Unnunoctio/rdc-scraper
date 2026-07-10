"""Tests de las funciones puras de MergeResults (dedup + agrupar), sin red ni boto3.

El handler hace `import boto3` y `boto3.client("s3")` a nivel de módulo (boto3 lo provee
el runtime de Lambda, no el venv de dev). Se stubbea boto3 en sys.modules y se carga el
módulo desde su ruta explícita (evita colisión con `handler.py` del spider Jumbo).
"""

import importlib.util
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

ROOT = Path(__file__).resolve().parent.parent
_HANDLER_PATH = ROOT / "src" / "pipeline" / "merge_results" / "handler.py"


def _load_handler():
    sys.modules.setdefault("boto3", SimpleNamespace(client=lambda *a, **k: MagicMock()))
    spec = importlib.util.spec_from_file_location("merge_results_handler", _HANDLER_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


merge = _load_handler()


# ============= deduplicate =============


def test_deduplicate_keeps_first_by_url():
    products = [
        {"url": "a", "name": "A1"},
        {"url": "b", "name": "B"},
        {"url": "a", "name": "A2"},
    ]
    result = merge.deduplicate(products)
    assert [p["name"] for p in result] == ["A1", "B"]


def test_deduplicate_drops_products_without_url():
    products = [{"name": "sin url"}, {"url": "", "name": "url vacia"}, {"url": "x"}]
    result = merge.deduplicate(products)
    assert result == [{"url": "x"}]


def test_deduplicate_empty():
    assert merge.deduplicate([]) == []


# ============= group_by_category =============


def test_group_by_category_splits_by_category():
    products = [
        {"url": "1", "category": "cervezas"},
        {"url": "2", "category": "vinos"},
        {"url": "3", "category": "cervezas"},
    ]
    groups = merge.group_by_category(products)
    assert set(groups) == {"cervezas", "vinos"}
    assert len(groups["cervezas"]) == 2
    assert len(groups["vinos"]) == 1


def test_group_by_category_missing_category_uses_empty_key():
    groups = merge.group_by_category([{"url": "1"}])
    assert list(groups) == [""]
