# Group Check Feature — Implementation Plan

## Overview
A real-time group skill check system for dnd5e (Sieg5e). The GM initiates a check for a specific skill, any player's roll for that skill is auto-captured (first roll per actor), and the GM finalizes it in a tally window to get an averaged group result. No special sheet buttons needed — players just roll normally.

## Architecture

### Communication
- **Sockets** (`game.socket.emit("system.dnd5e", data)`) for cross-client transport
- **Existing hook** (`dnd5e.rollSkill`) for capturing roll results — fires with `(actor, roll, skillId)`
- **World setting** (`dnd5e.activeGroupCheck`) for persistent state across reloads

### Socket Message Schema
| `operation` | From | To | Payload |
|---|---|---|---|
| `start` | GM | All | `{ operation:"start", checkId, skill, ability }` |
| `result` | Player | GM | `{ operation:"result", checkId, actorId, actorName, total }` |
| `end` | GM | All | `{ operation:"end", checkId }` |

**Important**: `game.socket.emit()` sends to **all other clients** (not the sender). The GM's own rolls (for NPCs) bypass the socket and call `submitResult()` directly — see 1.3.

### Active Check State Shape
```js
activeCheck = {
  id: "uuid",           // unique check identifier (foundry.utils.randomID())
  skill: "prc",         // skill key from DND5E.skills
  ability: "wis",       // skill's governing ability: DND5E.skills[skill].ability
  results: {            // keyed by actorId — object not array for O(1) dedup
    "actorId1": { name: "Gandalf", total: 15 },
    "actorId2": { name: "Legolas", total: 12 }
  }
}
```

### Data Flow
```
GM clicks canvas button → opens window → selects skill → Start
  ├─ Saves world setting: dnd5e.activeGroupCheck  (JSON.stringify)
  ├─ Socket emit: { operation: "start", checkId, skill, ability }
  ├─ Hooks.callAll("dnd5e.groupCheckStart", activeCheck)
  └─ Tally window shows [Waiting...]

Players receive socket → activeCheck stored locally
  └─ Hooks.callAll("dnd5e.groupCheckStart", activeCheck)  (on each client)

Player rolls normally (skill button, macro, inline link)
  ├─ dnd5e.rollSkill(actor, roll, skillId) hook fires on roller's client only
  ├─ Guard: activeCheck exists AND skillId matches AND actor not yet in results
  │   ├─ Player client → socket emit { operation:"result", checkId, actorId, actorName, total }
  │   └─ GM client (if GM rolled for NPC) → submitResult() directly
  └─ Roll posts to chat as normal (roll.toMessage already called by actor.rollSkill)

GM receives result → GroupCheckManager.submitResult() → tally window.refresh()
  ├─ [Gandalf: 15] [Legolas: 12] [Gimli: 18]  (actor names)
  ├─ DM can edit any cell inline to fix mistakes
  └─ Running count displayed

GM clicks "End Check"
  ├─ average = sum(totals) / count  (Math.round or keep float — your call)
  ├─ ChatMessage.create() with rendered result-card.hbs
  ├─ Clear world setting (set to null)
  ├─ Socket emit: { operation: "end", checkId }
  └─ Hooks.callAll("dnd5e.groupCheckEnd", activeCheck)
```

---

## Task List

### Phase 1: Core Module (`module/canvas/group-check.mjs`)

**Depends on**: Nothing (standalone module)
**Exports**: `GroupCheckManager`

