"""Tests de las funciones puras de SearchDrinks (_best_match) y del cliente Drinks (mapeos).

El handler hace imports planos (`import drinks_client`) como en Lambda, y drinks_client lee
DRINKS_API_URL en import. Se setean las env y se agrega la carpeta de la función a sys.path
antes de cargar el módulo por ruta explícita (evita colisión con otros `handler.py`).
"""

import importlib.util
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
_DIR = ROOT / "src" / "pipeline" / "search_drinks"

os.environ.setdefault("DRINKS_API_URL", "https://drinks.example.com/api/")
os.environ.setdefault("DRINKS_API_KEY", "test-key")
sys.path.insert(0, str(_DIR))


def _load(name: str):
    spec = importlib.util.spec_from_file_location(f"search_drinks_{name}", _DIR / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


handler = _load("handler")
drinks_client = _load("drinks_client")


# ============= _best_match =============


def test_best_match_picks_most_specific_subset():
    drinks = [
        {"name": "Corona"},
        {"name": "Corona Extra"},
        {"name": "Heineken"},
    ]
    match = handler._best_match("Cerveza Corona Extra Lata 355ml", drinks)
    assert match == {"name": "Corona Extra"}


def test_best_match_none_when_no_subset():
    drinks = [{"name": "Heineken"}, {"name": "Budweiser"}]
    assert handler._best_match("Cerveza Corona Extra", drinks) is None


def test_best_match_case_and_order_insensitive():
    drinks = [{"name": "Extra Corona"}]
    assert handler._best_match("corona EXTRA botella", drinks) == {"name": "Extra Corona"}


def test_best_match_empty_drinks():
    assert handler._best_match("Corona", []) is None


# ============= drinks_client mapeos =============


def test_drinks_client_url_stripped():
    assert drinks_client.DRINKS_API_URL == "https://drinks.example.com/api"


def test_category_map_covers_scraper_categories():
    assert drinks_client.CATEGORY_MAP == {
        "Cervezas": "beers",
        "Destilados": "spirits",
        "Vinos": "wines",
    }


def test_packaging_map_es_to_api():
    assert drinks_client.PACKAGING_MAP["Botella"] == "Bottle"
    assert drinks_client.PACKAGING_MAP["Tetrapack"] == "Box/Tetrapack"
    assert drinks_client.PACKAGING_MAP["Caja"] == "Box/Tetrapack"
