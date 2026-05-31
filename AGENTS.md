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
├── docs/                     # Runtime reference docs
│   ├── foundry.js            # Foundry VTT core class references
│   ├── commons.js            # Core utilities & constants
│   ├── SIEG5E_FEATURES.md    # Sieg5e-specific feature documentation
│   └── FOUNDRY_RULER_SYNC.md # Ruler synchronization system docs
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

---

# Custom Functionality (Sieg5e Additions)

This section documents all Sieg5e-specific features beyond standard Foundry VTT / dnd5e. Each entry includes purpose, data flow, and references to core classes in `docs/foundry.js`.

## 1. Token Sorting & Z-Ordering

### Overview
Tokens are sorted by a **multi-criteria** z-order: higher elevation on top → smaller tokens (tiny creatures) on top of larger ones → player characters above NPCs → more recently moved on top.

### Data Flow
```
Canvas scene load / token update
    │
    ├─ dnd5e.mjs canvasReady hook ────────────────────────────┐
    │   PrimaryCanvasGroup._sortObjects = (a, b) =>           │  [Foundry: CanvasGroup]
    │     if both are TokenMesh → Token5e.sortTokens(a, b)    │
    │     else → originalSort.call(PrimaryCanvasGroup, a, b)  │
    │                                                         │
    ├─ canvas.tokens.objects.sortChildren = fn =>             │  [Foundry: Container]
    │   children.sort(Token5e.sortTokens(a, b))               │
    │   (overrides _sortObjectsByElevation set by core)       │
    └─────────────────────────────────────────────────────────┘

Token5e.sortTokens(tokenA, tokenB):
  1. elevDiff = tokenA.elevation - tokenB.elevation      → if ≠0: return elevDiff
  2. sizeA = w×h vs sizeB                                → if ≠0: return sizeB-sizeA (smaller on top)
  3. playerA (="character") vs playerB                   → if different: player first
  4. lastMoved.get(idA) - lastMoved.get(idB)             → more recent on top
```

### Key Files
| File | Role |
|------|------|
| `dnd5e.mjs` (canvasReady hook ~line 320-380) | Installs both `_sortObjects` and `sortChildren` overrides; triggers initial sort |
| `module/canvas/token.mjs` | `Token5e.lastMoved` static Map, `sortTokens()` comparison logic, `_onUpdate()` timestamp tracking |

### Foundry Core References
- **`PrimaryCanvasGroup._sortObjects`** — `[Foundry: CanvasGroup._sortObjects]` in `docs/foundry.js`. Called during every z-order recalculation.
- **`Container.sortChildren()`** — `[Foundry: Container.sortChildren]` in `docs/foundry.js`. Called when children need re-sorting (e.g., after elevation changes).

---

## 2. Ruler Elevation Support (3D Distance Measurement)

### Overview
Adds vertical movement tracking to Foundry's ruler tool: mouse wheel / arrow keys adjust per-segment elevation, 3D distances are computed using the scene's diagonal rule, and tokens receive elevation updates after movement.