- [X] **1.1 Create GroupCheckManager class**
  - **Circular import note at top of file**: `// GroupCheckManager ↔ GroupCheckApplication is a circular import.`
    `// ES live bindings make it safe ONLY if no cross-references at module scope.`
  - **Static state**: `activeCheck` (null or the shape from Architecture above)
  - **`static start(skillId)`**
    - GM-only guard: `if ( !game.user.isGM ) return`
    - `const ability = CONFIG.DND5E.skills[skillId].ability`
    - `const checkId = foundry.utils.randomID()`
    - Build `activeCheck = { id: checkId, skill: skillId, ability, results: {} }`
    - Persist: `game.settings.set("dnd5e", "activeGroupCheck", activeCheck)`
    - Socket: `game.socket.emit("system.dnd5e", { operation: "start", checkId, skill: skillId, ability })`
    - Hook: `Hooks.callAll("dnd5e.groupCheckStart", activeCheck)`
    - Auto-open tally: `GroupCheckApplication.getInstance().render(true)`
  - **`static submitResult(actorId, actorName, total)`**
    - Null guard: `if ( !GroupCheckManager.activeCheck ) return;`
    - GM-only guard: `if ( !game.user.isGM ) return;`
    - Skip if `activeCheck.results[actorId]` exists (first-roll-only)
    - Set `activeCheck.results[actorId] = { name: actorName, total }`
    - Persist world setting
    - Refresh tally: `GroupCheckApplication.getInstance().refresh()`
  - **`static updateResult(actorId, newTotal)`**
    - Null guard: `if ( !GroupCheckManager.activeCheck ) return;`
    - GM-only guard: `if ( !game.user.isGM ) return;`
    - If `activeCheck.results[actorId]` exists, overwrite its total
    - Persist world setting
  - **`static async end()`**
    - Null guard: `if ( !GroupCheckManager.activeCheck ) return;`
    - GM-only guard: `if ( !game.user.isGM ) return;`
    - `const entries = Object.values(activeCheck.results)`
    - `const count = entries.length`
    - If count === 0: `ui.notifications.warn(game.i18n.localize("DND5E.GroupCheckNoParticipants")); return;`
    - `const sum = entries.reduce((acc, r) => acc + r.total, 0)`
    - `const average = count > 0 ? Math.round(sum / count) : 0`
    - Get skill label: `game.i18n.localize(CONFIG.DND5E.skills[activeCheck.skill].label)`
    - Render template:
      ```js
      const content = await renderTemplate("systems/dnd5e/templates/group-check/result-card.hbs", {
        skillLabel,
        entries: entries.map(e => ({ name: e.name, total: e.total })),
        average, sum, count
      });
      ```
    - `ChatMessage.create({ content, flavor: skillLabel, speaker: ChatMessage.getSpeaker({ alias: game.i18n.localize("DND5E.GroupCheck") }) })`
    - Clear world setting: `await game.settings.set("dnd5e", "activeGroupCheck", null)`
    - Socket: `game.socket.emit("system.dnd5e", { operation: "end", checkId: activeCheck.id })`
    - Hook: `Hooks.callAll("dnd5e.groupCheckEnd", activeCheck)`
    - `GroupCheckApplication.getInstance()?.close()`
    - Set `GroupCheckManager.activeCheck = null`
  - **`static cancel()`**
    - Null guard: `if ( !GroupCheckManager.activeCheck ) return;`
    - GM-only guard: `if ( !game.user.isGM ) return;`
    - Same as end() but skips ChatMessage creation
    - Steps: clear world setting → socket emit end → hook dnd5e.groupCheckEnd → close tally → set activeCheck = null
  - **`static restoreFromSetting(data)`**
    - Set `activeCheck = data`
    - If GM: auto-open tally window

- [X] **1.2 Socket handler (static method)**
  - **`static _onSocketMessage(data)`**
    - Switch on `data.operation`:
    - **`start`**: (non-GM only — GM already has state from `start()`)
      - `if ( game.user.isGM ) return`
      - Set `GroupCheckManager.activeCheck = { id: data.checkId, skill: data.skill, ability: data.ability, results: {} }`
      - `Hooks.callAll("dnd5e.groupCheckStart", GroupCheckManager.activeCheck)`
    - **`result`**: (GM only)
      - `if ( !game.user.isGM ) return`
      - `GroupCheckManager.submitResult(data.actorId, data.actorName, data.total)`
    - **`end`**: (non-GM only)
      - `if ( game.user.isGM ) return;`
      - `const endedCheck = GroupCheckManager.activeCheck;`
      - `GroupCheckManager.activeCheck = null;`
      - `Hooks.callAll("dnd5e.groupCheckEnd", endedCheck);`

