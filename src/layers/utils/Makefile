# SAM BuildMethod: makefile — construye la UtilsLayer (deps pip + código propio).
# SAM ejecuta `make -f Makefile build-UtilsLayer` con CWD=ContentUri, dentro del
# contenedor de build (arm64). ARTIFACTS_DIR lo provee SAM.
# Layout resultante: $(ARTIFACTS_DIR)/python/{aiohttp,bs4,...,rdc_utils}
build-UtilsLayer:
	pip install -r requirements.txt -t "$(ARTIFACTS_DIR)/python"
	cp -r python/rdc_utils "$(ARTIFACTS_DIR)/python/"