### Data Flow
```
┌─ User measures on canvas ─────────────────────────────────────────────┐
│                                                                       │
│  Mouse Wheel Handler (canvasReady)                                    │
│    ↓                                                                  │
│  getActiveRuler() → ruler._state === 2 ? ruler : null                 │
│    ↓                                                                  │
│  adjustElevation(ruler, delta)                                        │
│    ├─ Ensure ruler.segmentElevations[] exists (pad to segment count)  |
│    ├─ segmentElevations[lastIndex] += delta                           │
│    ├─ ruler._computeDistance(true) → recalculates 3D distances        │
│    ├─ ruler.ruler.clear(); ruler._drawMeasuredPath()                  │
│    └─ game.user.broadcastActivity({ ruler: ruler.toJSON() })          │
│                                                                       │
│  Arrow Key Binding (registerElevationKeybindings)                     │
│    ↑/↓ → adjustElevation(ruler, ±1) [same flow as above]              │
│                                                                       │
│  Ruler._computeDistance patched in setupRulerElevation():             │
│    for each segment i:                                                │
│      ground = grid.measureDistances(segments)[i]                      │
│      elevationFeet = |segmentElevations[i]| × grid.distance           │
│      adjusted = compute3DDistance(ground, elevationFeet, rule)        │
│      segment.distance = adjusted                                      │
│      segment.cumDistance += adjusted                                  │
│      segment.cumDeltaElevation += elevation * gridDistance            │
│      segment.text = _getSegmentLabel(segment) → "25ft > 75ft | ↑20ft" |
│                                                                       │
│  Ruler.moveToken() patched:                                           │
│    cumulativeElev = sum(segmentElevations[])                          │
│    elevationDeltaFeet = cumulativeElev × gridDistance                 │
│    rounded = ceil(elevationDelta / 5) * 5                             │
│    await token.document.update({ elevation: +rounded })               │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘

Remote Sync Flow:
  Sender → broadcastActivity({ ruler: ruler.toJSON() })
    ↓ (Foundry socket relay)
  Receiver → UserActivity._handleUserActivity()                  [Foundry: UserActivity]
    └→ canvas.controls.updateRuler(user, data)                   [Foundry: InterfaceCanvasGroup]
        └→ Ruler.prototype.update(data)                          [Foundry: Ruler]
            ├─ segmentElevations = data.segmentElevations         (patched)
            └→ _computeDistance(true); clear(); _drawMeasuredPath()
```

### Key Files
| File | Role |
|------|------|
| `module/canvas/ruler-elevation.mjs` | All elevation logic: getActiveRuler, adjustElevation, compute3DDistance, setupRulerElevation, installRulerPatches, registerElevationKeybindings |
| `dnd5e.mjs` canvasReady hook (~line 390) | Calls `setupRulerElevation(gameCanvas, canvas)` |

### Foundry Core References
- **`Ruler.prototype.toJSON()`** — `[Foundry: Ruler.toJSON]` in `docs/foundry.js`. Patched to include `segmentElevations[]`.
- **`Ruler.prototype.update(data)`** — `[Foundry: Ruler.update]` in `docs/foundry.js`. Patched to restore elevations from serialized data before calling original.
- **`Ruler.prototype._getSegmentLabel(segment)`** — `[Foundry: Ruler._getSegmentLabel]` in `docs/foundry.js`. Replaced entirely for elevation-aware labels.
- **`Ruler.prototype.clear()`** — `[Foundry: Ruler.clear]` in `docs/foundry.js`. Patched to reset segmentElevations to [0].
- **`Ruler.prototype._removeWaypoint(point, options)`** — `[Foundry: Ruler._removeWaypoint]` in `docs/foundry.js`. Patched to pop corresponding elevation slot.
- **`Ruler.prototype.moveToken()`** — `[Foundry: Ruler.moveToken]` in `docs/foundry.js. Patched to apply cumulative elevation delta after movement completes.
- **`InterfaceCanvasGroup._sortObjectsByElevation`** — Set by core when elevation sorting is enabled; overridden via `canvas.tokens.objects.sortChildren`.

---

## 3. Fortitude Points System (Damage Absorption)

### Overview
High-CR NPCs can spend legendary resistances as an automatic damage buffer once their HP drops below a configurable percentage threshold.

### Data Flow
```
Actor5e.applyDamage(amount, multiplier):
  amount = floor(original_amount × resistance_multiplier)

  Layer 1 — Armor Mastery HP (system.attributes.hp.armor):
    newAHP = max(0, oldAHP - damage)          ← absorbs first
    deltaAHP = newAHP - oldAHP                ← negative value
    remaining -= (oldAHP - newAHP)

  Layer 2 — Temporary HP (system.attributes.hp.temp):
    newTHP = max(0, oldTHP - remaining)       ← absorbs second
    deltaTHP = newTHP - oldTHP                ← negative value
    remaining -= (oldTHP - newTHP)

  Layer 3 — Regular HP down to threshold:
    hpThreshold = ceil(hp.max × fortitudePointsThreshold% / 100)   [default: 50%]
    upperHP = clamp(oldHP - remaining, hpThreshold, max(0, hp.max + tempmax))
    deltaHP = upperHP - oldHP
    remaining -= (oldHP - upperHP)

  Layer 4 — Fortitude Points / Legendary Resistances:
    newFP = clamp(oldFP - remaining, 0, oldFP)      ← absorbs below threshold
    deltaFP = newFP - oldFP
    remaining -= (oldFP - newFP)

  Layer 5 — Remaining damage to HP:
    finalHP = clamp(upperHP - remaining, 0, max(0, hp.max + tempmax))

  Update: { "system.attributes.hp.armor": newAHP,
            "system.attributes.hp.temp": newTHP,
            "system.attributes.hp.value": finalHP,
            "system.resources.legres.value": newFP }
