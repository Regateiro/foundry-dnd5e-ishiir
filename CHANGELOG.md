# Changelog

All notable changes to the Sieg5e system (forked from Foundry VTT D&D5e) are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [2.4.27] - 2026-06-26

### Added
- Group check actor removal: GM can now remove individual actors from the active group check tally
- Dedicated `less/group-check.less` stylesheet for group check UI (compiled into `dnd5e.css`)
- Localization string for the new "Remove" action on group check entries

### Changed
- Group check result card and application template styling improvements
- Simplified `test_todo_28` and `test_todo_29` by replacing duplicated local `clamped()` functions with Foundry's built-in `Math.clamped()`

### Fixed
- Resolved Rollup circular dependency warnings across 6 import chains
  - Group-check: replaced direct `GroupCheckApplication` import from `canvas/group-check.mjs` with Hook-based communication, breaking the `canvas ↔ applications` cycle
  - Tests: extracted shared utilities (`assert`, `assertApprox`, `collectFailures`, `formatFailures`) into `tests/shared.mjs` to eliminate test → test circular imports
- Fixed `inlineDynamicImports` Rollup deprecation warning by using `output.inlineDynamicImports`
- Fixed `clamped is not defined` runtime error in `test_todo_28` — the local `function clamped` was block-scoped inside a `for` loop and inaccessible outside it

## [2.4.26] - 2026-06-22

### Added
- Actor-wide critical threshold and critical damage bonus configuration per attack type (melee weapon, ranged weapon, melee spell, ranged spell) via the flags/bonuses sheet
  - Item critical threshold now subtracts actor-level bonus (floor 1)
  - Item critical damage combines actor-level + item-level bonuses
- Feature type label column (Background, Class, Monster, Race) on character sheet active/passive feature lists

### Changed
- Simplified feature type localizations (removed "Feature" suffix: "Class Feature" → "Class")
- Rewrote bug-fix test suite: simplified source-inspection tests, removed redundant cases

### Fixed
- Resolved 50 lint warnings across `module/documents/actor/actor.mjs`, `tests/bug-fixes.mjs`, and `tests/ruler/tests.mjs`
  - Fixed JSDoc `@param` name mismatches (underscore-prefixed params)
  - Added missing `@returns` declarations on test functions
  - Fixed `catch` keyword spacing to match project style
  - Fixed line length, unnecessary escapes, self-compare, and comment capitalization issues

## [2.4.25] - 2026-06-10

### Fixed
- Clamp CR exponent lookup to max index 30 so NPCs with CR higher than 30 don't crash due to the lack of XP value.

## [2.4.24] - 2026-06-09

### Fixed
- Remove default 1-round duration on newly created temporary effects
- Ensure masterworked icon appears on NPC sheets for items that have it

## [2.4.23] - 2026-06-08

### Added
- Custom ability check formulas

## [2.4.22] - 2026-06-08

### Changed
- Compendium pack updates

## [2.4.21] - 2026-06-07

### Fixed
- Fix ID collision on class features
- Error message for formula simplification
- Tag fixes

## [2.4.20] - 2026-06-03

### Fixed
- Token HP delta display not working
- Various general bug fixes

## [2.4.19] - 2026-06-01

### Added
- Group Check system — real-time group skill check mechanism (GM initiates, players roll, averaged result posted to chat)
- Group Check canvas button

### Changed
- Tests and pack updates after moving `getGridDistance`

## [2.4.18] - 2026-05-26

### Fixed
- Elevation going crazy on ruler movement
- Relative container order on token movement
- Hex grid distance measurement
- 5-10-5 diagonal calculation (truncate and pad elevation array, fallback distance units)
- Prevent double-sorting of tokens

### Changed
- Use string references for `fortitudePointsThreshold` setting
- Cleanup files after pack regeneration
- Remove inline styling from sheets
- Warn if actor doesn't have HP set

## [2.4.17] - 2026-05-24

### Added
- Recharge abilities on a short rest as well (previously only long rest)

### Changed
- Compendium pack updates
- Documentation and formatting cleanup

## [2.4.16] - 2026-05-17

### Added
- Armor Mastery HP (AHP) display in token bar
- Armor mastery fields to default NPC sheet
- Ruler tests (run for TestRunner role only)

### Changed
- Token layering function improvements
- Tests overhaul and updates
- Linting pass

