.PHONY: install
configure-env:
	@pipx install nodeenv
	@nodeenv .venv
	@npm install

install:
	@echo "Deploying to development environment..."
	@rsync -avz --delete --exclude 'node_modules' --exclude '.venv' --exclude '.git' ./ /home/regateiro/.local/share/FoundryVTT/Data/systems/dnd5e
	@echo "Deployment to development environment complete."

regenerate-packs:
	@curl -s "https://regateiro.pt/sieg5e/api" > sieg5e.json
	@bash -c "rm -rf packs/src/sieg5e-{classes,subclasses,classfeatures,optfeatures,races}"
	@bash -c "mkdir -p packs/src/sieg5e-{classes,subclasses,classfeatures,optfeatures,races}"
	@python3 generate-ishiir-packs.py