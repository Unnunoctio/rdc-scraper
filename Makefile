.PHONY: sync export build deploy init-db seed test lint fmt validate clean

# Instala/actualiza el entorno del workspace desde uv.lock
# --all-packages: incluye las deps de todos los miembros (apps con package=false)
sync:
	uv sync --all-packages

# Exporta un requirements.txt por artefacto (layer + funciones) desde el lockfile de uv.
# SAM lo consume en el build. Se recorre cada miembro del workspace; el nombre del paquete
# se lee del `name` de su pyproject.toml (NO del basename del directorio: no coinciden,
# p.ej. src/spiders/jumbo -> rdc-spider-jumbo). --no-emit-workspace excluye los miembros
# del workspace (las layers ya proveen su propio código en runtime): solo deps de terceros.
export:
	@set -e; for dir in src/layers/* src/spiders/* src/pipeline/*; do \
		if [ -f "$$dir/pyproject.toml" ]; then \
			pkg=$$(grep -m1 '^name' "$$dir/pyproject.toml" | sed 's/.*= *//; s/"//g'); \
			echo "[export] $$dir/requirements.txt ($$pkg)"; \
			uv export --package "$$pkg" --no-hashes --no-dev --no-emit-workspace \
				-o "$$dir/requirements.txt"; \
		fi; \
	done

# Build para Lambda (contenedor: compila deps nativas x86_64, nativo en host x86_64)
build: export
	sam build --use-container

# Deploy (usa samconfig.toml)
deploy: build
	sam deploy

# Crea colecciones e índices en Mongo (idempotente; no siembra datos)
init-db:
	uv run scripts/init_db.py --uri "$(MONGODB_URI)" --db "$(MONGODB_DB)"

# Siembra la metadata de tiendas en Mongo (allowlist de `source`)
seed:
	uv run scripts/seed_infos.py --uri "$(MONGODB_URI)" --db "$(MONGODB_DB)" --file seed/infos.json

test:
	uv run pytest

lint:
	uv run ruff check .

fmt:
	uv run ruff format .

validate:
	sam validate --lint

clean:
	rm -rf .aws-sam
	find . -type d -name __pycache__ -not -path './.deprecated/*' -exec rm -rf {} +
