-include PrivateRules.mak

AUTH_TOKEN ?=


.PHONY: install lint-py

configure-env:
	@pipx install nodeenv
	@nodeenv .venv
	@npm install

install:
	@echo "Rebuilding system..."
	@.venv/bin/npm run build:clean
	@.venv/bin/npm run build
	@echo "Deploying to development environment..."
	@rsync -avz --delete --exclude 'node_modules' --exclude '.venv' --exclude '.git' ./ /home/regateiro/.local/share/FoundryVTT/Data/systems/dnd5e
	@echo "Deployment to development environment complete."

regenerate-packs-ishiir:
	@curl -s -H "Authorization: Bearer $(AUTH_TOKEN)" "https://regateiro.pt/sieg5e/api?source=Ishiir" > sieg5e-ishiir.json
	@curl -s -H "Authorization: Bearer $(AUTH_TOKEN)" "https://regateiro.pt/sieg5e/api?source=Arkaeos" > sieg5e-arkaeos.json
	@python3 generate_ishiir_packs.py ishiir
	@.venv/bin/npm run build:clean
	@.venv/bin/npm run build
	@echo "Resetting pack JSON files whose only diff is _stats.modifiedTime..."
	@git ls-files -- 'packs/src/**/*.json' | grep -v '^sieg5e-' | while read f; do \
	  if git diff --quiet "$${f}" 2>/dev/null; then continue; fi; \
	  changes=$$(git diff "$$f" | grep '^[-+]' | sed 's/^[-+]//' | grep -v '"modifiedTime"' | grep -v '^-- a/' | grep -v '++ b/' || true); \
	  if [ -z "$$changes" ]; then git checkout -- "$$f" && echo "  reset: $$f"; fi; \
	done
	@echo "Done."

lint-py:
	@isort --profile black ./generate_ishiir_packs.py
	@flake8 ./generate_ishiir_packs.py
	@black ./generate_ishiir_packs.py
	@pylint ./generate_ishiir_packs.py
