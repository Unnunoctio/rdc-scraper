"""Monta en sys.path las layers y las carpetas de spiders (módulos planos como en Lambda)."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

for path in (
    ROOT / "src" / "layers" / "utils" / "python",
    ROOT / "src" / "spiders" / "jumbo",
):
    sys.path.insert(0, str(path))
