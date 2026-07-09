"""Tests de los extractores puros del spider Jumbo (sin red)."""

from spider import _extract_abv, _extract_packaging, _extract_quantity, _extract_volume


def _spec(key: str, value: str) -> dict:
    return {"key": key, "value": [value]}


# ============= abv =============


def test_abv_from_graduacion_spec():
    specs = [_spec("Graduación Alcohólica", "4.5°")]
    assert _extract_abv(specs, "Cerveza Lager") == 4.5


def test_abv_from_name_degree_pattern():
    assert _extract_abv([], "Pisco Alto del Carmen 35°") == 35.0


def test_abv_from_grado_spec_accepts_numeric():
    assert _extract_abv([_spec("Grado", "12%")], "Vino") == 12.0


def test_abv_grado_spec_rejects_category_range():
    # "Bajo (<5%ABV)" no debe parsear el 5 (lleva '<' delante).
    assert _extract_abv([_spec("Grado", "Bajo (<5%ABV)")], "Bebida") is None


def test_abv_none_when_absent():
    assert _extract_abv([], "Agua Mineral") is None


# ============= volumen =============


def test_volume_ml():
    assert _extract_volume("Cerveza Lata 470 cc") == 470


def test_volume_liters_to_ml():
    assert _extract_volume("Vino Tinto 1.5 L") == 1500


def test_volume_none_when_absent():
    assert _extract_volume("Cerveza sin volumen") is None


# ============= cantidad (pack) =============


def test_quantity_pack_from_spec():
    assert _extract_quantity([_spec("Cantidad", "6 unidades")], "Pack Cervezas") == 6


def test_quantity_pack_from_name_units():
    assert _extract_quantity([], "Pack Cerveza 12 un.") == 12


def test_quantity_bipack():
    assert _extract_quantity([], "Bipack Bebida") == 2


def test_quantity_default_single():
    assert _extract_quantity([], "Cerveza individual") == 1


# ============= packaging =============


def test_packaging_destilados_is_botella():
    assert _extract_packaging([], "Whisky", "Destilados") == "Botella"


def test_packaging_from_envase_spec():
    assert _extract_packaging([_spec("Envase", "Lata")], "Cerveza", "Cervezas") == "Lata"


def test_packaging_caja_vino_is_tetrapack():
    assert _extract_packaging([_spec("Envase", "Caja")], "Vino", "Vinos") == "Tetrapack"


def test_packaging_from_name_fallback():
    assert _extract_packaging([], "Cerveza en Botella", "Cervezas") == "Botella"


def test_packaging_none_when_unknown():
    assert _extract_packaging([], "Producto sin envase", "Cervezas") is None