- [X] **1.3 Roll capture via existing hook (static method)**
  - **`static _onRollSkill(actor, roll, skillId)`**
    ```js
    static _onRollSkill(actor, roll, skillId) {
      const check = GroupCheckManager.activeCheck;
      if ( !check ) return;
      if ( skillId !== check.skill ) return;
      if ( check.results[actor.id] ) return;  // first-roll-only
      if ( !actor.testUserPermission(game.user, "OWNER") ) return;

      const total = roll.total;  // numeric evaluated result
      const actorName = actor.name;

      if ( game.user.isGM ) {
        GroupCheckManager.submitResult(actor.id, actorName, total);
      } else {
        game.socket.emit("system.dnd5e", {
          operation: "result",
          checkId: check.id,
          actorId: actor.id,
          actorName,
          total
        });
      }
    }
    ```

- [X] **1.4 State accessors (static methods)**
  - `static getActiveCheck()` → returns `activeCheck` or null
  - `static isActive()` → returns `activeCheck !== null`
  - `static getSkillLabel()` → if active, returns localized skill label string

### Phase 2: Group Check Tally Window (`module/applications/group-check.mjs`)

**Depends on**: Phase 1 (references GroupCheckManager)
**Exports**: `GroupCheckApplication` (default)

- [X] **2.1 Create GroupCheckApplication class**
  - **Circular import note at top of file**: `// GroupCheckApplication ↔ GroupCheckManager is a circular import.`
    `// ES live bindings make it safe ONLY if no cross-references at module scope.`
  - Extends `Application`
  - Template: `"systems/dnd5e/templates/group-check/application.hbs"`
  - Title: `game.i18n.localize("DND5E.GroupCheck")`
  - Singleton pattern:
    ```js
    static #instance = null;
    static getInstance() {
      if ( !GroupCheckApplication.#instance ) {
        GroupCheckApplication.#instance = new GroupCheckApplication();
      }
      return GroupCheckApplication.#instance;
    }
    ```
  - Override `render(force, options)` to only render for GM:
    ```js
    render(force=false, options={}) {
      if ( !game.user?.isGM ) return this;
      return super.render(force, options);
    }
    ```

- [X] **2.2 `getData()` method**
  ```js
  getData() {
    const check = GroupCheckManager.getActiveCheck();
    if ( !check ) {
      return {
        active: false,
        skills: Object.entries(CONFIG.DND5E.skills).map(([k, v]) => ({
          key: k, label: game.i18n.localize(v.label)
        }))
      };
    }
    const entries = Object.entries(check.results).map(([id, r]) => ({
      id, name: r.name, total: r.total
    }));
    return {
      active: true,
      skillLabel: game.i18n.localize(CONFIG.DND5E.skills[check.skill]?.label ?? ""),
      entries,
      count: entries.length,
      hasEntries: entries.length > 0
    };
  }
  ```

- [X] **2.3 `activateListeners(html)` method**
  - Find `.start-check` button → `_onStartCheck`
  - Find `.end-check` button → `_onEndCheck`
  - Find `.cancel-check` button → `_onCancel`
  - Find `input[data-actor-id]` → `on change` / `on blur` → `_onEditResult`

- [X] **2.4 Event handlers**
  - **`_onStartCheck(event)`**: read `html.find("select[name='skill']").val()`, call `GroupCheckManager.start(skillId)`
  - **`_onEndCheck(event)`**: call `GroupCheckManager.end()`
  - **`_onCancel(event)`**: call `GroupCheckManager.cancel()`
  - **`_onEditResult(event)`**: read `event.currentTarget.dataset.actorId` and `Number(event.currentTarget.value)`, call `GroupCheckManager.updateResult(actorId, newTotal)` — must parse to number, `<input>` returns string

- [X] **2.5 `refresh()` method**
  ```js
  refresh() {
    if ( this.rendered ) this.render(true);
  }
  ```
  - Register hooks in constructor:
    ```js
    Hooks.on("dnd5e.groupCheckStart", () => this.refresh());
    Hooks.on("dnd5e.groupCheckEnd", () => this.refresh());
    ```