```

### Key Files
| File | Role |
|------|------|
| `module/documents/actor/actor.mjs` — `applyDamage()` (~line 920) | Multi-layer damage absorption with fortitude point trigger at configurable HP % threshold |
| `module/data/actor/npc.mjs` — NPCData schema | Defines `resources.legres.value/max` (Fortitude Points), `attributes.hp.armor/armormax` (Armor Mastery HP) |
| `module/settings.mjs` | Registers `fortitudePointsThreshold` setting (0-100%, default 50%) |

### Foundry Core References
- **`Actor.prototype.modifyTokenAttribute()`** — `[Foundry: Actor.modifyTokenAttribute]` in `docs/foundry.js`. Token HUD bar modification calls through to applyDamage for HP.
- **`Hooks.call("modifyTokenAttribute", ...)`** — `[Foundry: Hooks]` in `docs/foundry.js`. Dispatched before the final update; returning false prevents it.

---

## 4. Armor Mastery Hit Points (NPC Extra HP Pool)

### Overview
A separate hit point pool (`system.attributes.hp.armor`) for NPCs that absorbs damage before regular HP, representing defensive techniques and natural armor toughness.

### Data Flow
```
Actor5e.applyDamage():
  Layer 1 — Armor Mastery HP:
    newAHP = max(0, oldArmor - incoming_damage)
    remaining -= (oldArmor - newAHP)          ← only damage that actually hit armor

TokenDocument5e.getBarAttribute("attributes.hp"):
  data.value += hp.temp                        ← show temp HP in bar value
  data.max = max(0, original_max + hp.tempmax) ← adjust max for tempmax changes
```

### Key Files
| File | Role |
|------|------|
| `module/data/actor/npc.mjs` — NPCData schema | Defines `attributes.hp.armor/armormax` NumberFields |
| `module/documents/token.mjs` — TokenDocument5e.getBarAttribute() | Includes temp HP in displayed bar value and adjusts max by tempmax |

---

## 5. Group Actor Type

### Overview
A container Actor (`type: "group"`) that holds references to multiple actors as members, allowing GMs to manage squads/parties/factions as a single entity.

### Data Flow
```
GroupActor data model:
  description.full / summary        (HTML fields)
  members                           (SetField<ForeignDocumentField<BaseActor>>)
    → resolved in prepareBaseData() from _source.members ID strings to Actor5e instances
  attributes.movement.land/water/air (NumberFields for aggregated movement stats)

group.addMember(actor):
  validate: not a group, must be world actor, not already member
  update parent with members.concat([actor.id])

group.removeMember(actor|id):
  findSplice(id) on _source.members
  update parent with new array
