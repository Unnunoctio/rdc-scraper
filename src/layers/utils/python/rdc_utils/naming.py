"""Generación de SKU, nombre y slug de producto a partir del drink normalizado."""

import random
import re
import string
import unicodedata

from rdc_utils.mappings import PACKAGING_MAP_ES, SPIRIT_TYPE_MAP_ES


def generate_sku() -> str:
    return "".join(random.choices(string.digits, k=8))


def _format_volume(volume_ml: int) -> str:
    if volume_ml < 1000:
        return f"{volume_ml}cc"
    return f"{volume_ml / 1000:g}L"


def _format_abv(abv: float) -> str:
    return f"{abv:g}°"


def generate_product_name(drink: dict, category: str, quantity: int) -> str:
    packaging_es = PACKAGING_MAP_ES.get(drink.get("packaging", ""), drink.get("packaging", ""))
    if category == "Cervezas":
        category_token = "Cerveza"
    else:
        spirit_type = drink.get("type", "")
        category_token = SPIRIT_TYPE_MAP_ES.get(spirit_type, spirit_type)

    core = (
        f"{category_token} {drink['brand']} {drink['name']} "
        f"{packaging_es} {_format_abv(drink['abv'])} {_format_volume(drink['volume'])}"
    )
    if quantity > 1:
        return f"Pack {quantity} un. {core}"
    return core


def _slugify(text: str) -> str:
    normalized = unicodedata.normalize("NFD", text)
    ascii_text = "".join(c for c in normalized if unicodedata.category(c) != "Mn")
    hyphenated = re.sub(r"[^a-z0-9]+", "-", ascii_text.lower())
    return hyphenated.strip("-")


def generate_product_slug(sku: str, name: str, volume_ml: int) -> str:
    without_abv = re.sub(r"\d+(?:\.\d+)?°", "", name)
    without_volume = re.sub(r"\d+(?:\.\d+)?[Ll]|\d+cc", "", without_abv)
    body = _slugify(f"{without_volume} {volume_ml}cc")
    return f"{sku.lower()}-{body}"
