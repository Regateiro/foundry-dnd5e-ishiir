.PHONY: install
configure-env:
	@pipx install nodeenv
	@nodeenv .venv
	@npm install

install:
	@echo "Deploying to development environment..."
	@rsync -avz --delete --exclude 'node_modules' --exclude '.venv' --exclude '.git' ./ /home/regateiro/.local/share/FoundryVTT/Data/systems/dnd5e
	@echo "Deployment to development environment complete."

regenerate-packs-ishiir:
	@curl -s "https://regateiro.pt/sieg5e/api?source=Ishiir" > sieg5e-ishiir.json
	@curl -s "https://regateiro.pt/sieg5e/api?source=Arkaeos" > sieg5e-arkaeos.json
	@python3 generate-ishiir-packs.py ishiir