```

### Key Files
| File | Role |
|------|------|
| `module/data/actor/group.mjs` | GroupActor data model: schema, member management, movement aggregation |
| `dnd5e.mjs` init hook | Registers `GroupActorSheet` as default sheet for "group" type actors |

---

## 6. Custom Data Fields (`module/data/fields.mjs`)

### AdvancementField
**Purpose:** Dynamically selects which BaseAdvancement subclass to instantiate based on the advancement's `type` string field, falling back to plain ObjectField cloning if no registered type is found.

**Why Needed:** Sieg5e registers custom advancement types (sieg5e-classes, sieg5e-subclasses, etc.) at runtime. This field resolves them by name without requiring all modules loaded at schema definition time.

### AdvancementDataField
**Purpose:** Given an advancement type's metadata, selects the correct DataModel for each sub-field (configuration or value) from `CONFIG.DND5E.advancementTypes[type].metadata.dataModels[name]`.

**Why Needed:** Enables type-safe schemas where sub-field models are determined by the parent advancement's registered metadata at runtime.

### FormulaField
**Purpose:** StringField subclass that validates values as Roll formulas. When `deterministic=true`, rejects any formula containing dice terms (e.g., "1d6+3" is invalid; "5" or "@mod + 2" are valid).

**Why Needed:** HP calculation, AC computation, and bonus aggregation must be deterministic — random dice would cause unpredictable stat values.

### MappingField
**Purpose:** ObjectField subclass with automatic key initialization from `initialKeys` array and recursive application of the contained DataField model to each value during clean/initialize.

**Why Needed:** Dynamic-key structures (abilities, skills, tool proficiencies) have keys determined at runtime. MappingField auto-creates all standard entries even though they're not in the static schema definition.

### Key Files
| File | Role |
|------|------|
| `module/data/fields.mjs` | All four custom field types: AdvancementField, AdvancementDataField, FormulaField, MappingField |

---

## 7. Ability Template Customization (`AbilityTemplate`)

### Overview
Extends Foundry's MeasuredTemplate to handle D&D 5e-specific area-of-effect targeting rules.

### Data Flow
```
AbilityTemplate.fromItem(item):
  templateShape = DND5E.areaTargetTypes[target.type].template   (circle/cone/rect/ray)
  switch templateShape:
    "cone" → angle = CONFIG.MeasuredTemplate.defaults.angle      (default: 53.13° / 60° for 5e RAW)
    "rect" → width=target.value; if gridAlignedSquareTemplates:
              distance=hypot(target.value, target.value), direction=45
            else: t="ray" (allow rotation without morphing shape)
    "ray"  → width = target.width ?? canvas.dimensions.distance   (default: 1 square / 5ft)
  return new MeasuredTemplate(templateData).wrapped in AbilityTemplate wrapper

AbilityTemplate.drawPreview():
  draw() → activate layer → add to preview → minimize actorSheet
  activatePreviewListeners(initialLayer):
    canvas.stage.on("mousemove", throttle(20ms) → snap to grid)
    canvas.stage.on("mousedown", confirm)
    app.view.oncontextmenu = cancel
    app.view.onwheel = rotate (5° normal, shift+5°=15°, ctrl+=30° for hex grids)
```

### Key Files
| File | Role |
|------|------|
| `module/canvas/ability-template.mjs` | AbilityTemplate class: fromItem factory, drawPreview, mouse/wheel event handlers |

---

## 8. Grid Measurement with Diagonal Rules (`measureDistances`)

### Overview
Overrides Foundry's default grid distance calculation to implement all three D&D 5e diagonal movement rules.

### Data Flow
```
canvas.grid.measureDistances(segments, {gridSpaces: true}):
  for each segment s:
    nx = ceil(|s.ray.dx| / d.size)     ← grid cells in X
    ny = ceil(|s.ray.dy| / d.size)     ← grid cells in Y
    nd = min(nx, ny)                   ← diagonal steps
    ns = |ny - nx|                     ← straight steps
    nDiagonal += nd                    ← cumulative for elevation tracking

  switch diagonalRule:
    "5105" → nd10 = floor(nd/2) - floor((nd-nd)/2)
            spaces = (nd10×2) + (nd-nd10) + ns              ← alternating double cost
    "EUCL" → hypot(nx, ny)                                    ← true geometric distance
    default ("555") → ns + nd                                 ← max(dx, dy) per step
  return spaces × canvas.scene.grid.distance                  ← convert to feet/meters
