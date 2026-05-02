# Project Agent Guide

## Project Overview
**Sieg5e** — a custom D&D 5th Edition game system for [Foundry Virtual Tabletop](https://foundryvtt.com). This is a fork/variant of the official `foundryvtt/dnd5e` system.

- **System ID**: `dnd5e`
- **Version**: 2.4.10
- **Foundry compatibility**: minimum 10.303, verified on v11
- **Target platform**: Foundry VTT (server-side JavaScript)

## Build, Lint & Test
- **Build all assets**: `npm run build` (code + CSS + packs)
- **Compile JavaScript**: `npm run build:code` (Rollup + sourcemap, inline dynamic imports)
- **Generate CSS**: `npm run build:css` (lessc)
- **Pack database files**: `npm run build:db` (compile JSON → NEDB packs)
- **Extract packs to JSON**: `npm run build:json` (NEDB → JSON)
- **Clean pack cache**: `npm run build:clean` (clean/format source JSON)
- **Lint**: `npm run lint`
- **Auto‑fix lint issues**: `npm run lint:fix`
- **Watch LESS for hot reload**: `npm run watch`

- Tests are under `./tests/` and run inside Foundry VTT (not via npm). Main entry: `tests/tests.mjs`.

### Python Tooling (Pack Generation)
- **Script**: `generate_ishiir_packs.py` — fetches external API data and generates compendium packs
- **Makefile targets**:
  - `make configure-env` — sets up `.venv` with nodeenv + npm
  - `make install` — rsync to local Foundry VTT dev environment
  - `make regenerate-packs-ishiir` — fetch API data → generate packs → build
  - `make lint-py` — lint Python script (isort, black, flake8, pylint)

## Code Style & Conventions
- **File format**: All source files are ES modules (`*.mjs`). They live at the repo root or under `module/`.
- **Imports**: Use relative paths only. Include file extensions (e.g., `./foo.mjs`). Avoid wildcard imports.
- **Formatting**: ESLint enforces style. Run `npm run lint:fix` to auto‑format.
- **JSDoc**: Every public function, class, or module needs a JSDoc block. Keep tags short: `@param`, `@returns`, `@throws`.
- **Naming**: Variables/functions: camelCase | Classes: PascalCase | Constants: UPPER_SNAKE_CASE | Files: kebab-case
- **Error handling**: Use `throw new Error(message)` for unrecoverable errors. Wrap async ops in `try/catch` and log with `fancyLog()`.
- **Logging**: Use `fancyLog()` from `@foundryvtt/foundryvtt-cli`. Do not use `console.log` in production.

## Project Structure
```
/
├── dnd5e.mjs                 # Entry point (ES module)
├── dnd5e-compiled.mjs        # Compiled bundle (generated, untracked)
├── dnd5e.css                 # Compiled CSS
├── system.json               # Foundry VTT manifest (version, packs, compatibility)
├── template.json             # Actor/Item data templates
├── lang/en.json              # Localization
├── module/                   # 143 source files across sub-modules
│   ├── applications/         # UI sheets, dialogs, configs
│   │   ├── actor/            # Actor sheets & configs
│   │   ├── advancement/      # Level-up / advancement flow
│   │   ├── combat/           # Combat tracker
│   │   ├── item/             # Item sheets & dialogs
│   │   └── journal/          # Journal applications
│   ├── canvas/               # Canvas detection modes
│   ├── data/                 # Data model definitions & templates
│   │   ├── actor/            # Actor data + templates
│   │   ├── advancement/      # Advancement data
│   │   ├── item/             # Item data + templates
│   │   ├── journal/          # Journal data
│   │   └── shared/           # Shared data utilities
│   ├── documents/            # Document classes (Actor, Item, etc.)
│   ├── dice/                 # Dice rolling engine
│   ├── config.mjs            # System configuration
│   ├── migration.mjs         # Data migration utilities
│   ├── settings.mjs          # System settings
│   └── utils.mjs             # Shared utilities
├── less/                     # LESS source files (variables, character, items, apps, etc.)
├── packs/                    # Compiled NEDB compendium packs
├── tokens/                   # Token images
├── icons/                    # Icon assets
├── templates/                # Handlebars HTML templates
├── json/                     # Source JSON for compendia
├── sieg5e-ishiir.json        # Generated pack source data (Ishiir)
├── sieg5e-arkaeos.json       # Generated pack source data (Arkaeos)
├── tests/                    # Foundry VTT test suite
├── .github/workflows/        # CI (release.yml)
├── Makefile                  # Dev shortcuts (install, lint, pack regen)
├── CONTRIBUTING.md           # Contributor guidelines
└── package.json              # Dev dependencies (Rollup, ESLint, LESS, etc.)
```

## Compendium Packs
The system ships with 19 packs defined in `system.json`:
- **SRD Content** (14 packs): heroes, monsters, items, tradegoods, spells, backgrounds, classes, subclasses, classfeatures, races, monsterfeatures, rules, tables
- **Sieg5e Custom** (5 packs): sieg5e-classes, sieg5e-subclasses, sieg5e-classfeatures, sieg5e-optfeatures, sieg5e-races
- Pack folders organize content into "DnD5e SRD Content" and "Sieg5e Content"

## Hot Reload
Configured in `system.json` flags for development:
- Extensions: `css`, `hbs`, `json`
- Paths: `dnd5e.css`, `templates/`, `lang/`

## Token Sorting
Tokens are sorted by: smaller tokens on top > player tokens on top of NPC > more recently moved on top.

Implementation in `module/canvas/token.mjs`:
- `Token5e.lastMoved` (static Map) tracks the last time each token was moved
- `Token5e.sortTokens()` implements the sorting logic
- `_onUpdate()` updates `lastMoved` when a token's x/y changes, then calls `globalThis.canvas.primary.sortChildren()` to re-sort tokens immediately

## Foundry Core Reference
The system extends Foundry VTT's core classes (e.g., `Token`, `Actor`, `Item`). Refer to `foundry.js` in your Foundry data directory for the base implementation. **Do not import from or modify foundry.js** — use it only for understanding the inherited behavior and API.

## Release Process
- CI triggered by pushing a tag matching `release-x.x.x`
- `system.json` version must match the tag version
- `system.json` download URL must point to the CI artifact
- `master` holds the most recent release; work happens on `x.x.x` dev branches
- See `.github/workflows/release.yml` for full CI pipeline

## Misc
- **Testing**: If you add tests, keep them in a dedicated folder to avoid accidental commits of test data.

---

**Tip**: After any change, run `npm run lint && npm run build` to ensure code quality and a fresh bundle.