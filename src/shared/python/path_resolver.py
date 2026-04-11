from typing import Any


def resolve_path(data: Any, path: str) -> Any:
    """
    Traverse a nested dict/list using dot-notation.

    Rules:
      - Numeric segments (e.g. '0') index into lists.
      - String segments access dict keys.
      - Returns None at the first missing key or out-of-range index.

    Examples:
        resolve_path(data, "items.0.sellers.0.commertialOffer.Price")
        resolve_path(data, "hits.total")
        resolve_path(data, "categories.0")
    """
    if data is None or not path:
        return None

    current = data
    for part in path.split("."):
        if current is None:
            return None
        if isinstance(current, list):
            try:
                current = current[int(part)]
            except (ValueError, IndexError):
                return None
        elif isinstance(current, dict):
            current = current.get(part)
        else:
            return None

    return current


def resolve_paths(data: Any, paths: list[str]) -> Any:
    """
    Try each path in order and return the first non-None result.
    Returns None if all paths resolve to None.
    """
    for path in paths:
        result = resolve_path(data, path)
        if result is not None:
            return result
    return None


def extract_field(data: Any, field_config: dict) -> Any:
    """
    Extract a single field from `data` using a field config dict.

    Field config schema:
        paths    (list[str])  - dot-notation paths to try in order
        type     (str)        - optional: 'float', 'int', 'str'
        prefix   (str)        - optional: string to prepend to resolved value
        suffix   (str)        - optional: string to append to resolved value

    Examples:
        extract_field(product, {"paths": ["productName", "name"]})
        extract_field(product, {
            "paths": ["linkText"],
            "prefix": "https://www.jumbo.cl/",
            "suffix": "/p"
        })
        extract_field(product, {
            "paths": ["items.0.sellers.0.commertialOffer.Price"],
            "type": "float"
        })
    """
    paths: list[str] = field_config.get("paths", [])
    value = resolve_paths(data, paths)

    if value is None:
        return None

    # Type coercion
    field_type = field_config.get("type")
    if field_type == "float":
        try:
            value = float(value)
        except (TypeError, ValueError):
            return None
    elif field_type == "int":
        try:
            value = int(value)
        except (TypeError, ValueError):
            return None
    elif field_type == "str":
        value = str(value)

    # String decorators
    prefix = field_config.get("prefix", "")
    suffix = field_config.get("suffix", "")
    if prefix or suffix:
        value = f"{prefix}{value}{suffix}"

    return value


def extract_product_fields(data: Any, product_fields: dict[str, dict]) -> dict:
    """
    Extract all declared fields from a product using the product_fields config.

    Returns a dict with only non-None values.

    Example product_fields config:
        {
          "name":    {"paths": ["productName", "name"]},
          "brand":   {"paths": ["brand"]},
          "price":   {"paths": ["items.0.sellers.0.commertialOffer.Price"], "type": "float"},
          "url":     {"paths": ["linkText"], "prefix": "https://www.jumbo.cl/", "suffix": "/p"},
          ...
        }
    """
    result: dict = {}
    for field_name, field_config in product_fields.items():
        value = extract_field(data, field_config)
        if value is not None:
            result[field_name] = value
    return result