```

### Key Files
| File | Role |
|------|------|
| `module/canvas/grid.mjs` — measureDistances() | Per-segment distance calculation with diagonal rule support |

---

## 9. Consumable Resources Configuration

### Overview
Defines all valid target attributes that items can consume when used (HP, ability scores, currency, spell slots, etc.).

### Data Flow
```
dnd5e.mjs _configureConsumableAttributes():
  CONFIG.DND5E.consumableResources = [
    ...Object.keys(DND5E.abilities).map(a => `abilities.${a}.value`),
    "attributes.ac.flat",
    "attributes.hp.value",
    ...Object.keys(DND5E.senses).map(s => `attributes.senses.${s}`),
    ...Object.keys(DND5E.movementTypes).map(t => `attributes.movement.${t}`),
    ...Object.keys(DND5E.currencies).map(d => `currency.${d}`),
    "details.xp.value",
    "resources.primary/secondary/tertiary.value",
    "resources.legact/legres.value",
    "spells.pact.value",
    ...Array.fromRange(spellLevels.length-1, 1).map(l => `spells.spell${l}.value`)
  ]

TokenDocument5e.getConsumedAttributes(data):
  return CONFIG.DND5E.consumableResources   ← flat list of valid paths
```

### Key Files
| File | Role |
|------|------|
| `dnd5e.mjs` — `_configureConsumableAttributes()` | Builds the consumable resources array of valid item consumption targets |
| `module/documents/token.mjs` — TokenDocument5e.getConsumedAttributes() | Returns CONFIG.DND5E.consumableResources as valid item consumption targets |

---

## 10. Custom Roll Helpers (`d20Roll`, `damageRoll`)

### d20Roll Data Flow
```
d20Roll(config):
  formula = "1d20" + parts.join(" + ")
  advantageMode = DND5E.D20Roll.determineAdvantageMode({advantage, disadvantage, fastForward, event})
    → SHIFT/ALT/CTRL modifiers determine fast-forward mode

  roll = new CONFIG.Dice.D20Roll(formula, data, {
    flavor, advantageMode, defaultRollMode,
    critical=20, fumble=1, targetValue,
    elvenAccuracy, bladeMastery, tripleAdvantage, halflingLucky, reliableTalent
  })

  if !fastForward:
    roll.configureDialog({title, chooseModifier, defaultAction, defaultAbility})

  await roll.evaluate({async: true})
  await roll.toMessage(messageData)
```

### damageRoll Data Flow
```
damageRoll(config):
  formula = parts.join(" + ")
  {isCritical, isFF} = _determineCriticalMode({critical, fastForward, event})
    → ALT key → critical=true; SHIFT/CTRL/META → fast-forward

  roll = new CONFIG.Dice.DamageRoll(formula, data, {
    flavor, rollMode,
    critical: isFF ? isCritical : false,
    criticalBonusDice, criticalMultiplier, criticalBonusDamage,
    multiplyNumeric (from game.settings),
    powerfulCritical (from game.settings)
  })

  if !isFF:
    roll.configureDialog({title, defaultCritical, allowCritical})

  await roll.evaluate({async: true})
  await roll.toMessage(messageData)
```

### Key Files
| File | Role |
|------|------|
| `module/dice/dice.mjs` — d20Roll() | Centralized D&D 5e d20 rolls with advantage/disadvantage, racial traits, fast-forward |
| `module/dice/dice.mjs` — damageRoll() | Centralized damage rolls with configurable critical dice, numeric multiplier options |
| `module/dice/dice.mjs` — _determineCriticalMode() | ALT key → default critical on fast-forward; SHIFT/CTRL/META → pure fast-forward |

---

## 11. Trackable Attributes Configuration

### Overview
Defines per-actor-type which attributes appear on token resource bars and combat tracker.

### Data Flow
```
dnd5e.mjs _configureTrackableAttributes():
  common = { bar: [], value: [ability values, movement types, ac.value, init.total] }
  creature = {
    bar: [...common.bar, "hp", "spells.pact"],
    value: [...common.value, skill.passive, senses.*., spellsDc]
  }
  character = { bar: [...creature.bar, primary/secondary/tertiary/resources.xp] }
  npc       = { bar: [...creature.bar, legact, legres] }
  vehicle   = { bar: [...common.bar, "hp"] }

