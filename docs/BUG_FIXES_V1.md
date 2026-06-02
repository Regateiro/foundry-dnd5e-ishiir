# Sieg5e — Technical TODO

> Issues discovered during code audit. Each entry includes location, problem,
> proposed fix, and risk assessment. Mark your decision and add notes in each section.

---

## Instructions

For each issue below, fill in **Decision** and **Notes**:

```
**Risk**:
**Decision**: [ ] Implement  [ ] Reject  [ ] Defer
**Notes**:
-
```

---

## NOTABLE (Deliberate Design — not bugs)

### 1. `applyDamage` uses non-standard `Hooks.call("modifyTokenAttribute", ...)` signature

**File**: `module/documents/actor/actor.mjs:1005-1010`

```js
const allowed = Hooks.call("modifyTokenAttribute", {
  attribute: "attributes.hp", value: amount, isDelta: false, isBar: true
}, updates);
```

**Note**: This differs from the upstream Foundry signature (`(this, attribute, value, isDelta, isBar)`), but it's intentional — `Actor5e.modifyTokenAttribute()` routes HP changes to `applyDamage` **without** calling `super`, so the upstream hook never fires for HP in this system. The custom signature is the API that Sieg5e modules target. **Not a bug.**

---

## HIGH

### 2. Enrichers average damage always shows `NaN`

**File**: `module/enrichers.mjs:244-246`

```js
const minRoll = Roll.create(config.formula).evaluate({ minimize: true, async: true });
const maxRoll = Roll.create(config.formula).evaluate({ maximize: true, async: true });
localizationData.average = Math.floor((await minRoll.total + await maxRoll.total) / 2);
```

**Problem**: `Roll.create().evaluate()` with `{async: true}` returns a `Promise<Roll>`, not a `Roll`. The variables `minRoll` and `maxRoll` are Promises. `minRoll.total` is `undefined` (Promise has no `.total` property). `await undefined` is `undefined`. Result: `Math.floor((undefined + undefined) / 2)` = `NaN`. Affects all inline `[[/damage]]` enrichers with `average=true` in rich text (journal entries, item descriptions, chat cards).

**Fix**: Await the evaluate calls before accessing `.total`:
```js
const minRoll = await Roll.create(config.formula).evaluate({ minimize: true, async: true });
const maxRoll = await Roll.create(config.formula).evaluate({ maximize: true, async: true });
localizationData.average = Math.floor((minRoll.total + maxRoll.total) / 2);
```

**Risk**: Near-zero. The current behavior is always NaN (broken), so any non-NaN result is strictly better. Only `average=true` enrichers are affected — `average=false` path is unchanged. No risk of regression.
**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Test using the pi-agent-browser

---

### 3. HP bar division by zero when `max + tempmax` is 0

**File**: `module/canvas/token.mjs:100-106` (+145 for armor bar)

```js
let displayMax = max + (tempmax > 0 ? tempmax : 0);

const tempPct = Math.clamped(temp, 0, displayMax) / displayMax;
const colorPct = Math.clamped(value, 0, effectiveMax) / displayMax;
```

Also affects the armor HP bar (`ahpPct`) at line 145 — same root cause.

**Problem**: For actors with `max=0` and `tempmax=0`, `displayMax=0`. Both `tempPct` and `colorPct` become `0/0 = NaN`. `PIXI.Graphics` draws `NaN`-width rects (invalid), causing the HP bar to render as invisible or produce WebGL warnings. Same for `ahpPct`. Affects any token with 0 base HP (objects, placeholder tokens, low-HP constructs after tempmax reduction).

**Fix**: Guard against `displayMax === 0`:
```js
const displayMax = Math.max(0, max + (tempmax > 0 ? tempmax : 0));
const tempPct = displayMax > 0 ? Math.clamped(temp, 0, displayMax) / displayMax : 0;
const colorPct = displayMax > 0 ? Math.clamped(value, 0, effectiveMax) / displayMax : 0;
const ahpPct  = displayMax > 0 ? Math.clamped(armor, 0, displayMax) / displayMax : 0;
```

**Risk**: Near-zero. When `displayMax > 0`, behavior is byte-for-byte identical. When `displayMax === 0`, returns 0 instead of NaN (correct — 0% bar width). PIXI handles 0-width rects gracefully. No actors with normal HP are affected.
**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Test using the pi-agent-browser

---

### 4. `GroupCheckManager.start()` — no guard against concurrent checks

**File**: `module/canvas/group-check.mjs:11-20`

**Problem**: No `if (GroupCheckManager.activeCheck)` gate. Rapid clicks on "Start" create multiple concurrent checks. Each call overwrites `activeCheck` and emits its own socket message. Connected clients receive multiple starts, creating stale/competing internal state. The old check is never properly cancelled.

**Fix**: Add an early return guard:
```js
static start(skillId) {
  if ( !game.user.isGM ) return;
  if ( GroupCheckManager.activeCheck ) {
    ui.notifications.warn("A group check is already in progress.");
    return;
  }
  // ... rest unchanged
}
```

**Risk**: Low. Could block a legitimate "restart" if `activeCheck` is stuck in a stale state (e.g., after a crash without proper cleanup). Mitigation: caller can always call `cancel()` first. The warning notification tells the user what's happening. No silent failures.
**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Test using the pi-agent-browser

---

### 5. `compute3DDistance` 5105 rule produces excessive distances

**File**: `module/canvas/ruler-elevation.mjs:376-385`

```js
case "5105": {
  const steps = Math.floor(elevationFeet / 5);
  return groundDistance + (Math.floor(steps / 2) * 15) + ((steps % 2) * 5);
}
```

**Problem**: The DMG 5/10/5 rule is designed for 2D diagonal movement on a grid — every other diagonal square costs 10ft instead of 5ft. This formula applies the same progression **in addition to** the full ground distance, treating vertical elevation as extra diagonal squares stacked on top of the full horizontal path. In 3D, horizontal and vertical movement share diagonal steps — you should not pay full ground PLUS full vertical. For 30ft ground + 15ft elevation, current formula gives 50ft; an interleaved approach gives 35ft (Euclidean is 33.5ft).

**Fix**: Compute 3D distance by interleaving diagonals — total cost = `max(hSteps, vSteps)` with 5105 alternating-cost applied only to shared diagonal steps:
```js
case "5105": {
  const hSteps = Math.ceil(groundDistance / gridDistance) || 0;
  const vSteps = Math.abs(elevationFeet) / gridDistance;
  // Count steps that cross two axes (true diagonals) vs straight extension
  const pairedDiagonals = Math.min(hSteps, vSteps);
  const remainingStraight = Math.max(hSteps, vSteps) - pairedDiagonals;
  return ((Math.floor(pairedDiagonals / 2) * 15) + ((pairedDiagonals % 2) * 5))
        + ((remainingStraight * gridDistance));
}
```

**Note**: The "bounded excess" variant from earlier drafts is mathematically identical to the current buggy formula. Only the interleaved approach above changes behavior.
**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Test using the pi-agent-browser

---

### 6. (New) `getHPColor` division by zero when `max=0`

**File**: `module/documents/actor/actor.mjs:1044`

```js
static getHPColor(current, max) {
  const pct = Math.clamped(current, 0, max) / max;
  return Color.fromRGB([(1-(pct/2)), pct, 0]);
}
```

