"""Ejecuta un spider en local, sin AWS ni S3.

Monta en sys.path la layer `utils` (rdc_utils) y la carpeta del spider (módulos planos
`config`/`spider`, igual que en Lambda), corre `spider.run()` e imprime un resumen +
validación de la forma `ScrapedProduct`.

Uso:
    uv run scripts/run_spider_local.py jumbo
    uv run scripts/run_spider_local.py jumbo --json      # vuelca todos los productos
"""

import argparse
import asyncio
import importlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UTILS_LAYER = ROOT / "src" / "layers" / "utils" / "python"
SPIDERS_DIR = ROOT / "src" / "spiders"

# Clase del spider por nombre de carpeta (cada spider define su propia clase).
SPIDER_CLASSES = {"jumbo": "JumboSpider"}


def _load_spider(name: str):
    spider_dir = SPIDERS_DIR / name
    if not spider_dir.is_dir():
        sys.exit(f"spider '{name}' no existe en {SPIDERS_DIR}")

    # rdc_utils primero, luego la carpeta del spider (import plano: config, spider).
    sys.path.insert(0, str(UTILS_LAYER))
    sys.path.insert(0, str(spider_dir))

    module = importlib.import_module("spider")
    class_name = SPIDER_CLASSES.get(name)
    if class_name is None or not hasattr(module, class_name):
        sys.exit(f"no se encontró la clase del spider '{name}' (esperaba {class_name})")
    return getattr(module, class_name)


def main() -> None:
    parser = argparse.ArgumentParser(description="Ejecuta un spider en local (sin AWS).")
    parser.add_argument("spider", help="nombre del spider (carpeta en src/spiders/)")
    parser.add_argument("--json", action="store_true", help="vuelca todos los productos como JSON")
    args = parser.parse_args()

    spider_cls = _load_spider(args.spider)
    products = asyncio.run(spider_cls().run())

    if args.json:
        print(json.dumps(products, ensure_ascii=False, indent=2))
        return

    print(f"\n[{args.spider}] {len(products)} productos\n")
    complete = sum(1 for p in products if p.get("price", 0) > 0 and p.get("best_price", 0) > 0)
    print(f"con precio > 0: {complete}/{len(products)}")
    for p in products[:5]:
        print(f"  - {p.get('name')} | ${p.get('best_price')} | {p.get('url')}")


if __name__ == "__main__":
    main()