CONFIG.Actor.trackableAttributes = { character, npc, vehicle, group }[actorType]
```

### Key Files
| File | Role |
|------|------|
| `dnd5e.mjs` — `_configureTrackableAttributes()` | Builds per-type trackable attributes for token resource bars and combat tracker display |


## 12. Group Check

### Overview
Real-time group skill check system. GM initiates a skill check, players roll normally, first roll per actor is auto-captured, and the GM ends the check to post an averaged result to chat. No player-side UI changes.

### Data Flow
```
GM clicks canvas button → opens window → selects skill → Start Check
  ├─ Persist world setting: dnd5e.activeGroupCheck
  ├─ Socket emit: { operation: "start", checkId, skill, ability }
  ├─ Hooks.callAll("dnd5e.groupCheckStart", activeCheck)
  └─ Tally window opens (Waiting state)

Players receive socket → store activeCheck locally
Player rolls normally → dnd5e.rollSkill(actor, roll, skillId) fires
  ├─ Player → socket emit { operation: "result", actorId, actorName, total }
  └─ GM (NPC roll) → submitResult() directly

GM tally updates live. GM clicks End Check:
  ├─ average = Math.floor(sum / count)
  ├─ ChatMessage.create() with rendered result-card.hbs
  ├─ Clear world setting, socket emit "end"
  └─ activeCheck = null

Cancel: same flow, no chat card.
```

### Key Files
| File | Role |
|------|------|
| `module/canvas/group-check.mjs` | GroupCheckManager — start, submitResult, updateResult, end, cancel, socket handler, roll hook |
| `module/applications/group-check.mjs` | GroupCheckApplication — singleton tally window UI |
| `templates/group-check/application.hbs` | Tally window template (skill select, live table, waiting, End/Cancel) |
| `templates/group-check/result-card.hbs` | Chat card template (average headline, breakdown table, metadata) |
| `lang/en.json` | 13 `DND5E.GroupCheck*` localization keys |
| `module/settings.mjs` | Registers `activeGroupCheck` world setting |
| `module/canvas/_module.mjs` | Re-exports GroupCheckManager |
| `module/applications/_module.mjs` | Re-exports GroupCheckApplication |
| `dnd5e.mjs` | Wiring: imports, init hook (socket listener), ready hook (state restore), top-level hooks (canvas button, roll capture) |

### Key Behaviors
- **First-roll-only**: `submitResult()` checks `activeCheck.results[actorId]` — subsequent rolls for same actor are ignored
- **Ownership guard**: `actor.testUserPermission(game.user, "OWNER")` prevents submitting others' rolls
- **Zero-participant guard**: `end()` with 0 entries returns early with warning, no empty chat card
- **State recovery**: `ready` hook restores from world setting for ALL clients (before GM guard)
- **X button preserve**: Closing tally via X does NOT end the check — canvas button reopens it
- **Singleton window**: `GroupCheckApplication.#instance` prevents duplicate tally windows
- **Canvas button**: Pushed into existing `"token"` control group (avoids layer conflict)


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
The dnd5e project modifies some core Foundry functions for custom behavior.
See the **Custom Functionality** section above for full data flows and documentation.

| Function / Patch | File Location | Purpose | Foundry Reference |
|-----------------|---------------|---------|-------------------|
| `PrimaryCanvasGroup._sortObjects` | `dnd5e.mjs:canvasReady hook (~line 320)` | Multi-criteria token z-ordering (elevation → size → player/NPC → recently moved) via `Token5e.sortTokens()` |
| `Container.sortChildren()` on tokens.objects | `dnd5e.mjs:canvasReady hook (~line 360)` | Same-elevation siblings sorted by custom rules instead of generic `document.sort` field |
| `Ruler.prototype.toJSON()` | `ruler-elevation.mjs:installRulerPatches()` line ~84 | Include `segmentElevations[]` in serialized ruler data for remote sync |
| `Ruler.prototype.update(data)` | `ruler-elevation.mjs:installRulerPatches()` line ~103 | Restore segmentElevations from incoming data before calling original; re-render path |
| `Ruler.prototype._getSegmentLabel(segment)` | `ruler-elevation.mjs:installRulerPatches()` line ~128 | Custom label format: "distance > cumDistance | ↑/↓elevation" with units |
| `Ruler.prototype.clear()` | `ruler-elevation.mjs:installRulerPatches()` line ~150 | Reset segmentElevations to [0] on ruler cancelation |
| `Ruler.prototype._removeWaypoint(point, options)` | `ruler-elevation.mjs:installRulerPatches()` line ~162 | Pop corresponding elevation slot when waypoint removed |
| `Ruler.prototype.moveToken()` | `ruler-elevation.mjs:installRulerPatches()` line ~178 | Apply cumulative elevation delta (rounded to nearest 5ft) after movement completes |
| Mouse wheel handler on canvas.app.view | `ruler-elevation.mjs:installRulerPatches()` line ~209 | Scroll up = ascend, scroll down = descend; prevents page scrolling via passive:false |
| Arrow key bindings (↑/↓ + Numpad8/2) | `ruler-elevation.mjs:registerElevationKeybindings()` | PRIORITY precedence overrides core pan bindings during ruler measurement |
| `canvas.grid.measureDistances` | `grid.mjs` | Per-segment distance with PHB(5-5-5), DMG(5/10/5), Euclidean diagonal rules |

