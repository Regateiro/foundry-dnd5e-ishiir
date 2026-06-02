# Sieg5e — Complete Feature Reference

> **System**: Sieg5e (fork of `foundryvtt/dnd5e`) · **ID**: `dnd5e` · **Version**: 2.4.19
> **Foundry**: min 10.303, verified v11

---

## 1. Actor System

| Feature | Description | Entrypoint |
|---------|-------------|------------|
| **Character actor** | Player character with HP, AC, abilities, skills, XP, death saves, exhaustion, inspiration, resources, personality traits | `module/data/actor/character.mjs` · sheet: `module/applications/actor/character-sheet.mjs` |
| **NPC actor** | Non-player creature with CR, type/subtype, legendary actions/resistances, spellcasting level, environment | `module/data/actor/npc.mjs` · sheet: `module/applications/actor/npc-sheet.mjs` |
| **Vehicle actor** | Air/land/space/water vehicles with crew stations, passengers, cargo capacity, damage/mishap thresholds | `module/data/actor/vehicle.mjs` · sheet: `module/applications/actor/vehicle-sheet.mjs` |
| **Group actor** (custom) | Container actor holding multiple actor references for squads/parties; aggregated movement; addMember/removeMember validation | `module/data/actor/group.mjs` · sheet: `module/applications/actor/group-sheet.mjs` |
| **Actor document class** | `prepareData()` lifecycle, `getRollData()`, `getInitiativeRoll()`, `modifyTokenAttribute()`, polymorph, rest recovery, currency conversion, multi-layer `applyDamage()` with Armor Mastery + Fortitude Points | `module/documents/actor/actor.mjs` |
| **Proficiency** | Proficiency calculation with multiplier (0/0.5/1/2) and rounding | `module/documents/actor/proficiency.mjs` |
| **Trait utilities** | Trait value resolution, formatting, and comparison helpers | `module/documents/actor/trait.mjs` |
| **Select choices** | Structured choice data for advancement select menus | `module/documents/actor/select-choices.mjs` |

### Data Templates (mixed into actor types)

| Template | Fields | File |
|----------|--------|------|
| **CommonTemplate** | abilities, currency | `module/data/actor/templates/common.mjs` |
| **CreatureTemplate** | bonuses (mwak/rwak/msak/rsak/abil/spell), skills, tools, spells | `module/data/actor/templates/creature.mjs` |
| **AttributesFields.common** | initiative, movement (burrow/climb/fly/swim/walk/units/hover) | `module/data/actor/templates/attributes.mjs` |
| **AttributesFields.creature** | attunement max, senses (darkvision/blindsight/tremorsense/truesight), spellcasting DC | `module/data/actor/templates/attributes.mjs` |
| **TraitsFields.common** | size, damage immunities/resistances/vulnerabilities, condition immunities | `module/data/actor/templates/traits.mjs` |
| **TraitsFields.creature** | languages | `module/data/actor/templates/traits.mjs` |
| **DetailsFields.common** | biography (value + public) | `module/data/actor/templates/details.mjs` |
| **DetailsFields.creature** | alignment, race | `module/data/actor/templates/details.mjs` |
| **CurrencyTemplate** | pp, gp, ep, sp, cp | `module/data/shared/currency.mjs` |

---

## 2. Item System

| Feature | Description | Entrypoint |
|---------|-------------|------------|
| **Weapon item** | Simple/martial/natural/improvised/siege; 18+3 properties (ada/mgc/sil); damage parts, attack bonus, proficient | `module/data/item/weapon.mjs` |
| **Equipment item** | Light/medium/heavy/natural/shield armor; AC value/bonus/dex cap; strength req; stealth penalty | `module/data/item/equipment.mjs` |
| **Consumable item** | Ammo/potion/poison/food/scroll/wand/rod/trinket; auto-destroy on use | `module/data/item/consumable.mjs` |
| **Tool item** | Art/game/music tools; ability bonus, proficiency | `module/data/item/tool.mjs` |
| **Loot item** | Art/gem/junk/material/resource/treasure/gear; no activation mechanics | `module/data/item/loot.mjs` |
| **Race item** | Movement, senses, creature type, advancement array; singleton per actor | `module/data/item/race.mjs` |
| **Background item** | Advancement array; auto-sets actor background reference on create | `module/data/item/background.mjs` |
| **Class item** | Hit dice, levels, spellcasting progression/ability, advancement array | `module/data/item/class.mjs` |
| **Subclass item** | Class identifier link, advancement array, spellcasting | `module/data/item/subclass.mjs` |
| **Spell item** | Level (0-9), school, V/S/M components, preparation mode, scaling, damage/save | `module/data/item/spell.mjs` |
| **Feat item** | Background/class/monster/race/feat types; recharge, requirements | `module/data/item/feat.mjs` |
| **Container (backpack)** | Capacity type/value/weightless; internal currency tracking | `module/data/item/container.mjs` |
| **Item document class** | `roll()`, `rollDamage()`, `use()` with consumption, chat card rendering, macro support | `module/documents/item.mjs` |