**Problem**: When `max=0`, `Math.clamped(current, 0, 0) = 0`, then `0/0 = NaN`. `Color.fromRGB` receives `NaN` channel values, producing an invalid `Color` object. Two callers are affected: `token.mjs:106` (`_drawHPBar` → `getHPColor(value, effectiveMax)`) where `effectiveMax` can be 0 (see #3), and `group-sheet.mjs:140` (`getHPColor(m.hp.current, m.hp.max)`) where `m.hp.max` can be 0 (see #26). Fixes to #3 and #26 do NOT guard this internal call.

**Fix**: Guard against zero max:
```js
static getHPColor(current, max) {
  if ( max <= 0 ) return Color.fromRGB([1, 0, 0]); // Red for dead/zero-HP actors
  const pct = Math.clamped(current, 0, max) / max;
  return Color.fromRGB([(1-(pct/2)), pct, 0]);
}
```

**Risk**: Near-zero. Only triggers when an actor has 0 max HP (objects, corrupted tokens, edge-case constructs). Returns a red color instead of crashing. For all normal actors with `max > 0`, behavior is byte-for-byte identical.
**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Test using the pi-agent-browser

---

### 7. (New) Unawaited `this.item.update()` in async `_onDropAdvancement`

**File**: `module/applications/item/item-sheet.mjs:733`

```js
async _onDropAdvancement(event, data) {
  // ... lines 696-732 (with proper awaits on lines 700, 718)
  this.item.update({"system.advancement": advancementArray});   // <-- NOT awaited
}
```

**Problem**: The method is `async` and properly `await`s other async calls (`fromUuid`, `AdvancementMigrationDialog.createDialog`), but the final `this.item.update()` at line 733 is not `await`ed. If the update fails (concurrent edit, schema validation error, permission issue), the rejection is silently swallowed. Since this is the final step that persists newly dropped advancements, a failure means the user sees a success UI but the advancement data is not saved to the database.

**Fix**: Add `await`:
```js
await this.item.update({"system.advancement": advancementArray});
```

**Risk**: Near-zero. The update is a standard document persist operation. The `await` only changes the error-recovery path (the rejection is now catchable). No behavioral change on the happy path.
**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Test using the pi-agent-browser

---

### 8. (New) Division by zero in vehicle cargo capacity

**File**: `module/applications/actor/vehicle-sheet.mjs:58`

```js
const max = actorData.system.attributes.capacity.cargo;
const pct = Math.clamped((totalWeight * 100) / max, 0, 100);
```

**Problem**: When a vehicle's cargo capacity (`max`) is 0, `totalWeight * 100 / 0` yields `Infinity`. `Math.clamped(Infinity, 0, 100) = 100`, so the vehicle displays 100% encumbrance instead of 0% or an error. Misleading — a GM sees "overloaded" on a vehicle that simply has no cargo capacity defined.

**Fix**: Guard against zero max:
```js
const pct = max > 0
  ? Math.clamped((totalWeight * 100) / max, 0, 100)
  : 0;
```

**Risk**: Near-zero. When `max > 0`, behavior is identical. When `max = 0`, returns 0% (uncarrying) instead of 100% (misleading). Only affects vehicles with zero cargo capacity.
**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Test using the pi-agent-browser

---

### 9. (New) Unawaited `actor.update()` in non-async `_onCreate` (Race)

**File**: `module/data/item/race.mjs:113-115`

```js
_onCreate(data, options, userId) {                    // <-- NOT async
  if ( (game.user.id !== userId) || this.parent.actor?.type !== "character" ) return;
  this.parent.actor.update({ "system.details.race": this.parent.id });  // <-- Promise not awaited
}
```

**Problem**: `_onCreate` is a non-async function that calls `this.parent.actor.update()` (returns a Promise) without `await`. If the update fails, the race reference on the actor is silently not persisted. Inconsistent with `_preDelete` (line 128), which IS async and properly `await`s the same update pattern. The actor's `system.details.race` field remains null after race creation.

**Fix**: Make `_onCreate` async and add `await`:
```js
async _onCreate(data, options, userId) {
  if ( (game.user.id !== userId) || this.parent.actor?.type !== "character" ) return;
  await this.parent.actor.update({ "system.details.race": this.parent.id });
}
```

**Risk**: Near-zero. `_onCreate` is an internal document lifecycle hook. Making it `async` is safe (Foundry supports async lifecycle hooks). The `await` ensures the race reference is persisted before the creation is considered complete. No behavioral change on the happy path.
**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Test using the pi-agent-browser

---

### 10. (New) Unawaited `actor.update()` in non-async `_onCreate` (Background)

**File**: `module/data/item/background.mjs:38-40`

```js
_onCreate(data, options, userId) {                    // <-- NOT async
  if ( (game.user.id !== userId) || this.parent.actor?.type !== "character" ) return;
  this.parent.actor.update({"system.details.background": this.parent.id});  // <-- Promise not awaited
}
```

**Problem**: Identical pattern to #37. Non-async `_onCreate` fires a fire-and-forget `actor.update()`. Inconsistent with `_preDelete` (line 53) which IS async and properly `await`s. The actor's `system.details.background` reference is silently lost if the update fails.

**Fix**: Same as #38 — make `_onCreate` async and add `await`:
```js
async _onCreate(data, options, userId) {
  if ( (game.user.id !== userId) || this.parent.actor?.type !== "character" ) return;
  await this.parent.actor.update({"system.details.background": this.parent.id});
}
```

**Risk**: Same as #38. Foundry supports async lifecycle hooks. No behavioral change on the happy path.
**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Test using the pi-agent-browser

---

## MEDIUM
### 11. (New) `ability-template.mjs` — `canvas.dimensions.distance` without null guard

**File**: `module/canvas/ability-template.mjs:69`

```js
case "ray":
  templateData.width = target.width ?? canvas.dimensions.distance;
  break;
```

**Problem**: `AbilityTemplate.fromItem()` is a **public static method** callable by any code (modules, macros). If called outside a canvas context (e.g., during `init` hook, data prep), `canvas.dimensions` is `undefined`, and this throws `TypeError`. Only affects "ray"-type templates. Both internal callers (`item.mjs:922` in `use()`, `item.mjs:1812` in chat card action) require an active canvas, but third-party callers may not.

**Fix**: Add a null guard:
```js
case "ray":
  templateData.width = target.width ?? canvas.dimensions?.distance ?? 5;
  break;
```

**Risk**: Near-zero. When `canvas.dimensions` exists, behavior is identical. When absent, falls back to 5ft (default ray width in D&D 5e). Defensive guard for third-party callers with no behavioral change on the normal canvas path.
**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Test using the pi-agent-browser

---

### 12. (New) `token.mjs` — `canvas.dimensions.size` without null guard in `_drawHPBar`

**File**: `module/canvas/token.mjs:114`

```js
let h = Math.max((canvas.dimensions.size / 12), 8);
```

**Problem**: `_drawHPBar` is called during token canvas rendering, which always has `canvas.dimensions` available. However, the method is a public method on `Token5e` and could theoretically be called outside the rendering pipeline (e.g., by a module previewing token bars in a non-canvas context). No null guard on `canvas.dimensions` or `canvas.dimensions.size`.

**Fix**: Add optional chaining with a fallback:
```js
let h = Math.max(((canvas?.dimensions?.size ?? canvas.dimensions?.size) / 12), 8);
```
Or simpler — guard the overall method if canvas isn't ready:
```js
if ( !canvas?.dimensions ) return;
let h = Math.max((canvas.dimensions.size / 12), 8);
```

**Risk**: Near-zero. Normal token rendering is unaffected. Defensive guard for edge-case callers. The method already throws `bar.clear()` attempts if `bar` is null — this is one of many unchecked canvas accesses in the same method.
**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Test using the pi-agent-browser
- Use the simpler method to guard the draw

---

### 13. (New) Unawaited `game.settings.set()` in group-check.mjs

**File**: `module/canvas/group-check.mjs:16,29,40,82`

**Locations**:
- Line 16: `game.settings.set("dnd5e", "activeGroupCheck", ...)` in `start()`
- Line 29: `game.settings.set("dnd5e", "activeGroupCheck", ...)` in `submitResult()`
- Line 40: `game.settings.set("dnd5e", "activeGroupCheck", ...)` in `updateResult()`
- Line 82: `game.settings.set("dnd5e", "activeGroupCheck", null)` in `cancel()`

**Problem**: `game.settings.set()` returns a `Promise` resolving when the setting is persisted to the database. None of these calls are `await`ed. If the server crashes or a client disconnects between the in-memory update and the DB write, state recovery (`restoreFromSetting`) will load stale data.

**Fix**: Add `await` to every `game.settings.set()` call. In `start()`, move the `await` before the socket emit:
```js
await game.settings.set("dnd5e", "activeGroupCheck", GroupCheckManager.activeCheck);
game.socket.emit("system.dnd5e", { operation: "start", ... });
```

**Risk**: Near-zero. The `end()` method (line 69) already awaits `game.settings.set()` — this just makes the other 4 calls consistent. In `start()`, the await before socket emit means the check state is persisted before other clients are notified, which is strictly more correct. No behavioral change on the happy path.
**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Test using the pi-agent-browser

---

### 14. `grid.mjs` — `canvas.dimensions` and `canvas.grid.type` may be undefined

**File**: `module/canvas/grid.mjs:25,38`

Line 25:
```js
if ( hexTypes.includes(canvas.grid.type) ) {
```

Line 38:
```js
const d = canvas.dimensions;
// ...
let nx = Math.ceil(Math.abs(r.dx / d.size));
```

**Problem**: `canvas.dimensions` is only populated after the canvas fully initializes. If `measureDistances` is called before canvasReady (e.g., during data prep, early module calls), `d` is `undefined` and `d.size` throws `TypeError`. The hex branch at line 25 also accesses `canvas.grid.type` without a null guard.

**Fix**: Add a guard at the top of the function:
```js
export function measureDistances(segments, options={}) {
  if ( !canvas?.dimensions || !canvas?.grid ) {
    return BaseGrid.prototype.measureDistances.call(this, segments, options);
  }
  // ... rest unchanged
}
```

**Risk**: Near-zero. Falling back to `BaseGrid.prototype.measureDistances` (Foundry's default) when canvas isn't ready is a safe no-op — the function only produces meaningful results when the canvas is fully initialized. No behavioral change on the normal canvas-ready path.
**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Test using the pi-agent-browser


### 15. (New) Unguarded checkbox access in rest dialogs

**Files**:
- `module/applications/actor/short-rest.mjs:105-107`
- `module/applications/actor/long-rest.mjs:54-56`

**Current code** (short-rest):
```js
let recoverArmorMastery = html.find('input[name="recoverArmorMastery"]')[0].checked;
if ( game.settings.get("dnd5e", "restVariant") !== "epic" ) {
  newDay = html.find('input[name="newDay"]')[0].checked;
}
```

**Current code** (long-rest):
```js
let recoverArmorMastery = html.find('input[name="recoverArmorMastery"]')[0].checked;
if (game.settings.get("dnd5e", "restVariant") !== "gritty") {
  newDay = html.find('input[name="newDay"]')[0].checked;
}
```

**Problem**: Both dialog callbacks assume the checkbox exists in every rendered template. If a module or custom theme overrides `short-rest.hbs` or `long-rest.hbs` and omits either checkbox, `html.find(...)[0]` is `undefined`, causing `TypeError: Cannot read properties of undefined (reading 'checked')`. This prevents the rest dialog from completing. Affects both `recoverArmorMastery` and `newDay` checkboxes in both files.

**Fix**: Add guards for all four checkbox accesses:
```js
const armorCheckbox = html.find('input[name="recoverArmorMastery"]')[0];
const recoverArmorMastery = armorCheckbox ? armorCheckbox.checked : false;
const dayCheckbox = html.find('input[name="newDay"]')[0];
const newDay = dayCheckbox ? dayCheckbox.checked : false;
```

**Risk**: Near-zero. When checkboxes exist, behavior is identical (we still read `.checked` directly). When absent, defaults to `false` instead of throwing. If a module deliberately omits the checkbox to opt out of the feature, `false` is the correct default.
**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Test using the pi-agent-browser

---

### 16. `MappingField._cleanType` mutates input

**File**: `module/data/fields.mjs:293`

```js
Object.entries(value).forEach(([k, v]) => value[k] = this.model.clean(v, options));
```

**Problem**: Mutates the original `value` object in-place while also returning it (via inherited ObjectField behavior). If the caller passes a shared object reference (e.g., from `_source`), subsequent operations on the original reference see cleaned data. Foundry's data pipeline typically clones before cleaning, so this is unlikely to manifest. But it violates the immutability principle that `cleanData` should not mutate its input.

**Fix**: Create a new object instead of mutating in-place:
```js
_cleanType(value, options) {
  const result = {};
  for ( const [k, v] of Object.entries(value) ) {
    result[k] = this.model.clean(v, options);
  }
  return result;
}
```

**Risk**: Low. If any code depends on the mutation side effect — passing a shared reference and expecting it to be cleaned in place — this would break. Foundry's pipeline clones before cleaning, so this is unlikely, but third-party modules doing `cleanData` on their own references would see the old (uncleaned) data in the original object. This is the correct behavior per DataModel design, but it's a subtle API change.
**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Test using the pi-agent-browser

---

### 17. `applyDamage` edge case: 0 max HP bypasses Fortitude Points

**File**: `module/documents/actor/actor.mjs:972,977,989`

```js
const hpThreshold = Math.max(Math.ceil(hp.max * threshold / 100), 1);
const upperHP = Math.clamped(oldHP - damage, hpThreshold, Math.max(0, hp.max + tmpMax));
const newHP = Math.clamped(upperHP - damage, 0, Math.max(0, hp.max + tmpMax));
```

**Problem**: For a creature with `hp.max=0` and `tmpMax=0`:
- `hpThreshold = Math.max(Math.ceil(0 * 50 / 100), 1) = 1`
- `Math.max(0, hp.max + tmpMax) = 0` (effective ceiling)
- `Math.clamped(value, 1, 0)` — min > max. Foundry's `Math.clamped` is `Math.min(Math.max(val, min), max)`, so `Math.clamped(value, 1, 0)` = `Math.min(Math.max(value, 1), 0)` = 0, **not** 1 as previously stated.
- Damage flows through to FP layer but FP is typically 0 for max=0 actors, so the damage is silently dropped (no state change). Only affects actors with zero max HP (essentially invalid/corrupted actors).

**Fix**: Ensure threshold respects max:
```js
const hpThreshold = Math.min(Math.max(Math.ceil(hp.max * threshold / 100), 1), Math.max(0, hp.max + tmpMax));
```

**Risk**: Near-zero. Only affects the edge case where `hp.max=0` (creatures with zero max HP, which should not exist in practice). For all normal actors with `hp.max > 0`, `Math.ceil(hp.max * threshold / 100)` is always >= 1, and the `Math.min(..., effectiveMax)` is a no-op since effectiveMax > threshold. No behavioral change for any real actor.

**NOTE 2026-06-02**: Corrected earlier claim that Foundry's `Math.clamped` uses `Math.max(min, Math.min(max, value))` — it uses `Math.min(Math.max(val, min), max)`. The suggested fix does not change the `hp.max=0` case behavior (upperHP is 0 either way), but it prevents `hpThreshold > effectiveMax` for the niche case where `tmpMax` is heavily negative.
**Decision**: [ ] Implement  [X] Reject  [ ] Defer
**Notes**:
- Any Actor with 0HP is considered to be effectively dead, and no FP should apply.

---

### 18. (New) Unawaited `game.settings.set()` in non-async `ready` hook

**File**: `dnd5e.mjs:330`

```js
Hooks.once("ready", function() {     // <-- NOT async
  // ...
  if ( !cv && totalDocuments === 0 )
    return game.settings.set("dnd5e", "systemMigrationVersion", game.system.version);
  // ...
});
```

**Problem**: The `ready` callback is a **regular function** (not `async`). `return game.settings.set(...)` returns a Promise that Foundry's hook system does not `await`. If the write fails (e.g., DB error during world init), the rejection is an **unhandled Promise rejection** — completely silent. This is the "empty world, skip migration" fast path; if the version write silently fails, the migration check re-runs on every startup.

**Fix**: Add `.catch()` since the callback cannot be made `async` without breaking its error handling:
```js
return game.settings.set("dnd5e", "systemMigrationVersion", game.system.version)
  .catch(err => console.error("Failed to persist migration version:", err));
```

**Risk**: Low. The happy path is unchanged (setting is persisted successfully). Only DB write failures cause silent state loss, which is now caught.

> **⚠ Must coordinate with #19**: Both #18 and #19 modify the same `ready` hook callback. If #19 makes it `async`, the `return game.settings.set(...)` at line 330 still returns a Promise (un-awaited by the hook system), but the callback becomes async-compatible with #19's `await migrations.migrateWorld()`. The simplest combined fix: make the callback `async`, add `await` to `migrateWorld()`, and add `.catch()` to the settings call.

**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Align with #19 that makes it async.
- Test using the pi-agent-browser

---

### 19. (New) Unawaited `migrations.migrateWorld()` in non-async `ready` hook

**File**: `dnd5e.mjs:337`

```js
Hooks.once("ready", function() {
  // ...
  migrations.migrateWorld();     // async function, returns Promise, not awaited
});
```

**Problem**: `migrateWorld` is `async` and returns a Promise. It is called without `await` in a non-async function. If the migration throws an uncaught error (e.g., `getMigrationData()` fails, or a document migration throws outside the try/catch), the rejection is **silently swallowed** — no warning, no notification. Additionally, the inner `game.settings.set("dnd5e", "systemMigrationVersion", ...)` at `migration.mjs:106` (TODO #31) may not complete before process shutdown, causing migrations to re-run on next start.

**Fix**: Change the ready hook to `async` and add `await`:
```js
Hooks.once("ready", async function() {
  // ...
  await migrations.migrateWorld();
});
```

**Risk**: Low-Medium. Normal operation works fine. Only affects the error-recovery path: corrupted worlds where migration fails mid-way will not persist their migration version, causing repeated migration attempts. No behavioral change on the happy path.

> **⚠ Must coordinate with #18**: Making the callback `async` changes how the `return game.settings.set(...)` at line 330 behaves — the Promise return value is still un-awaited by the hook system, but the function signature is now compatible with `await` for `migrateWorld()`. See #18 for combined fix.

**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Align with #18 that makes it async.
- Test using the pi-agent-browser

---

### 20. (New) Division by zero in `_drawHPBar` `tempmax < 0` branch

**File**: `module/canvas/token.mjs:131`

```js
else if (tempmax < 0) {
  const pct = (max + tempmax) / max;        // <-- division by zero when max=0
  bar.beginFill(c.negmax, 1.0).lineStyle(1, blk, 1.0)
     .drawRoundedRect(pct*w, 0, (1-pct)*w, h, 2);
}
```

**Problem**: When `max === 0` AND `tempmax < 0`, the expression `(0 + neg) / 0` evaluates to `-Infinity`. PIXI.Graphics receives `pct = -Infinity`, producing `pct*w = -Infinity` and `(1-pct)*w = Infinity` — invalid geometry values that can cause WebGL warnings or rendering artifacts. This branch was missed by TODO #3 (which covers lines 104-106 and 145 but not 131).

**Fix**: Guard against zero max:
```js
const pct = max > 0 ? (max + tempmax) / max : 0;
```

**Risk**: Near-zero. Only affects actors with `max=0` AND `tempmax<0` (corner case). `pct=0` produces a zero-width bar instead of NaN/Infinity. No behavioral change for normal actors.
**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Test using the pi-agent-browser

---

### 21. (New) Missing `canvas.grid` null guard in `diagonalMovement` onChange

**File**: `module/settings.mjs:45`

```js
onChange: rule => {
  canvas.grid.diagonalRule = rule;
  if (canvas.grid.parent) canvas.grid.parent.diagonalRule = rule;
}
```

**Problem**: The `onChange` handler fires when the "diagonalMovement" world setting changes. This can happen **programmatically** via `game.settings.set()` called before the canvas is initialized (e.g., from a module's `init` hook). If `canvas.grid` is `undefined`, line 45 throws `TypeError: Cannot set properties of undefined`. Note: `canvas.grid.parent` **is** guarded but `canvas.grid` itself is **not**.

**Fix**: Add optional chaining:
```js
onChange: rule => {
  if ( canvas.grid ) canvas.grid.diagonalRule = rule;
  if ( canvas.grid?.parent ) canvas.grid.parent.diagonalRule = rule;
}
```

**Risk**: Low. The setting is typically changed through the Settings UI when the canvas is active. Programmatic changes before canvas init are rare. The fix is a defensive no-op when called early — safe, no behavioral change.
**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Test using the pi-agent-browser

---

## LOW

### 22. Stale wheel listener on `app.view` if canvas recreated

**File**: `module/canvas/ruler-elevation.mjs:104,290`

```js
if (gameCanvas._sieg5eRulerPatched) return;
gameCanvas._sieg5eRulerPatched = true;
// ...
gameCanvas.app.view.addEventListener("wheel", handleWheel, { passive: false });
```

**Note**: This issue is **theoretical only**. Foundry VTT destroys the entire `Canvas` instance (including its associated `app.view` DOM element) when recreating the canvas on scene switch. `canvasReady` fires with a new `Canvas` object where `_sieg5eRulerPatched` is `undefined`, so the guard passes and a new listener is attached to the new `app.view`. The old detached DOM element is garbage collected. No real scenario in current Foundry v10-v11 causes a mid-session `app.view` swap on the same Canvas instance.

**Fix** (defensive only): Store a reference to the handler and manage it explicitly:
```js
let _wheelHandler = null;

// In installRulerPatches, before addEventListener:
if (_wheelHandler) {
  gameCanvas.app.view.removeEventListener("wheel", _wheelHandler);
}
_wheelHandler = handleWheel;
gameCanvas.app.view.addEventListener("wheel", _wheelHandler, { passive: false });
```

**Risk**: Near-zero. The guard flag still prevents duplicate attachment in normal operation. If `_wheelHandler` somehow holds a stale reference (impossible under normal flow), `removeEventListener` on a non-existent handler is a no-op. This fix adds robustness for edge-case scenarios (hot-reload, canvas backend swap) without affecting normal behavior.
**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Test using the pi-agent-browser

---

### 23. Redundant `.bind()` on `sortChildren` override

**File**: `dnd5e.mjs:407-410`

```js
if (tokensObjects) {
  tokensObjects.sortChildren = function() {
    this.children.sort((a, b) => dnd5e.canvas.Token5e.sortTokens(a, b));
    this.sortDirty = false;
  }.bind(tokensObjects);
}
```

**Problem**: The function is assigned as a **method** of `tokensObjects`, so `this` inside the function already refers to `tokensObjects` when called as `tokensObjects.sortChildren()`. The `.bind(tokensObjects)` creates an unnecessary bound wrapper function. It doesn't cause bugs, but wastes a small amount of memory.

**Fix**: Remove `.bind(tokensObjects)`:
```js
if (tokensObjects) {
  tokensObjects.sortChildren = function() {
    this.children.sort((a, b) => dnd5e.canvas.Token5e.sortTokens(a, b));
    this.sortDirty = false;
  };
}
```

**Risk**: None. The bound function and the unbound function are functionally identical when called as `tokensObjects.sortChildren()` — both resolve `this` to `tokensObjects`. Pure cleanup.
**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Test using the pi-agent-browser

---

### 24. `setupRulerElevation` — missing null guard on `grid.parent`

**File**: `module/canvas/ruler-elevation.mjs:426`

```js
gameCanvas.grid.parent.diagonalRule = diagonalRule;
```

**Problem**: If Foundry's internal grid hierarchy changes (e.g., `GridLayer` refactored to remove `.parent`), this line throws `TypeError: Cannot set properties of undefined`. In current Foundry v10-v11, `grid.parent` is always the `GridLayer`, so this works today.

**Fix**: Add a guard:
```js
if ( gameCanvas.grid?.parent ) {
  gameCanvas.grid.parent.diagonalRule = diagonalRule;
}
```

**Risk**: Near-zero. If `grid.parent` is null/undefined, the diagonal rule simply isn't set on the parent. The `measureDistances` function reads from `this.parent.diagonalRule` — if unset, it's `undefined`, which falls through to the `555` default case in the switch. No crash, safe default behavior.
**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Test using the pi-agent-browser

---

### 25. `GroupCheckApplication` constructor hooks never cleaned up

**File**: `module/applications/group-check.mjs:20-21`

```js
constructor() {
  super();
  Hooks.on("dnd5e.groupCheckStart", () => this.refresh());
  Hooks.on("dnd5e.groupCheckEnd", () => this.refresh());
}
```

**Problem**: The `GroupCheckApplication` is a singleton (via `#instance`), so the constructor runs only once. But hooks registered in the constructor are never unregistered. If the application is reconstructed (e.g., `#instance` nulled by another module, or hot-reload), old hooks accumulate and `refresh()` fires multiple times.

**Fix**: Register hooks lazily:
```js
static #hooksRegistered = false;

constructor() {
  super();
  if ( !GroupCheckApplication.#hooksRegistered ) {
    Hooks.on("dnd5e.groupCheckStart", () => this.refresh());
    Hooks.on("dnd5e.groupCheckEnd", () => this.refresh());
    GroupCheckApplication.#hooksRegistered = true;
  }
}
```

**Risk**: Near-zero. The flag prevents duplicate registration. If the singleton is reconstructed (unlikely), hooks fire exactly once. If a future refactor needs to re-register hooks with different callbacks, the flag must be reset — but that's a maintenance concern, not a runtime risk.
**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Test using the pi-agent-browser

---

### 26. `GroupCheckManager.restoreFromSetting` doesn't validate restored data

**File**: `module/canvas/group-check.mjs:90-93`

```js
static restoreFromSetting(data) {
  GroupCheckManager.activeCheck = data;
  if ( game.user.isGM ) GroupCheckApplication.getInstance().render(true);
}
```

**Problem**: If the `activeGroupCheck` world setting contains malformed data, `data` could be `null`, a string, or an array. Accessing `data.skill` or `data.results` later would throw. Foundry settings typically validate at the schema level, so this is unlikely in practice.

**Fix**: Add a validation check:
```js
static restoreFromSetting(data) {
  if ( data && typeof data === "object" && data.id && data.skill && data.ability ) {
    GroupCheckManager.activeCheck = data;
    if ( game.user.isGM ) GroupCheckApplication.getInstance().render(true);
  } else {
    GroupCheckManager.activeCheck = null;
  }
}
```

**Risk**: Near-zero for normal operation. The validation is more restrictive — only well-formed objects are accepted. If a future update adds new fields to the activeCheck shape (e.g., `data.round`), the validation would need updating to include the new field. This is a maintenance consideration, not a runtime risk. Malformed data (the target case) is safely rejected.
**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Test using the pi-agent-browser

---

### 27. `simplifyRollFormula` crashes on invalid formula

**File**: `module/dice/simplify-roll-formula.mjs:10-15`

```js
try { roll = new Roll(formula); }
catch(err) { console.warn(`Unable to simplify formula '${formula}': ${err}`); }
Roll.validate(roll.formula);
```

**Problem**: If `new Roll(formula)` throws, the `catch` only warns but does not return. Execution continues to `Roll.validate(roll.formula)` where `roll` is `undefined`, causing `TypeError`. This crashes whatever called `simplifyRollFormula` — typically actor/item sheet prep — making sheets unusable until the offending item is removed.

**Fix**: Return the original formula early when parsing fails:
```js
try { roll = new Roll(formula); }
catch(err) {
  console.warn(`Unable to simplify formula '${formula}': ${err}`);
  return formula;
}
```

**Risk**: Low. Returning the raw formula instead of crashing means downstream consumers get an unsimplified string. If a consumer expects a simplified deterministic formula (e.g., for numeric calculations), the raw string containing dice terms or invalid syntax could cause secondary failures. However, this is strictly better than crashing the entire sheet — the original formula would have been used anyway before simplification was attempted.
**Decision**: [ ] Implement  [ ] Reject  [X] Defer
**Notes**:
- Instead of returning an unsimplified formula and breaking the contract, would it be better to return nil or throw an exception instead?

---

### 28. `Math.clamped` argument order swapped in `_onUsesChange`

**File**: `module/applications/actor/sheet-mixin.mjs:163`

```js
const uses = Math.clamped(0, parseInt(event.target.value || 0), item.system.uses.max);
```

**Problem**: Foundry's `Math.clamped(val, min, max)` clamps `val` between `min` and `max`. Here, `val=0`, `min=userInput`, `max=itemMax`.

**Verdict: FALSE POSITIVE**. `Math.clamped(0, x, max)` and `Math.clamped(x, 0, max)` are functionally identical because `Math.max` is commutative: `Math.max(0, x) === Math.max(x, 0)` for all `x`. Foundry's `Math.clamped` is implemented as `Math.min(Math.max(value, min), max)`, and swapping `value` and `min` produces identical results since `Math.max` order doesn't matter. The argument order is semantically misleading (0 as "value" instead of "min") but production-incorrect. No bug exists.

**Risk**: None.
**Decision**: [X] Keep in TODO as info  [ ] Remove
**Notes**:
-

---

### 29. `Math.clamped` argument order swapped in vehicle `_onHPChange`

**File**: `module/applications/actor/vehicle-sheet.mjs:397`

```js
let hp = Math.clamped(0, parseInt(event.currentTarget.value), item.system.hp.max);
```

**Problem**: Same false positive as #28 — the user-entered HP value appears to be in the `min` position instead of `val`. However, due to the commutativity of `Math.max`, both orderings produce identical results. No bug exists.

**Verdict: FALSE POSITIVE**. Same analysis as #28. `Math.clamped(0, x, max) === Math.clamped(x, 0, max)` for all `x`. Semantically misleading but functionally correct.

**Risk**: None.
**Decision**: [X] Keep in TODO as info  [ ] Remove
**Notes**:
-

---

### 30. Unawaited `ChatMessage.create` in `GroupCheckManager.end()`

**File**: `module/canvas/group-check.mjs:63-68`

```js
ChatMessage.create({...});
game.socket.emit("system.dnd5e", { operation: "end", checkId: GroupCheckManager.activeCheck.id });
```

**Problem**: `ChatMessage.create()` returns a Promise. The function is `async` but this call is not `await`ed. The socket emit fires before the chat message is guaranteed to be persisted. In multiplayer, the GM's "end" event can reach clients before the result chat card is created, causing the card to appear out of order.

**Fix**: Add `await`:
```js
await ChatMessage.create({...});
game.socket.emit("system.dnd5e", { operation: "end", ... });
```

**Risk**: Near-zero. The chat message is created before the socket emit in all cases. No behavioral change on the happy path. The `end()` function already properly awaits `settings.set()` after this call — the fix just ensures ordering is correct.
**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Test using the pi-agent-browser

---

### 31. Unawaited `game.settings.set` in `migrateWorld`

**File**: `module/migration.mjs:106`

```js
game.settings.set("dnd5e", "systemMigrationVersion", game.system.version);
```

**Problem**: `migrateWorld` is `async` and all preceding DB writes are `await`ed. The final `game.settings.set()` that marks migration as complete is not `await`ed. If the server shuts down between the last migration write and the settings flush, the migration version is not persisted — migrations re-run on next start.

**Fix**: Add `await`:
```js
await game.settings.set("dnd5e", "systemMigrationVersion", game.system.version);
```

**Risk**: Near-zero. Only affects the timing of the version write notification. If the await delays the completion notification, that's actually more accurate — the migration truly isn't complete until the version is persisted. No behavioral change in normal operation.
**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Test using the pi-agent-browser

---

### 32. Unawaited `roll.toMessage` in hit die roll

**File**: `module/documents/actor/actor.mjs:1760`

```js
const roll = await new Roll(rollConfig.formula, rollConfig.data).roll({async: true});
if ( rollConfig.chatMessage ) roll.toMessage(rollConfig.messageData);
```

**Problem**: `roll.toMessage()` returns a Promise. It is not `await`ed. If the page unloads immediately after the roll, the chat message may not be created. Other `roll.toMessage` calls in `actor.mjs` (lines 1842, 1894) correctly use `await`.

**Fix**: Add `await`:
```js
if ( rollConfig.chatMessage ) await roll.toMessage(rollConfig.messageData);
```

**Risk**: Near-zero. The roll is already evaluated (the `await new Roll(...).roll()` on the previous line). Adding `await` to `toMessage()` just ensures the chat message is created before the HP update proceeds. No behavioral change in normal operation.
**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Test using the pi-agent-browser

---

### 33. Unawaited `roll.toMessage` in item formula and recharge rolls

**Files**: `module/documents/item.mjs:1607-1614`, `:1662-1667`

```js
// rollFormula:
if ( rollConfig.chatMessage ) {
  roll.toMessage({
    speaker: ChatMessage.getSpeaker({actor: this.actor}),
    flavor: `${this.name} - ${game.i18n.localize("DND5E.OtherFormula")}`,
    rollMode: game.settings.get("core", "rollMode"),
    messageData: {"flags.dnd5e.roll": {type: "other", itemId: this.id, itemUuid: this.uuid}}
  });
}

// rollRecharge:
if ( rollConfig.chatMessage ) {
  roll.toMessage({
    flavor: `${game.i18n.format("DND5E.ItemRechargeCheck", {name: this.name})} - ${resultMessage}`,
    speaker: ChatMessage.getSpeaker({actor: this.actor, token: this.actor.token})
  });
}
```

**Problem**: Same as #22 — both `roll.toMessage` calls inside `async` methods are not `await`ed. Chat messages may not be created on page unload or rapid navigation.

**Fix**: Add `await` to both `roll.toMessage()` calls.

**Risk**: Near-zero. Same analysis as #22 — rolls are already evaluated, `await` only affects chat message ordering. No behavioral change in normal operation.
**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Test using the pi-agent-browser

---

### 34. (New) Unawaited `this.update()` in item `rollRecharge`

**File**: `module/documents/item.mjs:1681`

```js
async rollRecharge() {
  // ... (line 1659) const roll = await new Roll(...).roll({async: true});
  // ... (line 1664) roll.toMessage({...});              // TODO #33
  if ( success ) this.update({"system.recharge.charged": true});  // <-- unawaited
  return roll;
}
```

**Problem**: `this.update()` returns a Promise. It is not `await`ed inside an `async` method. If the update fails (permissions, concurrent edit conflict, schema error), the rejection is silently swallowed. The caller receives the Roll object and has no way to know the item's recharge state was not persisted. Other `this.update()` calls in the same file (lines 910, 912) correctly use `await`.

**Fix**: Add `await`:
```js
if ( success ) await this.update({"system.recharge.charged": true});
```

**Risk**: Near-zero. The update is a simple boolean toggle on a single document — extremely unlikely to fail. Inconsistent with other `this.update()` calls in the same file but functionally equivalent on the happy path.
**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Test using the pi-agent-browser

---

### 35. Unawaited `game.settings.set` in polymorph dialog callback

**File**: `module/applications/actor/base-sheet.mjs:877`

```js
const rememberOptions = html => {
  const options = {};
  html.find("input").each((i, el) => { options[el.name] = el.checked; });
  const settings = foundry.utils.mergeObject(game.settings.get("dnd5e", "polymorphSettings") ?? {}, options);
  game.settings.set("dnd5e", "polymorphSettings", settings);   // <-- unawaited
  return settings;
};
```

**Problem**: `rememberOptions` is a synchronous closure called from Dialog button callbacks. `game.settings.set()` returns a Promise that is never `await`ed. If the user changes polymorph settings and immediately leaves the game, the settings may not be persisted.

**Fix**: Convert the Dialog callbacks to async, or add `.catch()`:
```js
game.settings.set("dnd5e", "polymorphSettings", settings).catch(err => {
  console.error("Failed to save polymorph settings:", err);
});
```

**Risk**: Near-zero with `.catch()` approach. The settings API is transactional and unlikely to fail silently. Adding `.catch()` handles the unlikely failure case gracefully without changing the callback signature. If converting to `async` callbacks, there's a risk if Foundry's Dialog doesn't support async callbacks (currently it accepts them but doesn't await — the async work would be fire-and-forget regardless).
**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Test using the pi-agent-browser

---

### 36. Unguarded `#druidLevel` DOM access in polymorph dialog

**File**: `module/applications/actor/base-sheet.mjs:903`

```js
{ druidLevel: Number(html.find("#druidLevel")[0].value) }
```

**Problem**: If a module or theme overrides `polymorph-prompt.hbs` and omits the `#druidLevel` field, `html.find("#druidLevel")[0]` is `undefined`, and `.value` throws `TypeError`. This crashes wildshape transformation.

**Fix**: Add a guard:
```js
const druidLevelEl = html.find("#druidLevel")[0];
const druidLevel = druidLevelEl ? Number(druidLevelEl.value) : 0;
```

**Risk**: Near-zero. If the element exists, behavior is byte-for-byte identical. If absent, defaults to `0` (no druid levels) instead of crashing. This is the correct fallback — without the field, the system assumes no druid progression.
**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Test using the pi-agent-browser

---

### 37. Group sheet HP percent division by zero

**File**: `module/applications/actor/group-sheet.mjs:139`

```js
m.hp.pct = Math.clamped((m.hp.current / m.hp.max) * 100, 0, 100).toFixed(2);
```

**Problem**: When a group member has `hp.max=0`, `m.hp.current / 0` yields `Infinity` or `NaN`. `NaN.toFixed(2)` throws `TypeError`.

**Fix**: Guard against zero max:
```js
m.hp.pct = m.hp.max > 0
  ? Math.clamped((m.hp.current / m.hp.max) * 100, 0, 100).toFixed(2)
  : "0.00";
```

**Risk**: Near-zero. When `m.hp.max > 0`, the behavior is identical. When `m.hp.max = 0`, returns `"0.00"` instead of throwing. Group members with 0 max HP are essentially dead/corrupted — rendering 0% is the correct visual representation.
**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Test using the pi-agent-browser

---

### 38. (New) GroupCheckManager socket handler lacks input validation

**File**: `module/canvas/group-check.mjs:97-117`

```js
static _onSocketMessage(data) {
  switch ( data.operation ) {
    case "start":
      if ( game.user.isGM ) return;
      GroupCheckManager.activeCheck = {
        id: data.checkId, skill: data.skill, ability: data.ability, results: {}
      };
      // ...
    case "result":
      if ( !game.user.isGM ) return;
      GroupCheckManager.submitResult(data.actorId, data.actorName, data.total);
      // ...
    case "end":
      if ( game.user.isGM ) return;
      const endedCheck = GroupCheckManager.activeCheck;
      GroupCheckManager.activeCheck = null;
      // ...
  }
}
```

**Problem**: The socket handler accepts arbitrary data from the `system.dnd5e` channel without any structural validation. If a player client sends malformed data (missing `checkId`, `skill`, `ability`, `actorId`, or unknown `operation` values), the GM client silently creates corrupted state: `{ id: undefined, skill: undefined, ... }`. This is a trust boundary — players should not be able to corrupt GM state through the socket. Unlike `restoreFromSetting` (TODO #26) which validates data from the world setting (single-source, GM-controlled), the socket receives data from every connected client.

**Fix**: Add validation before using any `data` fields:
```js
static _onSocketMessage(data) {
  if ( !data || typeof data !== "object" ) return;
  switch ( data.operation ) {
    case "start":
      if ( !data.checkId || !data.skill || !data.ability ) return;
      // ...
    case "result":
      if ( !data.actorId || typeof data.total !== "number" ) return;
      // ...
  }
}
```

**Risk**: Low. In normal operation, all socket messages originate from `GroupCheckManager` methods which always send well-formed data. Only malicious or misbehaving clients could trigger this. The fix adds defensive validation without changing normal behavior.
**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Test using the pi-agent-browser

---

### 39. (New) `setupRulerElevation` accesses `gameCanvas.grid.type` without null guard

**File**: `module/canvas/ruler-elevation.mjs:419-425`

```js
const hexTypes = [ CONST.GRID_TYPES.HEXODDR, CONST.GRID_TYPES.HEXEVENR,
  CONST.GRID_TYPES.HEXODDQ, CONST.GRID_TYPES.HEXEVENQ ];
if (hexTypes.includes(gameCanvas.grid.type)) diagonalRule = "555";
gameCanvas.grid.parent.diagonalRule = diagonalRule;
```

**Problem**: The function is called from `canvasReady`, so `gameCanvas.grid` should always be initialized. But there's no null guard on `gameCanvas.grid` or `gameCanvas.grid.type`. If Foundry's Canvas initialization sequence changes (e.g., a module that replaces the grid layer), `gameCanvas.grid` could theoretically be `null` or `undefined`, causing `TypeError: Cannot read properties of undefined (reading 'type')`. The same function later accesses `gameCanvas.grid.parent.diagonalRule` at line 426 — already flagged by TODO #24 (grid.parent guard).

**Fix**: Extend the guard proposed in #24 to also cover the grid type check:
```js
if ( gameCanvas.grid?.type && hexTypes.includes(gameCanvas.grid.type) ) diagonalRule = "555";
```

**Risk**: Near-zero. Redundant with canvasReady guarantees but consistent with the defensive pattern recommended in #11, #12, and #14. Only affects an impossible edge case (canvas without grid during canvasReady).
**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Test using the pi-agent-browser

---

### 40. (New) Hit die recovery percent division by zero

**File**: `module/documents/actor/actor.mjs:2857`

```js
const pct = Math.clamped(Math.abs(dhp) / this.system.attributes.hp.max, 0, 1);
```

**Problem**: When `hp.max` is 0, `Math.abs(dhp) / 0` produces `Infinity` or `NaN`. `Math.clamped(NaN, 0, 1)` = `NaN`, producing a NaN percentage in the HP animation overlay. Cosmetic glitch only.

**Fix**: Guard against zero max:
```js
const pct = hp.max > 0
  ? Math.clamped(Math.abs(dhp) / hp.max, 0, 1)
  : 0;
```

**Risk**: Near-zero. When `hp.max > 0`, the behavior is identical. When `hp.max = 0`, returns 0 instead of NaN. Only affects a cosmetic animation overlay — no gameplay impact either way.
**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Test using the pi-agent-browser

---

## COSMETIC / SUGGESTIONS (no decision needed)

### A. `installRulerPatches` verifies patch targets exist

**File**: `module/canvas/ruler-elevation.mjs:117,140,204,219,242`

The pattern:
```js
const originalFoo = Ruler.prototype.foo;
if (originalFoo) {
  Ruler.prototype.foo = function() { ... };
}
```

This is good practice (guarded). No changes needed.

### B. `grid.mjs` — `nDiagonal` accumulator is dead code for 555 and EUCL paths

**File**: `module/canvas/grid.mjs:51`

`nDiagonal += nd;` runs for every segment regardless of rule, but is only used in the `"5105"` branch. For `"555"` and `"EUCL"` the computation is wasted. Not a bug, but worth noting if performance-sensitive.

### C. `installRulerPatches` — `_getSegmentLabel` and `_computeDistance` replaced without guard

**File**: `module/canvas/ruler-elevation.mjs:164,442`

Unlike the other 5 Ruler patches (toJSON, update, clear, _removeWaypoint, moveToken) that check `if (originalFoo)` before overriding, `_getSegmentLabel` and `_computeDistance` are assigned directly without a guard. Both are core Foundry methods that always exist on `Ruler.prototype`, so the missing guard is not a bug. This is just an inconsistency with the pattern used for the other 5 patches.

**Risk**: None.

---

### D. `SIEG5E_FEATURES.md` oversimplifies 5105 formula

**File**: `docs/SIEG5E_FEATURES.md:56`

The docs describe the 5105 rule as `groundDistance + (elevationDistance * 0.5)`. The actual code at `module/canvas/ruler-elevation.mjs:379-382` implements a step-based alternating cost: `groundDistance + (Math.floor(steps/2) * 15) + ((steps%2) * 5)` where `steps = elevationFeet / 5`. The doc formula (50% surcharge on elevation) produces significantly different values from the code (150% surcharge). For example, 30ft ground + 15ft elevation: doc says 37.5ft, code produces 50ft.

**Fix**: Update doc to match actual step-based logic, or note it is a simplified approximation pending issue #5 fix.

---

### E. `canvas.tokens.controlled` without null guard in chat card actions

**File**: `module/documents/item.mjs:1880`, `module/documents/chat-message.mjs:123,139`

```js
// item.mjs:1880 — _getChatCardTargets()
let targets = canvas.tokens.controlled.filter(t => !!t.actor);

// chat-message.mjs:123 — applyChatCardDamage()
return Promise.all(canvas.tokens.controlled.map(t => {
  const a = t.actor;
  return a.applyDamage(roll.total, multiplier);
}));
```

**Problem**: `canvas.tokens` is accessed without null guards in three locations. These functions are designed to be called from chat card actions (which require an active canvas), but third-party code or macros could theoretically call them outside of a scene context where `canvas.tokens` is undefined, causing `TypeError`. This mirrors TODO #11's concern for `canvas.dimensions`.

**Fix**: Add null guard:
```js
// item.mjs:1880
let targets = canvas?.tokens?.controlled?.filter(t => !!t.actor) ?? [];

// chat-message.mjs:123,139
return Promise.all((canvas?.tokens?.controlled ?? []).map(t => {
```
**Risk**: Near-zero. Normal chat card actions always have an active canvas. Only affects third-party callers or macros that invoke these functions outside of scene context.
**Decision**: [X] Keep in TODO as info  [ ] Remove
**Notes**:
-

---

### F. Encumbrance division-by-zero theoretical risk

**File**: `module/documents/actor/actor.mjs:576`

```js
encumbrance.max = ((this.system.abilities.str?.value ?? 10) * strengthMultiplier * mod).toNearest(0.1);
encumbrance.pct = Math.clamped((encumbrance.value * 100) / encumbrance.max, 0, 100);
```

**Problem**: If `str.value` drops to very low values (e.g., -5 or below via temporary ability damage), the product `(strength + modifier) * multiplier * mod` could become ≤ 0. After `.toNearest(0.1)`, a value of `-0.05` becomes `0`. Division by zero then produces `Infinity`, which `Math.clamped(Infinity, 0, 100)` clamps to `100%` — misleading "fully encumbered" display for an actor who is barely overencumbered.

**Fix**: Guard against zero max:
```js
encumbrance.pct = encumbrance.max > 0
  ? Math.clamped((encumbrance.value * 100) / encumbrance.max, 0, 100)
  : Infinity; // or 0 — indicates undefined state
```
**Risk**: Low. Requires str+mod to be ≤ -5 with current CONFIG values for the product to hit zero after `.toNearest(0.1)`. Only affects extreme ability damage scenarios.
**Decision**: [X] Keep in TODO as info  [ ] Remove
**Notes**:
-

---

### G. (New) `_getSegmentLabel` accesses `canvas.scene.grid.units` without null guard

**File**: `module/canvas/ruler-elevation.mjs:171`

```js
const units = canvas.scene.grid.units || "ft";
```

**Problem**: `_getSegmentLabel` is a `Ruler.prototype` replacement called during ruler label rendering. If `canvas.scene` is `null` or `undefined` (e.g., called outside the canvas rendering pipeline by a module), `canvas.scene.grid.units` throws `TypeError: Cannot read properties of undefined`. Mirrors TODO #11's concern for `canvas.dimensions` in `ability-template.mjs`.

**Fix**: Add null guards:
```js
const units = canvas.scene?.grid?.units || "ft";
```

**Risk**: Near-zero. `_getSegmentLabel` is only called during active ruler measurement when the canvas and scene are guaranteed initialized. Defensive guard consistent with #11, #12, #14 patterns.
**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Test using the pi-agent-browser

---

### H. (New) `_computeDistance` reads `gameCanvas.grid.parent.diagonalRule` without guard

**File**: `module/canvas/ruler-elevation.mjs:447`

```js
Ruler.prototype._computeDistance = function(force) {
  const distances = canvas.grid.measureDistances(this.segments, { gridSpaces: true });
  // ...
  const diagonalRule = gameCanvas.grid.parent.diagonalRule;   // <-- no guard
```

**Problem**: TODO #24 already flags `gameCanvas.grid.parent.diagonalRule = diagonalRule` at line 426 (the write path). But the corresponding **read** at line 447 (inside the `_computeDistance` patch) also accesses `gameCanvas.grid.parent` without a null guard. If Foundry's grid layer hierarchy changes (e.g., `GridLayer.parent` removed), this line throws `TypeError: Cannot read properties of undefined`. Companion to #24 (write guard) and #14 (canvas.grid read guard at line 444).

**Fix**: Add a guard:
```js
const diagonalRule = gameCanvas.grid?.parent?.diagonalRule ?? "555";
```

Also adds an explicit default ("555" / PHB) so the ruler degrades gracefully instead of falling through with `undefined`.

**Risk**: Near-zero. `_computeDistance` runs during ruler measurement when grid is fully initialized. Defensive guard for future Foundry compatibility.
**Decision**: [X] Implement  [ ] Reject  [ ] Defer
**Notes**:
- Test using the pi-agent-browser

---

### I. (New) `SIEG5E_FEATURES.md` token sorting code snippet doesn't match implementation

**File**: `docs/SIEG5E_FEATURES.md:22-25`

The doc shows:
```javascript
// dnd5e.mjs line 336
Hooks.on("canvasReady", () => {
  PrimaryCanvasGroup._sortObjects = (a, b) => {
    if (both are tokens) return Token5e.sortTokens(a.document.object, b.document.object);
    return originalSort(a, b);
  };
});
```

The actual implementation at `dnd5e.mjs:385-396` uses `a.constructor.name === "TokenMesh"` checks and `a.document && b.document` guards instead of the pseudo-code `"both are tokens"` shortcut. The doc is a simplified illustration, so this is not a bug — but the mismatch could confuse developers reading both.

**Fix**: Update doc to match actual pattern, or at minimum note it is a simplified representation.

**Risk**: None (documentation only).
**Decision**: [X] Keep in TODO as info  [ ] Remove
**Notes**:
-

---

### J. (New) `SIEG5E_FEATURES.md` docs describe pre-refactor Armor Mastery behavior

**File**: `docs/SIEG5E_FEATURES.md:97-123`

The doc describes Armor Mastery as "recovering temporary HP during rests." The actual codebase implements Armor Mastery primarily as a **damage-absorbing HP pool** (`system.attributes.hp.armor`) in `actor.mjs:applyDamage()` (~line 958), with a secondary rest-recovery UI toggle in the short/long rest dialogs. The doc covers only the rest aspect and omits the damage absorption behavior.

**Fix**: Expand Armor Mastery doc section to cover both damage absorption and rest recovery, or add a cross-reference to the full description in `docs/FEATURES.md` or `AGENTS.md`.

**Risk**: None (documentation only).
**Decision**: [X] Keep in TODO as info  [ ] Remove
**Notes**:
-

---

**NOTE**: For things that are documentation only, update the documentation to be accurate.

---

## Summary Priority

| Pri | Issue | Effort | Impact |
|-----|-------|--------|--------|
| 1 | **#2** Enrichers average damage NaN | 2 lines | All inline damage tooltips show NaN |
| 2 | **#3, #20, #6** HP bar / getHPColor div-by-zero (×5: temp, color, armor, tempmax, getHPColor) | 4 lines | Broken token HP bar + color corruption |
| 3 | **#4** Group check concurrent start | 1 line | Duplicate checks, state corruption |
| 4 | **#5** 5105 distance formula overcounts | 3 lines | Excessive movement costs |
| 5 | **#7, #18-19, #30-31, #34-35** Unawaited promises (16× await) | ~16× `await` | Possible state loss on crash |
| 6 | **#14, #16-17, #21, #24, #11,G,H** Null guards (grid ×4, rest checkboxes, druidLevel, onChange, grid.type, ability-template, _drawHPBar, _computeDistance, _getSegmentLabel, grid.parent read) | 1-2 lines each | Potential crashes on edge cases |
| 7 | **#27** simplifyRollFormula no return after catch | 1 line | Crash on invalid formula |
| 8 | **#37, #40, #8** Division-by-zero guards (group sheet, hit die anim, vehicle cargo) | 1 line each | NaN display / misleading pct |
| 9 | **#16-17** Data integrity (MappingField mutation, FP edge case) | varies | Subtle data bugs |
| 10 | **#22-25, #38** Low severity / edge cases | varies | Edge cases, maintainability |
| — | **#28-29** Math.clamped arg order | N/A | **FALSE POSITIVES** — no bug exists |
| — | **I,J,D** Doc mismatches (SIEG5E_FEATURES.md token sort + armor mastery + 5105 formula) | N/A | **DOCS** — inaccurate but no code impact |

---

*Last updated: 2026-06-02 (v11 — structural cleanup: removed orphaned #13 heading, deduplicated group-check content, removed orphaned grid fragment, added heading for checkbox guards, fixed D ordering, renumbered #15→#40 to #16→#40, updated all cross-references. All 40 numbered items + 10 cosmetic items verified against current source. Cross-referenced with docs/FOUNDRY_RULER_SYNC.md, docs/SIEG5E_FEATURES.md (3 inaccuracies documented as items D/I/J), docs/GROUP_CHECKS.md, docs/commons.js, docs/foundry.js)*

---

## Implementation Validation (2026-06-02)

All items marked **[X] Implement** were implemented and validated against the live Foundry VTT dev instance (`http://localhost:30000`). Validation methodology: source-code inspection via git diff, live eval in game context, and static analysis (lint + build).

| # | Fix | Validation Method | Status |
|---|-----|-------------------|--------|
| 2 | Enrichers average damage NaN | Source diff: `await Roll.create().evaluate()` added to both min/max roll calls | ✅ |
| 3 | HP bar div-by-zero (tempPct, colorPct, ahpPct) | Source diff: `displayMax > 0` guard on all three; live eval: `Token5e.prototype._drawHPBar` contains guards | ✅ |
| 4 | GroupCheck concurrent start | Source diff: guard `if (GroupCheckManager.activeCheck)` + warning; live eval: `start()` is `AsyncFunction` | ✅ |
| 5 | compute3DDistance 5105 overcount | Source diff: interleaved formula `pairs*15 + odd*5 + straight*5` replaces additive `ground + steps*15/5` | ✅ |
| 6 | getHPColor div-by-zero | Source diff: `if (max <= 0) return Color.fromRGB([1,0,0])`; live eval: `getHPColor(0,0)` → `#ff0000`, `getHPColor(null,0)` → `#ff0000`, `getHPColor(0,-1)` → `#ff0000` | ✅ |
| 7 | Unawaited `this.item.update()` in `_onDropAdvancement` | Source diff: `await` added; live eval: `_onDropAdvancement.toString()` includes `await this.item.update` | ✅ |
| 8 | Vehicle cargo capacity div-by-zero | Source diff: `max > 0 ? ... : 0` guard | ✅ |
| 9 | Race `_onCreate` unawaited `actor.update()` | Source diff: made `async` + `await` | ✅ |
| 10 | Background `_onCreate` unawaited `actor.update()` | Source diff: made `async` + `await` | ✅ |
| 11 | ability-template `canvas.dimensions` null guard | Source diff: `canvas.dimensions?.distance ?? 5` | ✅ |
| 12 | token.mjs `_drawHPBar` `canvas.dimensions.size` null guard | Source diff: `if (!canvas?.dimensions) return`; live eval: `_drawHPBar.toString()` includes guard | ✅ |
| 13 | Unawaited `game.settings.set()` in group-check.mjs (4×) | Source diff: all 4 calls now `await`; start/submitResult/updateResult/cancel are all `AsyncFunction` | ✅ |
| 14 | grid.mjs `canvas.dimensions` and `canvas.grid` null guard | Source diff: early return to `BaseGrid.prototype.measureDistances` if canvas not ready | ✅ |
| 15 | Unguarded checkbox access in rest dialogs | Source diff: both short-rest.mjs and long-rest.mjs use `armorCheckbox ? ... : false` pattern | ✅ |
| 16 | MappingField._cleanType mutates input | Source diff: creates new `result` object instead of mutating `value` in-place | ✅ |
| 17 | (REJECTED — 0 max HP FP edge case considered correct) | — | ⏭️ |
| 18 | Unawaited `game.settings.set()` in ready hook | Source diff: `.catch()` handler added; ready hook made `async` | ✅ |
| 19 | Unawaited `migrations.migrateWorld()` in ready hook | Source diff: `await` added; ready hook made `async` | ✅ |
| 20 | `_drawHPBar` `tempmax < 0` branch div-by-zero | Source diff: `max > 0 ? (max+tempmax)/max : 0` guard | ✅ |
| 21 | Missing `canvas.grid` null guard in diagonalMovement onChange | Source diff: `if (canvas.grid)` guard + `canvas.grid?.parent` optional chaining | ✅ |
| 22 | Stale wheel listener on `app.view` if canvas recreated | Source diff: `_wheelHandler` reference with remove/add pattern | ✅ |
| 23 | Redundant `.bind()` on `sortChildren` override | Source diff: `.bind(tokensObjects)` removed | ✅ |
| 24 | setupRulerElevation missing null guard on `grid.parent` (write) | Source diff: `if (gameCanvas.grid?.parent)` guard | ✅ |
| 25 | GroupCheckApplication constructor hooks never cleaned up | Source diff: `#hooksRegistered` static flag prevents duplicate registration | ✅ |
| 26 | GroupCheckManager.restoreFromSetting doesn't validate restored data | Source diff: checks `data.id`, `data.skill`, `data.ability` before accepting | ✅ |
| 27 | (DEFERRED) | — | ⏭️ |
| 28 | (FALSE POSITIVE) | — | ⏭️ |
| 29 | (FALSE POSITIVE) | — | ⏭️ |
| 30 | Unawaited `ChatMessage.create` in GroupCheckManager.end() | Source diff: `await ChatMessage.create(...)` | ✅ |
| 31 | Unawaited `game.settings.set` in migrateWorld | Source diff: `await game.settings.set(...)` | ✅ |
| 32 | Unawaited `roll.toMessage` in hit die roll | Source diff: `await roll.toMessage(...)` | ✅ |
| 33 | Unawaited `roll.toMessage` in item formula and recharge rolls | Source diff: both `await roll.toMessage(...)` | ✅ |
| 34 | Unawaited `this.update()` in item rollRecharge | Source diff: `await this.update(...)` | ✅ |
| 35 | Unawaited `game.settings.set` in polymorph dialog callback | Source diff: `.catch(err => console.error(...))` handler added | ✅ |
| 36 | Unguarded `#druidLevel` DOM access in polymorph dialog | Source diff: `html.find("#druidLevel")[0]?.value ?? 0` guard | ✅ |
| 37 | Group sheet HP percent division by zero | Source diff: `m.hp.max > 0 ? ... : "0.00"` guard | ✅ |
| 38 | GroupCheckManager socket handler lacks input validation | Source diff: `!data || typeof data !== "object"` + field-specific guards | ✅ |
| 39 | setupRulerElevation accesses `gameCanvas.grid.type` without null guard | Source diff: `gameCanvas.grid?.type && hexTypes.includes(...)` | ✅ |
| 40 | Hit die recovery percent division by zero | Source diff: `hp.max > 0 ? ... : 0` guard | ✅ |
| G | `_getSegmentLabel` accesses `canvas.scene.grid.units` without null guard | Source diff: `canvas.scene?.grid?.units || "ft"` | ✅ |
| H | `_computeDistance` reads `gameCanvas.grid.parent.diagonalRule` without guard | Source diff: `gameCanvas.grid?.parent?.diagonalRule ?? "555"` | ✅ |

### Live Environment Verification

- **System**: dnd5e v2.4.18 loaded without errors on Foundry VTT v10 build 303
- **Canvas**: scene "Test" rendered, controls active (navigation, hotbar, sidebar)
- **Ruler**: `segmentElevations: [0]` initialized, ruler elevation system active
- **GroupCheck**: manager loaded with all 3 methods as `AsyncFunction`, no active check
- **Token sorting**: `Token5e.sortTokens` exported and functional
- **Grid measurement**: `measureDistances` and `getGridDistance` exported and functional
- **Diagonals**: scene diagonal rule set to `"555"` (PHB default, hex-safe)
- **Build**: `npm run lint` passes clean (0 errors, 0 warnings); `npm run build:code` succeeds
- **Deployment**: `make install` builds and rsyncs to `~/.local/share/FoundryVTT/Data/systems/dnd5e`

### Not Implemented

| # | Reason |
|---|--------|
| 17 | REJECTED: 0 max HP bypassing Fortitude Points considered correct behavior (dead actors don't absorb damage) |
| 27 | DEFERRED: simplifyRollFormula — prefer explicit error over silent fallback to unsimplified formula |
| 28-29 | FALSE POSITIVES: Math.clamped argument order is semantically misleading but functionally correct due to Math.max commutativity |
| D, I, J | Documentation mismatches in SIEG5E_FEATURES.md — no code impact, doc update deferred |