### Phase 3: — (No sheet modifications needed)

Players roll normally via existing skill buttons, macros, or inline links. No changes to character or NPC sheet templates or handlers.

### Phase 4: Templates & Localization

**Depends on**: Nothing (can be done in parallel with Phase 1-2)

- [X] **4.0 Create templates directory** — `mkdir templates/group-check/` (does not exist yet)
- [X] **4.1 Tally window template** — `templates/group-check/application.hbs`
  ```hbs
  <form autocomplete="off">
  {{#if active}}
    <h2>{{localize "DND5E.GroupCheck"}}: {{skillLabel}}</h2>
    {{#if hasEntries}}
    <table>
      <thead>
        <tr>
          <th>{{localize "DND5E.GroupCheckActor"}}</th>
          <th>{{localize "DND5E.GroupCheckRoll"}}</th>
        </tr>
      </thead>
      <tbody>
      {{#each entries}}
        <tr>
          <td>{{this.name}}</td>
          <td><input type="number" data-actor-id="{{this.id}}" value="{{this.total}}"></td>
        </tr>
      {{/each}}
      </tbody>
    </table>
    <p>{{localize "DND5E.GroupCheckParticipants"}}: {{count}}</p>
    {{else}}
    <p>{{localize "DND5E.GroupCheckWaiting"}}</p>
    {{/if}}
    <button class="end-check">{{localize "DND5E.GroupCheckEnd"}}</button>
    <button class="cancel-check">{{localize "DND5E.GroupCheckCancel"}}</button>
  {{else}}
    <p>{{localize "DND5E.GroupCheckPrompt"}}</p>
    <select name="skill">
      {{#each skills}}
      <option value="{{this.key}}">{{this.label}}</option>
      {{/each}}
    </select>
    <button class="start-check">{{localize "DND5E.GroupCheckStart"}}</button>
  {{/if}}
  </form>
  ```

- [X] **4.2 Result card template** — `templates/group-check/result-card.hbs`
  ```hbs
  <h2>{{localize "DND5E.GroupCheckResult"}}: {{skillLabel}}</h2>
  <table>
      <thead>
        <tr>
          <th>{{localize "DND5E.GroupCheckActor"}}</th>
          <th>{{localize "DND5E.GroupCheckRoll"}}</th>
        </tr>
      </thead>
      <tbody>
      {{#each entries}}
        <tr>
          <td>{{this.name}}</td>
          <td>{{this.total}}</td>
        </tr>
      {{/each}}
      </tbody>
    </table>
    <hr>
    <p><strong>{{localize "DND5E.GroupCheckAverage"}}:</strong> {{average}}</p>
    <p><strong>{{localize "DND5E.GroupCheckTotal"}}:</strong> {{sum}}  |  <strong>{{localize "DND5E.GroupCheckParticipants"}}:</strong> {{count}}</p>
  ```

- [X] **4.3 Localization** — `lang/en.json`
  Add to the `DND5E` object:
  ```json
  "GroupCheck": "Group Check",
  "GroupCheckStart": "Start Check",
  "GroupCheckEnd": "End Check",
  "GroupCheckCancel": "Cancel",
  "GroupCheckPrompt": "Select a skill for the group check",
  "GroupCheckResult": "Group Check Results",
  "GroupCheckActor": "Actor",
  "GroupCheckRoll": "Roll",
  "GroupCheckAverage": "Average",
  "GroupCheckTotal": "Total",
  "GroupCheckParticipants": "Participants",
  "GroupCheckWaiting": "Waiting for participants...",
  "GroupCheckButtonHint": "Group Check",
  "GroupCheckNoParticipants": "No participants have rolled yet."
  ```

### Phase 5: Registration & Wiring

**Depends on**: Phases 1, 2, 4