### Item Data Templates

| Template | Fields | File |
|----------|--------|------|
| **ItemDescriptionTemplate** | description.value/chat/unidentified, source | `module/data/item/templates/item-description.mjs` |
| **PhysicalItemTemplate** | quantity, weight, price, attunement, rarity, equipped, identified, `masterworked` (custom) | `module/data/item/templates/physical-item.mjs` |
| **ActivatedEffectTemplate** | activation (type/cost/condition), duration, target, range, uses, consume | `module/data/item/templates/activated-effect.mjs` |
| **ActionTemplate** | ability, attack bonus, damage parts, save DC, formula | `module/data/item/templates/action.mjs` |
| **EquippableItemTemplate** | equipped, proficient | `module/data/item/templates/equippable-item.mjs` |
| **MountableTemplate** | armor value, HP, damage threshold, conditions | `module/data/item/templates/mountable.mjs` |

---

## 3. Dice & Rolling

| Feature | Description | Entrypoint |
|---------|-------------|------------|
| **D20Roll** | Extends Roll for d20-based checks/saves/attacks; advantage/disadvantage modes; elven accuracy, halfling luck, reliable talent; critical/fumble detection; configure dialog | `module/dice/d20-roll.mjs` |
| **DamageRoll** | Extends Roll for damage/healing; critical bonuses, multiply-numeric, powerful critical; configure dialog | `module/dice/damage-roll.mjs` |
| **d20Roll helper** | Centralized d20 rolling: parts, data, event modifiers (SHIFT=normal, ALT=adv, CTRL=dis), fast-forward, advantage, elven accuracy, etc. | `module/dice/dice.mjs` |
| **damageRoll helper** | Centralized damage rolling: critical mode detection (ALT key), bonus dice, multiplier options | `module/dice/dice.mjs` |
| **Simplify formula** | Removes @ references and simplifies bonus expressions | `module/dice/simplify-roll-formula.mjs` |

---

## 4. Combat

| Feature | Description | Entrypoint |
|---------|-------------|------------|
| **Initiative rolling** | Delegates to Actor5e.getInitiativeRoll() using D20Roll with advantage support | `module/documents/combat.mjs` |
| **Combat tracker** | Custom tracker showing per-type trackable attributes; 6-second rounds | `module/applications/combat/combat-tracker.mjs` |
| **Group Check** (custom) | GM-initiated skill check; auto-captures first roll per actor; live tally; averaged result posted to chat; socket-synced; state recovery on reload | `module/canvas/group-check.mjs` · `module/applications/group-check.mjs` |

---

## 5. Canvas

| Feature | Description | Entrypoint |
|---------|-------------|------------|
| **Token sorting / z-order** (custom) | Multi-criteria draw order: elevation → size (smaller on top) → player>NPC → recently moved. Overrides `PrimaryCanvasGroup._sortObjects` and `Container.sortChildren` | `module/canvas/token.mjs` · installed in `dnd5e.mjs` canvasReady hook |
| **Multi-layer HP bar** (custom) | Renders base HP + temp + tempmax + armor HP segments in distinct colors | `module/canvas/token.mjs` |
| **Ruler elevation** (custom) | Mouse wheel / arrow keys adjust per-segment elevation; 3D distance via 555/5105/EUCL rules; token elevation applied on movement end; synced to other clients via broadcastActivity | `module/canvas/ruler-elevation.mjs` |
| **Grid measurement** (custom) | `measureDistances` override: PHB (max(x,y)), DMG (alternating double diagonal), Euclidean (hypot) | `module/canvas/grid.mjs` |
| **Ability template** | AoE targeting: cones, circles, cubes, rays; grid-snapping; mouse wheel rotation; live preview | `module/canvas/ability-template.mjs` |
| **Detection modes** | Blindsight detection mode | `module/canvas/detection-modes/_module.mjs` |

