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
The system extends Foundry VTT's core classes (e.g., `Token`, `Actor`, `Item`). Refer to `docs/foundry.js` and `docs/commons.js` for the base implementation. **Do not import from or modify these files** — use them only for understanding the inherited behavior and API.

### Global Variables
Foundry VTT exposes several global variables to systems and modules at runtime via `foundry.js`. These are available globally without requiring imports:

| Variable | Type | Description |
|----------|-----|-------------|
| `globalThis.vtt` | `string` | String prefix for console logging ("Foundry VTT") |
| `globalThis.game` | `Game` | The singleton Game instance |
| `globalThis.SIGNED_EULA` | `boolean` | Whether the EULA has been signed |
| `globalThis.ROUTE_PREFIX` | `string` | Route prefix applied to this game |
| `globalThis.MESSAGES` | `Array` | Critical server-side startup messages to display |
| `globalThis.ui` | `Object<Application>` | Collection of open application instances (`ui.windows`) |
| `globalThis.logger` | `Console` | Client-side console logger |
| `globalThis.Color` | `foundry.utils.Color` | Color management and manipulation class |
| `globalThis.CONFIG` | `Object` | Game configuration object (document types, constants, etc.) |
| `globalThis.Hooks` | `Hooks` | Event hook registration and dispatch system |
| `globalThis.TextEditor` | `TextEditor` | Rich text editor (TinyMCE/ProseMirror) |
| `globalThis.SortingHelpers` | `SortingHelpers` | Sorting utilities for placeable objects |
| `globalThis.canvas` | `Canvas` | The game canvas instance |
| `globalThis.dnd5e` | `Object` | System configuration (DND5E module) |

### Common Utilities & Constants
Refer to `docs/commons.js` for Foundry VTT's shared utilities and constants. These are also available at runtime:

#### Color Class
`Color` extends `Number` to represent hex colors with manipulation methods:

| Property/Method | Type | Description |
|----------------|-----|-------------|
| `.css` | `string` | CSS-compatible color string |
| `.rgb` | `[number, number, number]` | RGB array [r, g, b] in [0, 1] |
| `.r`, `.g`, `.b` | `number` | Individual channel values in [0, 1] |
| `.hsv` | `[number, number, number]` | HSV array |
| `.maximum`, `.minimum` | `number` | Max/min channel value |
| `.equals(other)` | `boolean` | Compare two colors |
| `.toRGBA(alpha)` | `string` | CSS RGBA string |
| `.mix(other, weight)` | `Color` | Mix with another color |
| `.multiply(other)` | `Color` | Multiply by color/scalar |
| `.add(other)` | `Color` | Add color/scalar |
| `.subtract(other)` | `Color` | Subtract color/scalar |
| `.maximize(other)` | `Color` | Channel-wise max |
| `.minimize(other)` | `Color` | Channel-wise min |
| `Color.from(color)` | `Color` | Factory from various inputs |
| `Color.fromRGB(rgb)` | `Color` | Factory from RGB array |
| `Color.fromHSV(hsv)` | `Color` | Factory from HSV array |

#### Core Constants
Key constants from `CONST`:

| Constant | Type | Description |
|----------|-----|-------------|
| `VTT` | `string` | "Foundry Virtual Tabletop" |
| `WEBSITE_URL` | `string` | https://foundryvtt.com |
| `DEFAULT_TOKEN` | `string` | Default token image path |
| `DOCUMENT_TYPES` | `string[]` | Allowed document types |
| `DOCUMENT_OWNERSHIP_LEVELS` | `enum` | Ownership levels (INHERIT, NONE, LIMITED, OBSERVER, OWNER) |
| `USER_ROLES` | `enum` | User roles (NONE, PLAYER, TRUSTED, ASSISTANT, GAMEMASTER) |
| `ACTIVE_EFFECT_MODES` | `enum` | Effect application modes (CUSTOM, MULTIPLY, ADD, DOWNGRADE, UPGRADE, OVERRIDE) |
| `GRID_TYPES` | `enum` | Grid types (GRIDLESS, SQUARE, HEXODDR, HEXEVENR, HEXODDQ, HEXEVENQ) |
| `TOKEN_DISPOSITIONS` | `enum` | Token dispositions (HOSTILE, NEUTRAL, FRIENDLY) |
| `COMPATIBILITY_MODES` | `enum` | Compatibility warning modes (SILENT, WARNING, ERROR, FAILURE) |
| `DICE_ROLL_MODES` | `enum` | Roll visibility (PUBLIC, PRIVATE, BLIND, SELF) |

#### Helper Functions
Utility functions from `foundry.js` helpers:

| Function | Description |
|----------|-------------|
| `logCompatibilityWarning(message, options)` | Log filtered compatibility warnings |
| `debounce(callback, delay)` | Wrap callback in debounced timeout |
| `deepClone(original, options)` | Clone simple data structures |
| `diffObject(original, other, options)` | Deep difference between objects |
| `benchmark(func, iterations, ...args)` | Performance benchmark helper |

#### Global Classes (not on globalThis, but available via game.*)
- **`Hooks`**: Event system for registering callbacks (`Hooks.on()`, `Hooks.call()`, `Hooks.callAll()`)
- **`TextEditor`**: Rich text editing via TinyMCE or ProseMirror
- **`SortingHelpers`**: Integer sorting algorithms for placeables
- **`ClientKeybindings`**: Keybinding management (`game.keybindings`)
- **`KeyboardManager`**: Keyboard input handling
- **`MouseManager`**: Mouse input handling
- **`GamepadManager`**: Gamepad input handling
- **`TooltipManager`**: Tooltip rendering and positioning
- **`Tour`** / **`Tours`**: New user experience tours
- **`ImageHelper`**: Image processing utilities
- **`VideoHelper`**: Video playback utilities
- **`ClipboardHelper`**: Clipboard access (`game.clipboard`)
- **`ClientSettings`**: Settings management (`game.settings`)
- **`DocumentIndex`**: Document indexing for search
- **`WordTree`**: Prefix-based lookups for search
- **`Localization`**: i18n support (`game.i18n`)

### Modified Functions
The dnd5e project modifies some core Foundry functions for custom behavior:

| Function | Location | Description |
|----------|----------|-------------|
| `PrimaryCanvasGroup._sortObjects` | `dnd5e.mjs:343` | Overrides the canvas sorting logic to use custom token sorting (smaller tokens on top, player tokens on top of NPC, more recently moved on top). Calls `Token5e.sortTokens()` for TokenMesh objects. |
| `Ruler` class patches | `module/canvas/ruler-elevation.mjs` (called from `dnd5e.mjs:380` canvasReady hook) | Two-phase setup: `setupRulerElevation()` configures diagonal rules and replaces `Ruler._computeDistance` for 3D distance; `installRulerPatches()` patches `toJSON()`, `update()`, `_getSegmentLabel()`, `clear()`, `_removeWaypoint()`, `moveToken()`, and installs the mouse wheel handler. Syncs elevation to remote clients via `broadcastActivity` |

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