## [2.4.15] - 2026-05-11

### Fixed
- Guard against repatching ruler methods
- Reference fixes

## [2.4.14] - 2026-05-09

### Fixed
- Force 5-5-5 measuring distance for hex grids

## [2.4.13] - 2026-05-09

### Added
- Authentication to curl requests for pack regeneration

### Fixed
- Grid distance units being assumed as feet instead of using scene setting

## [2.4.12] - 2026-05-04

### Added
- Ruler elevation support (3D distance measurement)
  - Mouse wheel scroll to adjust per-segment elevation
  - Arrow key bindings (↑/↓, Numpad8/2) for elevation adjustment
  - Elevation-aware segment labels: "25ft › 75ft | ↑20ft"
  - 3D distance computation using scene diagonal rule
  - Token elevation update after movement (rounded to nearest 5ft)
  - Remote sync of elevation state between clients
  - Custom `_getSegmentLabel` replacement
  - `clear()` resets segment elevations
  - `_removeWaypoint()` pops corresponding elevation slot

### Fixed
- Elevation values being set to 0 incorrectly

## [2.4.11] - 2026-05-02

### Added
- Token sorting by multi-criteria z-order (elevation → size → player/NPC → recently moved)
  - `PrimaryCanvasGroup._sortObjects` override
  - `Container.sortChildren` override on `tokens.objects`
  - `Token5e.lastMoved` static Map for tracking move timestamps

### Changed
- AGENTS.md and documentation updates
- Script updates for pack generation

## [2.4.10] - 2026-04-26

### Changed
- Compendium updates for Sieg5e content
- Feature changes and additions
- Base files and scripts updated

## [2.4.9] - 2026-04-25

### Added
- Sieg5e features and data — Ishiir/Arkaeos compendium content
- New Sieg5e classes, subclasses, class features, optional features, and races

### Changed
- Feature updates for Sieg5e content
- Masterworked icon visibility improvements

## [2.4.8] - 2026-04-22

### Changed
- Wildshape behavior and option label adjustments

## [2.4.7] - 2026-04-21

### Changed
- Polymorphing behavior adjustments

## [2.4.6] - 2026-04-19

### Added
- Armor mastery recovery message on rests

### Fixed
- Download link in system.json

## [2.4.5] - 2026-04-12

### Added
- Icon to set masterworked on the character sheet

## [2.4.4] - 2026-04-12

### Added
- **Fortitude Points system** — High-CR NPCs can spend legendary resistances as damage buffer below configurable HP threshold (default 50%)
  - Multi-layer damage absorption: Armor Mastery HP → Temp HP → HP (down to threshold) → Fortitude Points → remaining HP
  - Configurable threshold via system setting (0-100%)
- **Armor Mastery HP** — Separate NPC hit point pool (`attributes.hp.armor/armormax`)
  - Absorbs damage before regular HP
  - Integrated into `Actor5e.applyDamage()` layer 1
- **Colossal size** support
- **Blade mastery** and **triple advantage** options
- **Masterworked** property for items
- Missing weapons added
- Tests for damage application and armor mastery

### Changed
- Refactored `applyDamage()` to be more extensible with modular damage layers
- Damage scrolling text maxes at target HP
- Delta parts set in common object instead of individual params

### Fixed
- Build process

## [2.4.3-1] - 2026-03-29

### Fixed
- Character creature type fallback: grab from race if exists, default to Humanoid

## [2.4.3] - 2026-03-29

### Fixed
- Missing character details display

## [2.4.2] - 2026-03-28

### Added
- System rename to **Sieg5e**
- Conditions and languages configuration
- Missing tools added to config
- Save bonus selection ability
- Mixed rest option for resource recovery
- Make target for dev deployment
- AGENTS.md documentation

### Changed
- Sheet width adjustments to ensure content fits

## Pre-release (Initial Sieg5e fork) - 2026-03-27

Forked from the official Foundry VTT D&D5e system (upstream commit `69080227`).

Initial changes from upstream:
- Added AGENTS.md guide with project structure and documentation
- Added mixed rest option for resource recovery
- Added conditions and languages configuration
- Added missing tools
- Added ability to select a save bonus
- Renamed system to Sieg5e

---

The Sieg5e fork builds upon the Foundry VTT D&D5e system by [Foundry VTT](https://foundryvtt.com) (used under license). See `system.json` for full version compatibility details.