---

## 6. Data Fields

| Feature | Description | Entrypoint |
|---------|-------------|------------|
| **AdvancementField** (custom) | Dynamically selects BaseAdvancement subclass by type string; falls back to ObjectField | `module/data/fields.mjs` |
| **AdvancementDataField** (custom) | Selects sub-DataModel from advancement type metadata for config/value | `module/data/fields.mjs` |
| **FormulaField** (custom) | StringField validated as Roll formula; `deterministic` option rejects dice | `module/data/fields.mjs` |
| **IdentifierField** (custom) | Alphanumeric + underscore + dash validation | `module/data/fields.mjs` |
| **LocalDocumentField** (custom) | References embedded documents; `fallback` option for missing links | `module/data/fields.mjs` |
| **MappingField** (custom) | ObjectField with auto-key init from `initialKeys`; recursive DataField application | `module/data/fields.mjs` |
| **MovementField** | Structured movement: burrow/climb/fly/swim/walk/units/hover | `module/data/shared/movement-field.mjs` |
| **SensesField** | Structured senses: darkvision/blindsight/tremorsense/truesight/units/special | `module/data/shared/senses-field.mjs` |
| **CreatureTypeField** | value/subtype/swarm/custom with computed label | `module/data/shared/creature-type-field.mjs` |
| **SourceField** | book/page/custom/license with computed label | `module/data/shared/source-field.mjs` |

---

## 7. Advancement

| Feature | Description | Entrypoint |
|---------|-------------|------------|
| **Ability Score Improvement** | Points/fixed/cap configuration; feat option during ASI | `module/data/advancement/ability-score-improvement.mjs` |
| **Hit Points** | Per-level HP gain with fixed or rolled options | `module/data/advancement/hit-points.mjs` |
| **Item Choice** | Choose items from a grant pool (e.g., equipment packs) | `module/data/advancement/item-choice.mjs` |
| **Item Grant** | Auto-grant items at a level (e.g., class features) | `module/data/advancement/item-grant.mjs` |
| **Scale Value** | Numeric/string/dice/distance/notes scaling by level | `module/data/advancement/scale-value.mjs` |
| **Size** | Creature size change at a level | `module/data/advancement/size.mjs` |
| **Trait** | Grant/choose proficiencies, languages, senses, defenses | `module/data/advancement/trait.mjs` |
| **Advancement Manager** | Full workflow: config, flow, selection, migration dialogs | `module/data/advancement/advancement-manager.mjs` |

---

## 8. UI Applications