- [X] **5.1 World setting registration** — `module/settings.mjs`
  Add inside `registerSystemSettings()`, after the existing settings (e.g., after the `diagonalMovement` block, before the function ends):
  ```js
  // Group Check active state
  game.settings.register("dnd5e", "activeGroupCheck", {
    scope: "world",
    config: false,
    type: Object,
    default: null
  });
  ```

- [X] **5.2 Imports** — `dnd5e.mjs`
  Add after line 24 (`import {ModuleArt} ...`):
  ```js
  import {GroupCheckManager} from "./module/canvas/group-check.mjs";
  import GroupCheckApplication from "./module/applications/group-check.mjs";
  ```

- [X] **5.3 Init hook additions** — `dnd5e.mjs` lines 46-136
  Inside `Hooks.once("init", ...)`, after line 135 (`enrichers.registerCustomEnrichers();`):
  ```js
  // Register group check socket listener
  game.socket.on("system.dnd5e", GroupCheckManager._onSocketMessage);
  ```

- [X] **5.4 Top-level hooks** — `dnd5e.mjs` "Other Hooks" section (after line 433)
  Add:
  ```js
  // Group check roll capture
  Hooks.on("dnd5e.rollSkill", GroupCheckManager._onRollSkill);

  // Canvas control button
  Hooks.on("getSceneControlButtons", controls => {
    const tokenControls = controls.find(c => c.name === "token");
    if ( !tokenControls ) return;
    tokenControls.tools.push({
      name: "groupcheck",
      title: game.i18n.localize("DND5E.GroupCheck"),
      icon: "fas fa-users",
      button: true,
      onClick: () => {
        const app = GroupCheckApplication.getInstance();
        if ( app.rendered ) app.close();
        else app.render(true);
      }
    });
  });
  ```

- [X] **5.5 Ready hook addition** — `dnd5e.mjs` ready hook
  Insert **before** line 316 (`if ( !game.user.isGM ) return;`) — must run for ALL clients (non-GM reconnect):
  ```js
  // Restore active group check state (all clients — non-GM may have disconnected mid-check)
  const savedCheck = game.settings.get("dnd5e", "activeGroupCheck");
  if ( savedCheck ) {
    GroupCheckManager.restoreFromSetting(savedCheck);
  }
  ```
  Note: non-GM clients restore state silently (tally window stays closed). GM clients auto-open tally via `restoreFromSetting()`.
  This runs before migration logic to ensure state is available during GM migration if needed.

- [X] **5.6 Canvas module export** — `module/canvas/_module.mjs`
  Add export:
  ```js
  export {GroupCheckManager} from "./group-check.mjs";
  ```

- [X] **5.7 Applications module export** — `module/applications/_module.mjs`
  Add export:
  ```js
  export {default as GroupCheckApplication} from "./group-check.mjs";
  ```

### Phase 6: Polish & Edge Cases

**Depends on**: Phases 1-5 complete

- [X] **6.1 Duplicate roll prevention**
  - Already handled in `submitResult()` — checks `activeCheck.results[actorId]` and skips if exists
  - Still worth testing: rapid double-click, two skills with same ability, etc.

- [X] **6.2 Actor ownership guard**
  - Already handled in `_onRollSkill()` — `actor.testUserPermission(game.user, "OWNER")`
  - Prevents players from rolling for other players' characters

- [X] **6.3 Stale state recovery (all clients)**
  - Handled in `ready` hook (5.5) — restores active check from world setting for ALL clients
  - GM disconnect/reconnect: restores state + auto-opens tally window
  - Non-GM disconnect/reconnect: restores state silently → next roll for the correct skill is captured
  - Edge case: world setting was cleared (GM ended check) but stale socket message arrives after — covered by null guards in C1

- [X] **6.4 Window lifecycle**
  - `end()` and `cancel()` close the tally window
  - `start()` opens the tally window
  - Singleton prevents duplicate windows
  - Closing via X button does NOT end the check — default `close()` only hides window, check remains active. Canvas button reopens it.
  - Do NOT override `close()` to cancel — suppress the instinct; GM expects window to reappear on canvas button click

