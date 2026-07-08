.PHONY: sync export build deploy seed test lint fmt validate clean

# Instala/actualiza el entorno del workspace desde uv.lock
# --all-packages: incluye las deps de todos los miembros (apps con package=false)
sync:
	uv sync --all-packages

# Exporta un requirements.txt por artefacto (layer + funciones) desde el lockfile de uv.
# SAM lo consume en el build. Se recorre cada miembro del workspace.
export:
	@for dir in src/shared src/spiders/* src/pipeline/*; do \
		if [ -f "$$dir/pyproject.toml" ]; then \
			echo "[export] $$dir/requirements.txt"; \
			uv export --package "$$(basename $$dir)" --no-hashes --no-dev --no-emit-workspace \
				-o "$$dir/requirements.txt" 2>/dev/null || true; \
		fi; \
	done

# Build para Lambda (contenedor: compila deps nativas arm64)
build: export
	sam build --use-container

# Deploy (usa samconfig.toml)
deploy: build
	sam deploy

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