| Feature | Description | Entrypoint |
|---------|-------------|------------|
| **Character sheet** | Full player sheet: inventory, spellbook, features, bio, resources, warnings | `module/applications/actor/character-sheet.mjs` |
| **NPC sheet** | NPC sheet with type config, CR, legendary actions/resistances | `module/applications/actor/npc-sheet.mjs` |
| **Vehicle sheet** | Vehicle sheet with crew, cargo, stations, damage threshold | `module/applications/actor/vehicle-sheet.mjs` |
| **Group sheet** (custom) | Group actor sheet with member list and management | `module/applications/actor/group-sheet.mjs` |
| **Ability config** | Per-ability save/skill configuration dialog | `module/applications/actor/ability-config.mjs` |
| **Armor config** | AC calculation mode and formula config | `module/applications/actor/armor-config.mjs` |
| **Hit dice config** | Hit dice spending and recovery | `module/applications/actor/hit-dice-config.mjs` |
| **Hit points config** | HP max override and formula config | `module/applications/actor/hit-points-config.mjs` |
| **Initiative config** | Initiative bonus and formula config | `module/applications/actor/initiative-config.mjs` |
| **Movement config** | Movement speed configuration | `module/applications/actor/movement-config.mjs` |
| **Senses config** | Sense configuration | `module/applications/actor/senses-config.mjs` |
| **Type config** | Creature type/alignment/size config | `module/applications/actor/type-config.mjs` |
| **Sheet flags** | Character flag toggles (elven accuracy, halfling luck, etc.) | `module/applications/actor/sheet-flags.mjs` |
| **Proficiency config** | Proficiency multiplier configuration | `module/applications/actor/proficiency-config.mjs` |
| **Trait selector** | Multi-select dialog for traits (languages, damage types, etc.) | `module/applications/actor/trait-selector.mjs` |
| **Tool selector** | Multi-select dialog for tool proficiencies | `module/applications/actor/tool-selector.mjs` |
| **Short rest dialog** | Hit dice spending, features recovery, armor mastery recovery toggle (custom) | `module/applications/actor/short-rest.mjs` |
| **Long rest dialog** | Full HP recovery, hit dice recovery, feature recovery | `module/applications/actor/long-rest.mjs` |
| **Item sheet** | Unified item sheet for all 12 item types | `module/applications/item/item-sheet.mjs` |
| **Ability use dialog** | Configure ability use: activation type, resource consumption, damage roll options | `module/applications/item/ability-use-dialog.mjs` |
| **Group check tally** (custom) | Live group check tally window (singleton) | `module/applications/group-check.mjs` |
| **Class journal page** | Class summary journal page with subclass list | `module/applications/journal/class-sheet.mjs` |
| **Journal editor** | Custom journal editor | `module/applications/journal/journal-editor.mjs` |
| **SRD compendium** | Styled SRD rules compendium | `module/applications/journal/srd-compendium.mjs` |
| **Property attribution** | Shows source of derived property values | `module/applications/property-attribution.mjs` |
| **Source config** | Source metadata configuration | `module/applications/source-config.mjs` |

---

## 9. Configuration Constants

| Feature | Description | Entrypoint |
|---------|-------------|------------|
| **Abilities** | str/dex/con/int/wis/cha + optional honor/sanity with labels, types, fullKey | `module/config.mjs` |
| **Skills** | 18 skills with ability associations and labels | `module/config.mjs` |
| **Sizes** | tiny through colossal with token dimensions | `module/config.mjs` |
| **Creature types** | 12 types (aberration through undead) | `module/config.mjs` |
| **Conditions** | 16 conditions (blinded through unconscious) | `module/config.mjs` |
| **Damage types** | 13 types (bludgeoning through thunder) | `module/config.mjs` |
| **Movement types** | burrow/climb/fly/swim/walk with unit options | `module/config.mjs` |
| **Spell slots** | Full caster progression table (20 levels × 9 levels) | `module/config.mjs` |
| **Spell schools** | 8 schools with labels and abbreviations | `module/config.mjs` |
| **Weapon config** | 5 types, 21 properties (18 base + 3 custom: ada/mgc/sil) | `module/config.mjs` |
| **Armor config** | 5 types, 7 AC calculation modes | `module/config.mjs` |
| **Activation types** | 12 types (action through crew) | `module/config.mjs` |
| **Feat types** | 5 categories, 16 class feat subtypes | `module/config.mjs` |
| **Character flags** | 19 boolean flags (elven accuracy, halfling luck, etc.) | `module/config.mjs` |
| **Trait configs** | 12 configured (saves, skills, languages, profs, immunities, etc.) | `module/config.mjs` |
| **Languages** | 30+ standard + exotic + special | `module/config.mjs` |
| **Encumbrance** | Imperial/metric weight multipliers | `module/config.mjs` |
| **Polymorph settings** | Keep/merge flags for physical, mental, class, items, etc. | `module/config.mjs` |

---

## 10. System Settings

