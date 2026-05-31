# Group Check — Technical Reference

## Overview

Real-time group skill check system. GM picks a skill, players roll normally, first roll per actor is auto-captured, GM ends the check to post an averaged result to chat. No player-side UI changes.

---

## Architecture

### Communication

| Method | Purpose |
|--------|---------|
| `game.socket.emit("system.dnd5e", data)` | Cross-client transport (start, result, end) |
| `Hooks.callAll("dnd5e.rollSkill", actor, roll, skillId)` | Roll capture — fires on roller's client only |
| World setting `dnd5e.activeGroupCheck` | Persistent state across reloads (scope: world, config: false) |

### Socket Message Schema

| Operation | From | To | Payload |
|-----------|------|----|---------|
| `start` | GM | All | `{ operation, checkId, skill, ability }` |
| `result` | Player | GM | `{ operation, checkId, actorId, actorName, total }` |
| `end` | GM | All | `{ operation, checkId }` |

**Note:** `game.socket.emit()` sends to **all other clients** (not the sender). GM self-rolls (for NPCs) bypass socket — call `submitResult()` directly.

### Active Check State Shape

```js
activeCheck = {
  id: "uuid",              // foundry.utils.randomID()
  skill: "prc",            // key from DND5E.skills
  ability: "wis",          // DND5E.skills[skill].ability
  results: {               // keyed by actorId for O(1) dedup
    "actorId1": { name: "Gandalf", total: 15 },
    "actorId2": { name: "Legolas", total: 12 }
  }
}
```

---

## Data Flow

```
GM clicks canvas button → opens window → selects skill → Start Check

  ├─ Persist world setting: dnd5e.activeGroupCheck
  ├─ Socket emit: { operation: "start", checkId, skill, ability }
  ├─ Hooks.callAll("dnd5e.groupCheckStart", activeCheck)
  └─ Tally window opens (Waiting state)

Players receive socket → store activeCheck locally
  └─ Hooks.callAll("dnd5e.groupCheckStart", activeCheck)

Player rolls normally (sheet button, macro, inline link)
  ├─ dnd5e.rollSkill(actor, roll, skillId) fires on roller's client
  ├─ Guards: activeCheck exists, skillId matches, actor not yet in results, OWNER permission
  │   ├─ Player → socket emit { operation: "result", actorId, actorName, total }
  │   └─ GM (NPC roll) → submitResult() direct
  └─ Roll posts to chat normally (roll.toMessage already called by actor.rollSkill)

GM receives result → submitResult() → tally window refreshes
  ├─ Table fills live with actor name + total
  └─ DM can edit any cell inline to fix mistakes

GM clicks End Check

  ├─ average = Math.floor(sum / count)
  ├─ ChatMessage.create() with rendered result-card.hbs
  ├─ Clear world setting
  ├─ Socket emit: { operation: "end", checkId }
  ├─ Hooks.callAll("dnd5e.groupCheckEnd", activeCheck)
  └─ activeCheck = null

GM clicks Cancel

  ├─ Same as End Check but skips ChatMessage
  ├─ Clears state, notifies players, closes window
  └─ No chat card posted
```

---

## Key Files

| File | Role |
|------|------|
| `module/canvas/group-check.mjs` | GroupCheckManager — core logic (start, submitResult, updateResult, end, cancel, socket handler, roll hook) |
| `module/applications/group-check.mjs` | GroupCheckApplication — singleton tally window UI |
| `templates/group-check/application.hbs` | Tally window template (skill select, live table, waiting state, End/Cancel) |
| `templates/group-check/result-card.hbs` | Chat card template (average headline, breakdown table, metadata) |
| `lang/en.json` | 13 localization keys under `DND5E.GroupCheck*` |
| `module/settings.mjs` | Registers `activeGroupCheck` world setting |
| `module/canvas/_module.mjs` | Re-exports GroupCheckManager |
| `module/applications/_module.mjs` | Re-exports GroupCheckApplication |
| `dnd5e.mjs` | Wiring: imports, init hook (socket listener), ready hook (state restore), top-level hooks (canvas button, roll capture) |

---

## Important Behaviors

### Circular Import
`canvas/group-check.mjs` ↔ `applications/group-check.mjs` is a circular import. Safe because all cross-references are inside method bodies, never at module scope. Both files carry a warning comment.

### Singleton
GroupCheckApplication uses a private static `#instance` field. `getInstance()` creates on first call, returns cached thereafter. Prevents duplicate tally windows.

### First-Roll-Only
`submitResult()` checks `activeCheck.results[actorId]` and skips if already present. A player rolling twice for the same skill — only first is captured.

### Actor Ownership Guard
`_onRollSkill()` checks `actor.testUserPermission(game.user, "OWNER")`. Prevents players from submitting rolls for other players' characters.

### Zero-Participant Guard
`end()` checks `entries.length === 0` and returns early with a warning notification. No empty chat card is posted.

### State Recovery (all clients)
`ready` hook restores active check from world setting for ALL clients (before the GM guard). GM clients auto-open tally; non-GM clients restore silently so next correct-skill roll is captured.

### Window Lifecycle
- `start()` opens tally, `end()`/`cancel()` close it
- X button close does NOT end the check — it only hides the window. Canvas button reopens it.
- Cancel clears state (unlike X close) — no chat card posted

### Canvas Control Button
The Group Check button is pushed into the existing `"token"` control group's `tools` array (not a separate control group). This avoids a `layer` conflict where activating `canvas.tokens.activate()` would reset the active control.

---

## Hooks

| Hook | Payload | Fires |
|------|---------|-------|
| `dnd5e.groupCheckStart` | `activeCheck` | When check begins (GM start + all clients via socket) |
| `dnd5e.groupCheckEnd` | `activeCheck` | When check ends (GM end/cancel + all clients via socket) |

---

## Known Limitations

- **No NPC mass-roll shortcut**: GMs running multiple identical NPCs (e.g. 5 goblins) must click each sheet individually.