- [X] **6.5 Lint & verify**
  - Run `npm run lint` and fix any issues
  - Run `npm run build` to ensure no compilation errors

---

## Pre-Flight Concerns (from code review)

Address these before or during implementation. Mark each [X] when resolved.

### Critical

- [X] **C1. Null-guard every method in GroupCheckManager** — `submitResult()`, `updateResult()`, `end()`, `cancel()` all assume `activeCheck` is non-null. If a stale socket result arrives after the check ended, `activeCheck.results[actorId]` throws TypeError. Add `if ( !GroupCheckManager.activeCheck ) return;` as first line in all four.

- [X] **C2. Non-GM reconnect loses state** — Ready hook restore code (5.5) sits **after** the `if ( !game.user.isGM ) return;` guard (line 316). A player who refreshes mid-check never restores `activeCheck` → their rolls silently go uncaptured. Fix: move restore BEFORE line 316 (all clients), let `restoreFromSetting()` open tally only for GM.

- [X] **C3. Circular import between GroupCheckManager & GroupCheckApplication** — `canvas/group-check.mjs` imports `GroupCheckApplication` (for `.getInstance()`); `applications/group-check.mjs` imports `GroupCheckManager` (for `.getActiveCheck()`). ES live bindings make this work if all cross-references are inside method bodies (never at module scope). Add a comment in both files warning against top-level cross-references.

### Medium

- [X] **C4. `_onSocketMessage("end")` passes `null` to hook instead of the ended check** — GM calls `Hooks.callAll("dnd5e.groupCheckEnd", activeCheck)`; non-GM via socket calls `Hooks.callAll("dnd5e.groupCheckEnd", null)`. Fix: capture `activeCheck` before clearing and pass it.

- [X] **C5. Canvas control titles not localized** — Foundry does NOT auto-localize canvas button titles. `title: "DND5E.GroupCheckButtonHint"` renders as literal text. Wrap all canvas titles with `game.i18n.localize("...")`. (Fixed by using `tokenControls.tools.push()` pattern — title is wrapped in `game.i18n.localize()`).

- [X] **C6. `game.settings.set()` not awaited in `end()`** — `end()` is `async` but the world-setting clear (`game.settings.set("dnd5e", "activeGroupCheck", null)`) isn't awaited before the socket emit. Remote clients could get the socket "end" before the setting is persisted. Add `await`.

- [X] **C7. Empty results table hides "Waiting..." message** — Localization key `GroupCheckWaiting` exists but is never rendered. The tally template shows a table with only headers when `entries` is empty. Add `{{#if entries.length}}{{else}}<p>{{localize "DND5E.GroupCheckWaiting"}}</p>{{/if}}` in the template. Update `getData()` to pass `hasEntries`.

### Minor

- [X] **C8. `GroupCheckApplication.getInstance()?.refresh()` in `submitResult()` uses optional chaining unnecessarily** — `getInstance()` always returns an instance (creates one if missing). The `?.` is harmless but misleading. Can keep or drop.

- [X] **C9. No NPC mass-roll shortcut** — GM running 5 identical goblins must click each sheet 5 times. Out of scope for v1 but worth documenting as a known limitation.

- [X] **C10. Import syntax ambiguity in 5.2** — `import {GroupCheckApplication}` assumes named export, but Phase 2 uses default export. Must be `import GroupCheckApplication from "..."` (no braces) for the source file import. The `_module.mjs` re-export `export {default as GroupCheckApplication}` is correct.

### Task-Level Fixes (linked to existing tasks)

| Concern | Affected Task(s) | Fix |
|---------|-----------------|-----|
| C1 | 1.1 (submitResult, updateResult, end, cancel) | Add null guard to each |
| C2 | 5.5 (ready hook) | Move restore before line 316 |
| C3 | 1.1, 2.1 | Add comment about circular import in both files |
| C4 | 1.2 (_onSocketMessage case "end") | Capture check before clearing, pass to hook |
| C5 | 5.4 (canvas button titles) | Use `tokenControls.tools.push()` instead of new control group; wrap titles in `game.i18n.localize()` |
| C6 | 1.1 (end method) | Add `await` before world setting clear |
| C7 | 4.1 (tally template), 2.2 (getData) | Add waiting state to template and data |
| C8 | 1.1 (submitResult) | No change needed (cosmetic) |
| C9 | — | Document in limitations |
| C10 | 5.2 (imports) | Remove braces from GroupCheckApplication import |

