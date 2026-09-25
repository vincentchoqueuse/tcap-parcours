# TCAP · Parcours du dimanche
#   make build   — régénère site/data/routes.js et site/gpx/ depuis l'export Strava + build/catalog.json
#   make serve   — sert site/ en local sur http://localhost:8765
#   make open    — build + serve + ouvre le navigateur
#   make check   — vérifie la syntaxe de script.js et la validité de catalog.json
#   make clean   — supprime les fichiers générés

EXPORT ?= $(firstword $(wildcard export_*))
PORT   ?= 8765
PYTHON ?= python3
SITE    = site

.PHONY: all build serve open check deps clean

all: build

deps:
	$(PYTHON) -m pip install -q fitdecode

build: build/catalog.json build/build.py
	$(PYTHON) build/build.py $(EXPORT)

serve:
	@echo "→ http://localhost:$(PORT)/   (Ctrl-C pour arrêter)"
	@echo "→ exemple de fiche : http://localhost:$(PORT)/?id=minou-deolen"
	$(PYTHON) -m http.server $(PORT) --directory $(SITE)

open: build
	@( sleep 1 ; open "http://localhost:$(PORT)/" ) &
	@$(MAKE) --no-print-directory serve

check:
	$(PYTHON) -c "import json; json.load(open('build/catalog.json', encoding='utf-8')); print('catalog.json OK')"
	node -e "new Function(require('fs').readFileSync('$(SITE)/script.js','utf8')); console.log('script.js OK')"

clean:
	rm -rf $(SITE)/data $(SITE)/gpx
