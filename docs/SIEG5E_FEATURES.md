# Sieg5e Custom Features Documentation

## Overview
This document describes all custom features added to the dnd5e system in the Sieg5e fork.

---

## 1. Token Sorting

**File:** `module/canvas/token.mjs`  
**Hook:** `dnd5e.mjs:332` (canvasReady)

### Description
Custom token sorting that controls z-index rendering order on the canvas.

### Sorting Priority (top to bottom)
1. Smaller tokens (smaller size renders on top)
2. Player tokens (render on top of NPC tokens)
3. Recently moved tokens (more recently moved render on top)

### Implementation
- `Token5e.lastMoved` - Static Map storing timestamp of last movement per token
- `Token5e.sortTokens(a, b)` - Static method implementing the sort logic
- `PrimaryCanvasGroup._sortObjects` - Overridden in canvasReady to intercept sorting

### Code Location
```javascript
// dnd5e.mjs line 332
Hooks.on("canvasReady", () => {
  PrimaryCanvasGroup._sortObjects = (a, b) => {
    if (both are tokens) return Token5e.sortTokens(a.document.object, b.document.object);
    return originalSort(a, b);
  };
});
```

---

## 2. Ruler Elevation

**File:** `module/canvas/ruler-elevation.mjs`  
**Hook:** `dnd5e.mjs:379` (canvasReady)

### Description
Adds vertical elevation support to the Foundry VTT Ruler measurement tool, allowing users to measure 3D distances including altitude changes.

### Features
- Mouse wheel scroll to adjust vertical elevation per segment
- Displays cumulative elevation in ruler labels (e.g., "25.0ft | ↑15.0ft")
- After movement (SPACEBAR), token elevation updates (rounded up to nearest 5ft)
- Ctrl+Click to add waypoints, Right-click to remove waypoints
- **Elevation syncs to other connected clients** - when you adjust elevation, other players see the adjusted distance on their screen

### Diagonal Rules
- **555 (PHB)**: `max(groundDistance, elevationDistance)`
- **5105 (DMG)**: `groundDistance + (elevationDistance * 0.5)`
- **EUCL**: `sqrt(groundDistance² + elevationDistance²)`

### Key Functions

#### `setupRulerElevation(gameCanvas, canvasModule)`
Called from `canvasReady` hook in `dnd5e.mjs`. Sets up:
1. Applies dnd5e measureDistances function to grid
2. Sets diagonal movement rule from settings
3. Overrides measureDistances to add elevation
4. Installs Ruler patches

#### `measureDistancesWithElevation(groundSegments)`
Adds elevation to distance calculations based on diagonal rule:
- **EUCL**: `sqrt(ground² + elevation²)` (Pythagorean theorem)
- **5105**: `ground + (elevation / 10) * 5` (each 10ft adds 5ft)
- **555**: `max(ground, elevation)` (distance is the greater)

#### `installRulerPatches(Ruler, gameCanvas)`
Patches Ruler prototype methods:
- `_getSegmentLabel`: Shows cumulative elevation in labels
- `clear`: Resets elevation array when ruler deactivated
- `setWaypoints`: Adds elevation slot for new waypoints
- `_removeWaypoint`: Removes elevation slot when waypoint removed
- `moveToken`: Applies elevation to token after movement
- Wheel event handler: Adjusts elevation with mouse scroll

### Usage
1. Hold left-click and drag to measure distance
2. Scroll mouse wheel to adjust vertical elevation
3. Label shows cumulative elevation (e.g., "25.0ft | ↑15.0ft")
4. Press SPACEBAR to move - token elevation updates (rounded to nearest 5ft)
5. Ctrl+Click to add waypoints
6. Right-click to remove last waypoint
7. **Multiplayer**: Elevation changes are automatically synced to other connected clients via broadcastActivity

### Settings
The diagonal movement rule (555, 5105, EUCL) affects how elevation is calculated. This is controlled by the "diagonalMovement" setting in `module/settings.mjs`.

### Edge Cases Handled
- No segments: Guard in moveToken prevents errors
- Segment count mismatch: Safety padding for rapid clicking
- State access: Get token before movement (state valid), apply elevation after

---

## 3. Armor Mastery

**Files:** 
- `module/config.mjs` (configuration)
- `module/documents/actor/actor.mjs` (implementation)
- `module/applications/actor/short-rest.mjs` (UI)

### Description
Feature allowing characters with Armor Mastery to recover temporary HP during rests.

### Configuration
Defined in `CONFIG.DND5E.armorMastery` with mastery levels (heavy, medium, light).

### Implementation
- Actor flag: `flags.dnd5e.armorMastery`
- During rests: Calculates and recovers armor temporary HP
- Rest dialog: Toggle to enable/disable armor mastery recovery

### Code Location
```javascript
// module/documents/actor/actor.mjs:1999-2022
if (this.flags.dnd5e.armorMastery && recoverArmorMastery) {
  armorMasteryRecovered = maxHP - currentHP;
  // ... apply recovery
}
```

---

## 4. Masterworked Items

**Files:**
- `module/data/item/templates/physical-item.mjs` (data model)
- `module/applications/actor/character-sheet.mjs` (UI)

### Description
Allows marking items as masterworked with visual distinction on character sheets.

### Data Model
- Field: `masterworked` (BooleanField, default: false)
- Label: "DND5E.Masterworked"

### UI Implementation
- Toggle button on character sheet
- Visual styling for masterworked items
- Click handler: `_onToggleItemMasterworked`

### Code Location
```javascript
// module/data/item/templates/physical-item.mjs:36
masterworked: new foundry.data.fields.BooleanField({initial: false, label: "DND5E.Masterworked"})
```

---

## 5. Custom Settings

**File:** `module/settings.mjs`

### Siege5e-Specific Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `fortitudePointsThreshold` | Number | 50 | HP percentage threshold for Fortitude Points system |

### Modified Settings

| Setting | Modification |
|---------|--------------|
| `diagonalMovement` | Added `onChange` to sync rule to both `canvas.grid` and `canvas.grid.parent` |

---

## 6. Custom Compendium Packs

**Location:** JSON source files in repo root

### Custom Packs
- **sieg5e-ishiir.json** - Ishiir-specific content
- **sieg5e-arkaeos.json** - Arkaeos-specific content

### Pack Contents
- Custom Classes (Ishiir) - Artificer with custom progression and infusions
- Custom Subclasses (Ishiir) - House-specific options
- Custom Class Features (Ishiir) - Additional features
- Optional Features (Ishiir) - Feats, infusions, fighting styles
- Custom Races (Ishiir) - Additional race options

---

## 7. Upstream Changes Merged

### Removed Content
- Chain shirt removed from SRD items

### Modified Behavior
- Polymorph/Wildshape option labels updated
- Various bug fixes from upstream dnd5e

---

## Testing Notes

### Token Sorting
- Verify smaller tokens render above larger ones
- Verify player tokens above NPC tokens
- Verify recently moved tokens appear on top after movement

### Ruler Elevation
- Test all diagonal rules (555, 5105, EUCL)
- Verify mouse wheel adjusts elevation
- Verify labels show cumulative elevation
- Verify token elevation updates after SPACEBAR movement
- Test waypoint add/remove behavior

### Armor Mastery
- Test with characters having armorMastery flag
- Verify rest recovery calculates correctly
- Verify rest dialog toggle works

### Masterworked Items
- Verify toggle appears on character sheet
- Verify visual distinction for masterworked items
- Verify property persists on items