---

## Acceptance Criteria (manual verification)

Check these before closing the feature branch. Mark [X] when passed.

### Phase 1 — Core Module
- [X] **A1. Null guards work** — End a check, then send a stale result via socket → no crash, no error in console
- [X] **A2. Socket handler dispatches correctly** — start → non-GM sets activeCheck; result → GM calls submitResult; end → non-GM clears activeCheck

### Phase 2 — Tally Window
- [X] **A3. Singleton works** — Opening window twice returns same instance (no duplicate renders)
- [X] **A4. Non-GM sees nothing** — Player cannot open or view the tally window
- [X] **A5. Waiting state** — Start check, no participants yet → window shows "Waiting for participants..."
- [X] **A6. Inline editing** — Edit a cell in the tally → value persists after refresh/reopen

### Phase 4 — Templates
- [X] **A7. Result card renders** — End check with 1+ participants → chat card shows table + average + total + count
- [X] **A8. Zero participants blocked** — End check with 0 participants → notification "No participants have rolled yet." → check remains active

### Phase 5 — Wiring
- [X] **A9. Canvas button toggles window** — Click opens if closed, closes if open; visible only to GM
- [X] **A10. Player reconnect** — Player refreshes mid-check, rolls the skill → roll is captured (restored from world setting)

### Phase 6 — Polish
- [X] **A11. Duplicate roll ignored** — Player rolls twice for same skill → only first captured
- [X] **A12. Stale message ignored** — Start check, end it, then try to send a stale result → ignored (null guard)
- [X] **A13. Cancel clears state** — Cancel check → world setting cleared, all clients reset, no chat message
- [X] **A14. X button preserves check** — Close tally via X, reopen via canvas button → check still active, new results showing
- [X] **A15. Lint + build pass** — `npm run lint` clean, `npm run build` succeeds

---

## File Inventory

### New Files
| File | Phase |
|---|---|
| `module/canvas/group-check.mjs` | 1 |
| `module/applications/group-check.mjs` | 2 |
| `templates/group-check/application.hbs` | 4 |
| `templates/group-check/result-card.hbs` | 4 |

### Modified Files
| File | Phase | Changes |
|---|---|---|
| `dnd5e.mjs` | 5 | 4 additions: import, init hook, top-level hooks, ready hook |
| `module/settings.mjs` | 5 | Add `activeGroupCheck` world setting registration |
| `module/canvas/_module.mjs` | 5 | Add GroupCheckManager export |
| `module/applications/_module.mjs` | 5 | Add GroupCheckApplication export |
| `lang/en.json` | 4 | Add 12 localization keys |

## References
- **Skills config**: `module/config.mjs` lines 120-140 (`DND5E.skills` — 18 skill entries)
- **Skill rolling**: `module/documents/actor/actor.mjs` lines 1072-1155 (`async rollSkill(skillId, options={})`)
- **Existing hook**: `dnd5e.rollSkill` at actor.mjs:1152 — fires with `(actor, roll, skillId)`
- **Socket pattern**: `dnd5e.mjs:157` — `game.socket.emit("reload")` (sends to all other clients)
- **Canvas control hook**: `getSceneControlButtons` — core Foundry, documented in docs/foundry.js
- **Settings pattern**: `module/settings.mjs` — `game.settings.register("dnd5e", ...)`
- **ChatMessage.create**: Standard Foundry API — `ChatMessage.create({ content, flavor, speaker })`
- **renderTemplate**: `renderTemplate("systems/dnd5e/templates/...", data)` — standard Foundry API
- **foundry.utils.randomID**: Generates short unique ID string
- **D20Roll.total**: Numeric evaluated roll result (standard Roll.total)