### Key Foundry Classes Referenced in Modifications
Refer to **`docs/foundry.js`** for the following core classes when modifying patched behavior:

| Class / Method | docs/foundry.js Reference | Used By |
|---------------|--------------------------|---------|
| `CanvasGroup._sortObjects(a, b)` | `[Foundry: CanvasGroup._sortObjects]` | Token z-ordering override |
| `Container.sortChildren()` | `[Foundry: Container.sortChildren]` | TokenLayer children re-sorting |
| `Ruler.toJSON()` | `[Foundry: Ruler.toJSON]` | Elevation serialization |
| `Ruler.update(data)` | `[Foundry: Ruler.update]` | Remote elevation sync |
| `Ruler._getSegmentLabel(segment)` | `[Foundry: Ruler._getSegmentLabel]` | Custom ruler labels |
| `Ruler.clear()` | `[Foundry: Ruler.clear]` | Elevation reset on cancel |
| `Ruler._removeWaypoint(point, options)` | `[Foundry: Ruler._removeWaypoint]` | Waypoint elevation cleanup |
| `Ruler.moveToken()` | `[Foundry: Ruler.moveToken]` | Token vertical position after movement |
| `InterfaceCanvasGroup._sortObjectsByElevation` | `[Foundry: InterfaceCanvasGroup._sortObjectsByElevation]` | Elevation-aware token sorting trigger |
| `UserActivity._handleUserActivity(data)` | `[Foundry: UserActivity._handleUserActivity]` | Remote ruler state propagation |
| `InterfaceCanvasGroup.updateRuler(user, data)` | `[Foundry: InterfaceCanvasGroup.updateRuler]` | Ruler update from remote client |
| `DetectionMode.getDetectionFilter()` | `[Foundry: DetectionMode.getDetectionFilter]` | Base dnd5e — blindsight visual filter (Sieg5e does not modify) |
| `DetectionMode._canDetect(visionSource, target)` | `[Foundry: DetectionMode._canDetect]` | Base dnd5e — unobstructed detection logic |
| `DetectionMode._testLOS(...)` | `[Foundry: DetectionMode._testLOS]` | Base dnd5e — total-cover-only check |
| `Actor.modifyTokenAttribute()` | `[Foundry: Actor.modifyTokenAttribute]` | Token HUD bar damage application |
| `Hooks.call("modifyTokenAttribute", ...)` | `[Foundry: Hooks]` | Pre-update hook dispatch for HP changes |

### Key Foundry Utilities Referenced
Refer to **`docs/commons.js`** for these utilities used throughout Sieg5e custom code:

| Utility | Used By |
|---------|--------|
| `Color.fromRGB()` / `.css` / `.mix()` | Token HP bar colors (getHPColor, _drawHPBar) |
| `foundry.utils.setProperty()` | Trackable attributes expansion in `_configureTrackableAttributes()` |
| `foundry.utils.mergeObject()` | Data merging in actor preparation, group member management |
| `foundry.utils.deepClone()` | Roll data isolation, group member removal |
| `Roll.safeEval()` / `validate()` | FormulaField validation for deterministic formulas |


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