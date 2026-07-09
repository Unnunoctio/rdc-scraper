# SAM BuildMethod: makefile — construye la DatabaseLayer (deps pip + código propio).
# SAM ejecuta `make -f Makefile build-DatabaseLayer` con CWD=ContentUri, dentro del
# contenedor de build (arm64). ARTIFACTS_DIR lo provee SAM.
# rdc_utils NO se incluye aquí: lo provee la UtilsLayer en runtime (ambas se adjuntan).
# Layout resultante: $(ARTIFACTS_DIR)/python/{pymongo,dns,...,rdc_database}
build-DatabaseLayer:
	pip install -r requirements.txt -t "$(ARTIFACTS_DIR)/python"
	cp -r python/rdc_database "$(ARTIFACTS_DIR)/python/"