| Setting | Description | Entrypoint |
|---------|-------------|------------|
| `diagonalMovement` | Diagonal rule: 555 (PHB), 5105 (DMG), EUCL | `module/settings.mjs` |
| `gridAlignedSquareTemplates` | Rotate square templates to align with grid | `module/settings.mjs` |
| `restVariant` | Rest rules: normal, gritty, epic | `module/settings.mjs` |
| `proficiencyModifier` | Proficiency style: bonus or dice | `module/settings.mjs` |
| `allowFeats` | Allow feats during ASI advancement | `module/settings.mjs` |
| `fortitudePointsThreshold` (custom) | HP% threshold (0-100) for Fortitude Point damage absorption | `module/settings.mjs` |
| `honorScore` / `sanityScore` | Enable optional ability scores | `module/settings.mjs` |
| `initiativeDexTiebreaker` | Dexterity tiebreaker for initiative | `module/settings.mjs` |
| `currencyWeight` | Track coin weight for encumbrance | `module/settings.mjs` |
| `metricWeightUnits` | Use metric weight units | `module/settings.mjs` |
| `criticalDamageModifiers` | Multiply numeric terms on critical hits | `module/settings.mjs` |
| `criticalDamageMaxDice` | Maximize damage dice on critical hits | `module/settings.mjs` |
| `disableExperienceTracking` | Disable XP tracking | `module/settings.mjs` |
| `disableAdvancements` | Disable advancement system | `module/settings.mjs` |
| `allowPolymorphing` | Allow polymorphing actors | `module/settings.mjs` |
| `autoCollapseItemCards` | Auto-collapse item chat cards | `module/settings.mjs` |
| `moduleArtConfiguration` | Art module configuration menu | `module/settings.mjs` |

---

## 11. Compendium Packs

| Pack | Type | Description |
|------|------|-------------|
| `heroes` | Actor | Starter pre-generated heroes |
| `monsters` | Actor | SRD monster stat blocks |
| `items` | Item | SRD equipment, weapons, armor, adventuring gear |
| `tradegoods` | Item | Trade goods and services |
| `spells` | Item | SRD spells (all levels) |
| `backgrounds` | Item | SRD backgrounds |
| `classes` | Item | SRD classes |
| `subclasses` | Item | SRD subclasses |
| `classfeatures` | Item | SRD class features |
| `races` | Item | SRD races |
| `monsterfeatures` | Item | SRD monster features |
| `rules` | JournalEntry | SRD rules reference |
| `tables` | RollTable | SRD random tables |
| `sieg5e-classes` (custom) | Item | Sieg5e custom classes (Ishiir) |
| `sieg5e-subclasses` (custom) | Item | Sieg5e custom subclasses |
| `sieg5e-classfeatures` (custom) | Item | Sieg5e custom class features |
| `sieg5e-optfeatures` (custom) | Item | Sieg5e optional features, feats, infusions |
| `sieg5e-races` (custom) | Item | Sieg5e custom races |

Packs defined in `system.json`.

---

## 12. Other Systems

| Feature | Description | Entrypoint |
|---------|-------------|------------|
| **Chat enhancements** | Crit/fumble/success/failure CSS classes; context menu actions on chat cards | `module/documents/chat-message.mjs` |
| **Macro support** | Create macros from Item/ActiveEffect drops; `rollItem()`/`toggleEffect()` commands; hotbar integration | `module/documents/macro.mjs` |
| **Text enrichers** | `[[/check]]`, `[[/damage]]`, `[[/save]]`, `[[/skill]]`, `[[/tool]]` inline roll buttons in rich text | `module/enrichers.mjs` |
| **Module art** | UUID-to-art mapping; suppress art flag; settings menu | `module/module-art.mjs` |
| **Data migration** | Versioned pipeline: `migrateWorld()`, `migrateActorData()`, `migrateItemData()`, `migrateMacroData()`, `migrateSceneData()`, compendium migration | `module/migration.mjs` |
| **Utility functions** | `simplifyBonus()`, UUID resolution, Handlebars helpers, template preloading, config pre-localization, grouped select options | `module/utils.mjs` |
| **Hot reload** | Dev-mode auto-refresh for CSS, HBS, JSON changes | `system.json` flags |

---

## 13. Custom Fields Summary

| Field | Type | Purpose |
|-------|------|---------|
| **AdvancementField** | Dynamic subclass resolution | Selects BaseAdvancement by type string at runtime |
| **AdvancementDataField** | Sub-field model resolution | Selects DataModel for config/value from advancement metadata |
| **FormulaField** | Validated formula string | Roll formula validation; deterministic mode rejects dice |
| **IdentifierField** | Pattern-validated string | Alphanumeric + underscore + dash only |
| **LocalDocumentField** | Embedded doc reference | References sub-documents with optional fallback display |
| **MappingField** | Auto-key object | Object with auto-initialized keys from initialKeys array |

All defined in `module/data/fields.mjs`.

---

## Legend

- **(custom)** = Sieg5e-specific addition not present in upstream `foundryvtt/dnd5e`
- All other features are inherited/adapted from the upstream dnd5e system (v2.4.x)
