# Foundry VTT Ruler Synchronization Mechanism

## Overview
When a client uses the Ruler tool to measure distances, Foundry automatically syncs the ruler display to other connected clients via the user activity broadcast system.

## Actual Data Flow

### Sender Side
1. User drags mouse while using Ruler tool
2. `Canvas._onMouseMove(event)` is triggered
3. Ruler state is serialized: `this.ruler.toJSON()` → `{ class, name, waypoints, destination, _state }`
4. Activity broadcast: `game.user.broadcastActivity({ cursor, ruler })`

### Network
- Data is sent via Foundry's socket to all connected clients

### Receiver Side
1. `UserActivity._handleUserActivity(userId, activityData)` receives the data
2. At line 15714-15715: checks if `"ruler" in activityData`
3. Calls `canvas.controls.updateRuler(user, activityData.ruler)`
4. `Controls.updateRuler()` (line 32162) gets or creates the user's Ruler instance
5. Calls `ruler.update(rulerData)` to apply the state
6. `Ruler.update()` (line 32829) sets waypoints, state, creates labels, and calls `measure()`

```
Client A (Sender)              Server              Client B (Receiver)
     |                            |                       |
     | (1) Mouse move with        |                       |
     |    ruler active            |                       |
     v                            |                       |
Canvas._onMouseMove()            |                       |
     |                            |                       |
     v                            |                       |
ruler.toJSON() ------> broadcastActivity({ruler: ...})   |
     |                            |                       |
     |                            v                       |
     |                     [Socket emit]                |
     |                            |                       |
     |                            | v                    |
     |                            |     UserActivity._handleUserActivity()
     |                            |           |
     |                            |           v           |
     |                            |  canvas.controls.updateRuler(user, rulerData)
     |                            |           |
     |                            |           v           |
     |                            |  Ruler.update(rulerData)
     |                            |           |
     |                            |           v           |
     |                            |  (Re-render ruler with new state)
```

## Key Methods (from foundry.js)

### Canvas._onMouseMove(event)
**Location**: `foundry.js:32065`

- **Purpose**: Called on every mouse move over the canvas
- **Ruler behavior**:
  - Checks `game.user.hasPermission("SHOW_RULER")`
  - Serializes ruler via `this.ruler.toJSON()`
  - Broadcasts via `game.user.broadcastActivity({ cursor, ruler })`

### Ruler.toJSON()
**Location**: `foundry.js:32813`

- **Purpose**: Serializes ruler state for network broadcast
- **Returns**: `{ class: "Ruler", name: "Ruler.{userId}", waypoints, destination, _state }`

### UserActivity._handleUserActivity(userId, activityData)
**Location**: `foundry.js:15660`

- **Purpose**: Handles incoming activity data from other users
- **Ruler handling** (lines 15714-15715):
  ```javascript
  if ( "ruler" in activityData ) {
    canvas.controls.updateRuler(user, activityData.ruler);
  }
  ```

### Controls.updateRuler(user, rulerData)
**Location**: `foundry.js:32162`

- **Purpose**: Updates the Ruler display for a specific user
- **Parameters**:
  - `user`: The User whose ruler to update
  - `rulerData`: Ruler data object or null to clear

### Ruler.update(data)
**Location**: `foundry.js:32829`

- **Purpose**: Applies received ruler data to local Ruler instance
- **Parameters**:
  - `data`: RulerData object from sender
- **Internal behavior**:
  - Sets `this.waypoints = data.waypoints`
  - Sets `this._state = data._state`
  - Ensures label children exist
  - Calls `this.measure(data.destination)` to render

### Ruler.measure(destination, { gridSpaces = true })
**Location**: `foundry.js:32393`

- **Purpose**: Main measurement function - computes distance and renders the ruler
- **Parameters**:
  - `destination`: PIXI.Point - the target point to measure to
  - `gridSpaces`: boolean - whether to restrict to grid spaces

## Synchronization Architecture

### What Gets Synced
- `waypoints`: Array of PIXI.Point objects
- `destination`: PIXI.Point
- `_state`: number (Ruler.STATES enum: INACTIVE=0, STARTING=1, MEASURING=2, MOVING=3)

### What Does NOT Get Synced
- Any custom properties on waypoints
- Any properties added to the Ruler instance (e.g., this system's `segmentElevations`)

### Broadcast Frequency
- Ruler data is broadcast on every mouse move event while the ruler is active
- This happens in `Canvas._onMouseMove()` which fires continuously during drag operations

## Elevation Sync Implementation

**This system implements elevation sync between connected clients.**

The native Ruler mechanism only syncs waypoints, destination, and state - not elevation data. This system adds elevation sync via:

### 1. Patch: Ruler.toJSON
Adds `segmentElevations` array to the serialized ruler data:
```javascript
Ruler.prototype.toJSON = function() {
  const data = originalToJSON.call(this);
  data.segmentElevations = this.segmentElevations || [0];
  return data;
};
```

### 2. Mouse Wheel Handler
After adjusting elevation, broadcasts the full ruler state:
```javascript
game.user.broadcastActivity({ ruler: ruler.toJSON() });
```

### 3. Patch: Ruler.update
On receiving client, restores elevation data before calling original update:
```javascript
Ruler.prototype.update = function(data) {
  if (data.segmentElevations) {
    this.segmentElevations = data.segmentElevations;
    globalThis.__remoteRulerWithElevation = this;
  }
  // ... force re-render
};
```

### 4. Remote Ruler Elevation Lookup
When measuring, we must use the remote ruler's elevation (not local ruler):
```javascript
// __remoteRulerWithElevation is set in update() patch
if (globalThis.__remoteRulerWithElevation) {
  ruler = globalThis.__remoteRulerWithElevation;
}
```

### Data Flow (Sender → Receiver)
1. **Sender**: Wheel event → adjust segmentElevations → broadcastActivity({ ruler: ruler.toJSON() })
2. **Receiver**: UserActivity._handleUserActivity → Controls.updateRuler → Ruler.update(data)
3. **Receiver**: update() restores segmentElevations and stores ruler for measurement
4. **Receiver**: measureDistancesWithElevation reads remote ruler's segmentElevations

## How This System Adds Elevation

### Patch: Ruler._getSegmentLabel
Modifies the label to show cumulative elevation:
```javascript
// Original returns "25ft"
// Patched returns "25ft | ↑20ft" when there's elevation
```

### Patch: Ruler.clear
Resets `segmentElevations` array when ruler is cleared.

### Patch: Ruler._removeWaypoint
Removes elevation slot when a waypoint is removed via right-click.

### Patch: Ruler.moveToken
After token movement completes, applies cumulative elevation to the token:
```javascript
const cumulativeElevation = this.segmentElevations?.reduce((a, b) => a + b, 0) || 0;
// Apply to token.document.elevation, rounded to nearest 5ft
```

### Mouse Wheel Handler
Adjusts the current (last) segment's elevation by ±1 grid unit per scroll.

### measureDistancesWithElevation
Intercepts `canvas.grid.measureDistances` to apply elevation to distance calculations based on diagonal movement rules (EUCL, 5105, 555).

## Relevant Source Files
- `docs/foundry.js` - Core Foundry implementation
  - Ruler class: lines 32278-32844
  - Canvas._onMouseMove: line 32065
  - UserActivity._handleUserActivity: line 15660
  - Controls.updateRuler: line 32162
- `module/canvas/ruler-elevation.mjs` - This system's elevation implementation
- `dnd5e.mjs` - Entry point that initializes ruler elevation on canvasReady