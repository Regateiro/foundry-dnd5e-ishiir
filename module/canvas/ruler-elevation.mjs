/**
 * Ruler Elevation Module
 * Adds vertical elevation support to the Ruler measurement tool.
 *
 * Features:
 * - Mouse wheel or arrow keys (↑/↓) to adjust elevation per segment
 * - Display cumulative distance and elevation in ruler labels
 * - Apply elevation to token after movement (rounded to nearest 5ft)
 * - Support for all diagonal movement rules (555, 5105, EUCL)
 * - Sync elevation to other connected clients via broadcastActivity
 *
 * === Architecture Overview ===
 *
 * Elevation is tracked per-segment in a segmentElevations array (in grid units, not feet).
 * When measuring, we calculate 3D distance using the diagonal rule from game settings.
 *
 * For local use: segmentElevations is modified directly by the wheel handler.
 * For remote sync: segmentElevations is included in toJSON() and restored in update().
 */
import { getGridDistance } from "./grid.mjs";


/**
 * Get the active ruler if it is currently measuring. Returns null otherwise.
 * Encapsulates the "get ruler + check state" pattern shared by wheel and key bindings.
 *
 * PURPOSE: Centralized guard that all elevation-adjustment entry points (wheel handler,
 * arrow keys) use to verify a ruler measurement session is active before applying changes.
 *
 * WHY NEEDED: Without this guard, elevation adjustments could be applied when no ruler
 * is measuring, causing errors or silent failures. The _state === 2 check ensures we only
 * act during the "measuring" phase (not after placement or cancelation).
 * @returns {Ruler | null}
 */
export function getActiveRuler() {
  const ruler = canvas?.controls?.ruler;
  if (!ruler || !ruler.segments?.length || ruler._state !== 2) return null;
  return ruler;
}

/**
 * Trim or pad a ruler's `segmentElevations` array so it matches the ruler's current segment count.
 *
 * PURPOSE: Keep the per-segment elevation array aligned with `ruler.segments` after the segment
 * list changes shape — waypoints added or removed, or a remote `update()` recomputing segments
 * from incoming waypoints.
 *
 * WHY NEEDED: `segments` is rebuilt from `waypoints` on every measurement step, so the two arrays
 * can drift apart. Without this, a stale trailing elevation bleeds onto a newly created segment,
 * and `toJSON()` ships an array whose length disagrees with the ruler being drawn.
 *
 * @param {Ruler} ruler The ruler instance whose elevation array should be synchronized.
 * @returns {number[]} The synchronized elevation array.
 */
function syncSegmentElevations(ruler) {
  ruler.segmentElevations ??= [];

  // `segments` only exists once the ruler has measured at least once. Core leaves it undefined on a
  // fresh Ruler, and `_addWaypoint` runs during `_onDragStart` — i.e. before the first measure() of
  // a session, and before the first measure() after a scene change builds new Ruler instances. So
  // it can legitimately be undefined here; there is nothing to align to yet, so leave the array be.
  if ( !ruler.segments ) return ruler.segmentElevations;

  const targetLen = ruler.segments.length;
  if ( ruler.segmentElevations.length > targetLen ) ruler.segmentElevations.length = targetLen;
  while ( ruler.segmentElevations.length < targetLen ) ruler.segmentElevations.push(0);
  return ruler.segmentElevations;
}

/**
 * Adjust the current (last) ruler segment's elevation and re-render.
 * This function is called by both the mouse wheel handler and arrow key keybindings.
 *
 * PURPOSE: Mutate a single segment's elevation value in-place, then trigger a full
 * re-derender of the ruler path with updated 3D distance labels.
 *
 * WHY NEEDED: Segments need per-segment elevation tracking because a measurement path may
 * go up for one segment and down for another. A flat "ruler elevation" attribute wouldn't
 * capture this nuance. This function ensures only the tip of the ruler (where the user is
 * actively measuring) gets adjusted, while previous segments retain their values.
 *
 * @param {Ruler} ruler The active ruler instance
 * @param {number} delta Elevation change in grid units (+1 = ascend, -1 = descend)
 */
export function adjustElevation(ruler, delta) {
  // Ensure array exists and matches segments length (truncate or pad as needed)
  const segmentElevations = syncSegmentElevations(ruler);

  // Adjust only the current (last) segment - that's where the user is measuring
  const lastIndex = ruler.segments.length - 1;
  segmentElevations[lastIndex] = (segmentElevations[lastIndex] || 0) + delta;

  // Force re-render - _drawMeasuredPath will apply elevation before drawing labels
  ruler._computeDistance(true);
  ruler.ruler.clear();
  ruler._drawMeasuredPath();

  // Broadcast to other connected clients
  // This triggers the full sync flow: toJSON -> broadcastActivity -> update() on receivers
  if (game.user.hasPermission("SHOW_RULER")) {
    game.user.broadcastActivity({ ruler: ruler.toJSON() });
  }
}

/**
 * Installs patches on the Ruler class to add elevation support.
 *
 * PURPOSE: Apply 8 distinct patches to Foundry's core `Ruler` prototype to enable:
 *   (1) Serialization of segmentElevations via toJSON()
 *   (2) Deserialization via update() for remote client sync
 *   (3) Custom labels showing distance + elevation per segment
 *   (4) Reset on ruler clear()
 *   (5) Elevation slot cleanup on waypoint removal
 *   (6) Elevation slot growth on waypoint addition
 *   (7) Token elevation application after moveToken()
 *   (8) Mouse wheel event handler for real-time adjustment
 *
 * WHY NEEDED: Foundry's Ruler class has no built-in concept of vertical movement. Without these
 * patches, the ruler can only measure ground distance on a flat plane. D&D 5e combat is inherently
 * three-dimensional — creatures fly, climb walls, fight in dungeons with multiple floors — so the
 * ruler must compute 3D hypotenuse distances and track where tokens end up vertically.
 *
 * @param {object} gameCanvas The canvas instance
 */
export function installRulerPatches(gameCanvas) {
  // Install the wheel listener on this canvas view. It lives on the DOM element, so it can be
  // (re)installed whenever the canvas is rebuilt, independently of the Ruler prototype patches.
  // Guarded on the element itself so it is never added twice.
  //
  // How it works: listen for wheel events on the canvas view; if a ruler is actively measuring,
  // scroll up (deltaY < 0) ascends and scroll down descends by one grid unit. passive: false lets
  // preventDefault() stop the page from scrolling.
  const wheelView = gameCanvas.app?.view;
  if ( wheelView && !wheelView._sieg5eRulerWheel ) {
    wheelView._sieg5eRulerWheel = true;
    wheelView.addEventListener("wheel", event => {
      const ruler = getActiveRuler();
      if (!ruler) return;
      event.preventDefault();
      event.stopPropagation();
      adjustElevation(ruler, event.deltaY > 0 ? -1 : 1);
    }, { passive: false });
  }

  // Record that the installer has run against this canvas (used by callers/tests).
  gameCanvas._sieg5eRulerPatched = true;

  // Guard: patch the Ruler prototype exactly once per page session. canvasReady fires from
  // Canvas#draw() on every scene navigation, on Scene updates touching grid/dimensions, and on
  // several core setting changes — and the canvas object handed to the hook is not a dependable
  // per-page singleton marker. Every extra pass used to stack another wrapper onto the already
  // patched prototype methods, so a single measurement applied its elevation delta once per layer
  // (14 stacked `moveToken` wrappers moved a token 70ft for a "↑5ft" reading). The Ruler prototype
  // is process-wide, so guard on it instead — this also covers the case where two copies of the
  // system module are evaluated.
  if ( Ruler.prototype._sieg5eElevationPatched ) return;
  Ruler.prototype._sieg5eElevationPatched = true;

  // === Patch: Ruler.toJSON() ===
  //
  // Purpose: Include segmentElevations in the serialized ruler data.
  //
  // Why: When broadcasting ruler state via game.user.broadcastActivity(), Foundry
  // serializes the ruler using toJSON(). Without this patch, segmentElevations
  // would be lost and remote clients couldn't display the correct elevation.
  //
  // Note: We default to [0] to ensure there's always elevation data (even if unchanged).
  const originalToJSON = Ruler.prototype.toJSON;
  if (originalToJSON) {
    Ruler.prototype.toJSON = function() {
      const data = originalToJSON.call(this);
      data.segmentElevations = this.segmentElevations || [0];
      return data;
    };
  }

  // === Patch: Ruler.update() ===
  //
  // Purpose: Restore elevation data when receiving ruler state from remote user.
  //
  // Data Flow:
  // 1. Sender adjusts elevation with mouse wheel
  // 2. Sender calls broadcastActivity({ ruler: ruler.toJSON() })
  // 3. Server propagates to all clients
  // 4. Each client's UserActivity._handleUserActivity receives the data
  // 5. Calls canvas.controls.updateRuler(user, rulerData)
  // 6. Which calls ruler.update(rulerData) with the serialized data
  //
  // At step 6, we intercept to restore segmentElevations BEFORE the original update
  // runs. This ensures elevation is available when _computeDistance() is called.
  const originalUpdate = Ruler.prototype.update;
  if (originalUpdate) {
    Ruler.prototype.update = function(data) {
      // Restore elevation BEFORE calling original update, so that the elevation-aware
      // _computeDistance() invoked by core's measure() sees the correct values.
      //
      // Copy rather than alias: adjustElevation() mutates this array in place and
      // _removeWaypoint() pops from it, so holding a reference to the broadcast payload would
      // let local measurement corrupt the serialized data.
      if (data.segmentElevations) {
        this.segmentElevations = [...data.segmentElevations];
      }

      // Core's update() sets the waypoints and then calls measure(). When the destination actually
      // moved, measure() recomputes segments, runs _computeDistance() (elevation-aware, since we
      // patch it), and redraws — that single pass is sufficient, so there is no need to duplicate it.
      //
      // But measure() early-returns when the destination is unchanged from the last measurement
      // (docs/foundry.js:32396), before reassigning this.segments or redrawing anything. An
      // elevation-only broadcast — the user scrolling the wheel without moving the mouse — is
      // exactly that case, so we must drive the recompute/render ourselves or remote clients would
      // keep showing stale elevation labels. Detect the bail-out by segment-array identity.
      const segmentsBefore = this.segments;
      const result = originalUpdate.call(this, data);

      if ( this.segments === segmentsBefore ) {
        this._computeDistance(true);
        this.ruler.clear();
        this._drawMeasuredPath();
      }

      // Core rebuilds this.segments from the incoming waypoints, so re-align the elevation array
      // with the new segment count rather than leaving stale trailing values in place.
      syncSegmentElevations(this);

      return result;
    };
  }

  // === Patch: Ruler._getSegmentLabel() ===
  //
  // Purpose: Show cumulative distance and elevation in ruler labels.
  //
  // Why: Users need to see the total distance and elevation change while measuring.
  // Original returns "25ft", we return "25ft > 75ft | ↑20ft" when there's cumulative
  // distance or elevation. Cumulative distance is only shown when it differs from the
  // segment distance (to avoid redundant "25ft > 25ft" on the first segment).
  Ruler.prototype._getSegmentLabel = function(segment) {
    // Get this segment's distance, cumulative distance and cumulative elevation change
    const segmentDistance = Math.ceil((segment?.distance || 0) * 10) / 10;
    const segmentCumDistance = Math.ceil((segment?.cumDistance || 0) * 10) / 10;
    const segmentCumDeltaElevation = segment?.cumDeltaElevation || 0;

    // Get the unit string from the scene grid scale, fall back to localized default
    const units = canvas.scene?.grid?.units || "ft";

    // Format segment label.
    let segmentLabel = `${segmentDistance}${units}`;
    // Append cumulative distance if different than segment distance.
    if (segmentCumDistance !== segmentDistance) {
      segmentLabel = `${segmentLabel} > ${segmentCumDistance}${units}`;
    }
    // Append elevation info if cumulative elevation change is not zero
    if (segmentCumDeltaElevation !== 0) {
      const direction = segmentCumDeltaElevation >= 0 ? "↑" : "↓"; // ↑ = up, ↓ = down
      segmentLabel = `${segmentLabel} | ${direction}${Math.abs(segmentCumDeltaElevation)}${units}`;
    }
    return segmentLabel;
  };

  // === Initialize segmentElevations on the local ruler instance ===
  //
  // The ruler instance on canvas.controls.ruler needs to have segmentElevations
  // initialized before any measurement. We initialize with [0] meaning zero
  // elevation for the first (and typically only) segment.
  //
  // Only this line needs the *instance*; every patch above targets the Ruler prototype and the
  // wheel listener below targets app.view. So guard it inline rather than returning early: an
  // early return would skip the remaining prototype patches (clear, _addWaypoint, _removeWaypoint,
  // moveToken) and the wheel listener whenever the ruler is not yet available, and the idempotency
  // flag set above would then prevent them from ever being installed on that page.
  const rulerInstance = globalThis.canvas.controls?.ruler;
  if ( rulerInstance ) rulerInstance.segmentElevations = [0];

  // === Patch: Ruler.clear() ===
  //
  // Purpose: Reset elevation when ruler is cleared (measurement ends).
  //
  // Why: When the user releases the mouse or right-clicks to cancel,
  // the ruler clears but we need to ensure elevation is reset to [0]
  // for the next measurement session.
  const originalClear = Ruler.prototype.clear;
  if (originalClear) {
    Ruler.prototype.clear = function() {
      this.segmentElevations = [0];
      return originalClear.call(this);
    };
  }

  // === Patch: Ruler._addWaypoint() ===
  //
  // Purpose: Grow the elevation array when a waypoint is added, so the new segment it creates
  // has its own elevation slot instead of silently borrowing a stale trailing value.
  //
  // Why: Ctrl+click adds a waypoint mid-measurement. measure() then rebuilds segments from
  // waypoints, so without this the array is one element short and elevations shift by one segment.
  const originalAddWaypoint = Ruler.prototype._addWaypoint;
  if (originalAddWaypoint) {
    Ruler.prototype._addWaypoint = function(point) {
      const result = originalAddWaypoint.call(this, point);
      syncSegmentElevations(this);
      return result;
    };
  }

  // === Patch: Ruler._removeWaypoint() ===
  //
  // Purpose: Remove elevation slot when a waypoint is removed.
  //
  // Why: Each waypoint creates a segment, and each segment needs an elevation value.
  // When a waypoint is removed (right-click on waypoint), we must pop the corresponding
  // elevation from the array to keep them in sync.
  const originalRemoveWaypoint = Ruler.prototype._removeWaypoint;
  if (originalRemoveWaypoint) {
    Ruler.prototype._removeWaypoint = function(point, options) {
      const waypointsBefore = this.waypoints.length;
      const result = originalRemoveWaypoint.call(this, point, options);

      // Core no-ops when the point is not near an existing waypoint. Only resync if one was
      // actually removed — a blind pop would desync the array in the no-op case.
      //
      // Note this.segments is still the pre-removal list here (core recomputes it on the next
      // measure()), so syncSegmentElevations may only trim here. That is the safe direction: a
      // trailing surplus entry is ignored by _computeDistance, whereas a too-short array would
      // shift every segment's elevation onto the wrong one.
      if ( this.waypoints.length < waypointsBefore ) syncSegmentElevations(this);
      else if ( !this.waypoints.length ) this.segmentElevations = [0];

      return result;
    };
  }

  // === Patch: Ruler.moveToken() ===
  //
  // Purpose: Apply cumulative elevation to token after movement.
  //
  // Why: When a token moves via SPACEBAR (ruler movement), if the user measured
  // with elevation, the token should end up at that elevation (or close to it).
  //
  // How: Sum the elevations of the segments actually being traversed, convert to feet,
  // round to nearest 5ft (standard D&D rounding), and update token's elevation.
  //
  // Note: We capture cumulativeElevation and token reference BEFORE calling
  // originalMoveToken, because segments are cleared once movement starts.
  //
  // Only the first `segments.length` entries are summed, because that is exactly the slice
  // `_computeDistance()` reads when it writes the ruler label, so the applied elevation always
  // matches the displayed one regardless of the array shape.
  //
  // The measured elevation is *consumed* synchronously before the move starts. Core can invoke
  // `moveToken()` more than once for a single measurement — a held Space key repeats the
  // `core.measuredRulerMovement` keybinding, and each repeat reaches here before the first move
  // finishes and clears the ruler. Re-applying the same vertical delta on every invocation stacked
  // it (a "↑5ft" reading moved the token 70ft). Resetting the array up-front means only the first
  // invocation can apply a non-zero delta; later ones read 0.
  const originalMoveToken = Ruler.prototype.moveToken;
  if (originalMoveToken) {
    Ruler.prototype.moveToken = async function() {
      // Determine if the token is done moving
      const segmentCount = this.segments?.length ?? 0;
      const cumulativeElevation = (this.segmentElevations || [])
        .slice(0, segmentCount)
        .reduce((a, b) => a + b, 0);
      const token = this._getMovementToken();

      // Consume the measured elevation so it can only be applied once per measurement.
      if ( this.segmentElevations?.length ) this.segmentElevations = [0];

      const doneMoving = await originalMoveToken.call(this);

      // Apply stored elevation delta to token after movement completes
      if (doneMoving) {
        // Apply elevation delta to token after movement completes
        if (token && cumulativeElevation !== 0) {
          const gridDistance = getGridDistance();
          const elevationDelta = cumulativeElevation * gridDistance;
          // Round to nearest 5ft (D&D standard)
          const roundedElevationDelta = Math.ceil(elevationDelta / 5) * 5;
          await token.document.update({ elevation: token.document.elevation + roundedElevationDelta });
        }
      }

      // Return the original result
      return doneMoving;
    };
  }
}

/**
 * Register keybindings for elevation adjustment with arrow keys.
 * These PRIORITY keybindings override the core pan keybindings when the ruler
 * is in MEASURING state, allowing arrow keys to adjust elevation instead of panning.
 *
 * PURPOSE: Register two keybinding pairs (ArrowUp/Down and Numpad8/2) that:
 *   - When a ruler is measuring: consume the event and adjust segment elevation (+1 or -1)
 *   - When no ruler is measuring: pass through to core pan behavior
 *
 * WHY NEEDED: Without PRIORITY precedence, Foundry's default arrow-key-to-pan binding fires first,
 * making it impossible to use arrow keys for elevation. The dual key support (Arrow + Numpad) gives
 * users flexibility regardless of keyboard layout. Ctrl+ modifier allows creating new segments while
 * simultaneously adjusting their elevation.
 *
 * @param {string} namespace The module namespace (e.g., "dnd5e")
 */
export function registerElevationKeybindings(namespace) {
  // ArrowUp keybinding - ascend when ruler is measuring
  // Also supports Ctrl+ArrowUp to adjust elevation while holding Ctrl to create segments
  game.keybindings.register(namespace, "rulerElevationUp", {
    name: "Sieg5e.RulerElevationUp",
    hint: "Sieg5e.RulerElevationUpHint",
    editable: [
      { key: "ArrowUp" },
      { key: "Numpad8" },
      { key: "ArrowUp", modifiers: ["Control"] },
      { key: "Numpad8", modifiers: ["Control"] }
    ],
    precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY,
    repeat: true,
    onDown: () => {
      const ruler = getActiveRuler();
      if (ruler) {
        adjustElevation(ruler, 1);
        return true; // Consume the event, preventing pan
      }
      return false; // Let core pan keybinding fire
    }
  });

  // ArrowDown keybinding - descend when ruler is measuring
  // Also supports Ctrl+ArrowDown to adjust elevation while holding Ctrl to create segments
  game.keybindings.register(namespace, "rulerElevationDown", {
    name: "Sieg5e.RulerElevationDown",
    hint: "Sieg5e.RulerElevationDownHint",
    editable: [
      { key: "ArrowDown" },
      { key: "Numpad2" },
      { key: "ArrowDown", modifiers: ["Control"] },
      { key: "Numpad2", modifiers: ["Control"] }
    ],
    precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY,
    repeat: true,
    onDown: () => {
      const ruler = getActiveRuler();
      if (ruler) {
        adjustElevation(ruler, -1);
        return true; // Consume the event, preventing pan
      }
      return false; // Let core pan keybinding fire
    }
  });
}

/**
 * Compute 3D distance from ground distance, elevation (in feet), and diagonal rule.
 *
 * PURPOSE: Convert a 2D ground measurement into a 3D hypotenuse by combining horizontal
 * displacement with vertical displacement using the scene's configured diagonal movement rule.
 *
 * WHY NEEDED: D&D 5e has three different rules for computing diagonal movement distance:
 *   - PHB ("555"): max(ground, elevation) — counts only the larger dimension
 *   - DMG ("5105"): alternating 5-10-5 on paired diagonals, straight-line on remaining steps
 *   - Euclidean: sqrt(ground² + elevation²) — true geometric distance
 *
 * Without this function, ruler measurements would ignore the third dimension entirely,
 * giving incorrect movement costs for flying creatures or multi-floor dungeon navigation.
 *
 * @param {number} groundDistance Ground distance in feet
 * @param {number} elevationFeet Elevation in feet
 * @param {string} diagonalRule Diagonal movement rule (EUCL, 5105, or 555)
 * @param {number} [gridDistance] Grid cell size in feet
 * @returns {number} 3D-adjusted distance in feet
 */
export function compute3DDistance(groundDistance, elevationFeet, diagonalRule, gridDistance = getGridDistance()) {
  switch (diagonalRule) {
    case "EUCL": return Math.hypot(groundDistance, elevationFeet);
    case "5105": {
      const hSteps = Math.ceil(groundDistance / gridDistance) || 0;
      const vSteps = Math.abs(elevationFeet) / gridDistance;
      // Count steps that cross two axes (true diagonals) vs straight extension
      const pairedDiagonals = Math.min(hSteps, vSteps);
      const remainingStraight = Math.max(hSteps, vSteps) - pairedDiagonals;
      return ((Math.floor(pairedDiagonals / 2) * 15) + ((pairedDiagonals % 2) * 5))
           + ((remainingStraight * gridDistance));
    }
    default: return Math.max(groundDistance, elevationFeet);
  }
}

/**
 * Setup ruler elevation on canvas ready.
 * Called from the canvasReady hook in dnd5e.mjs.
 *
 * PURPOSE: Perform a two-phase setup:
 *   Phase 1 — Replace grid.measureDistances with Sieg5e's diagonal-aware version and set
 *             the scene's diagonalRule (forced to "555" for hex grids).
 *   Phase 2 — Call installRulerPatches() which applies all Ruler prototype patches.
 *
 * WHY NEEDED: Without replacing measureDistances, Foundry would use its default grid distance
 * calculation which ignores the PHB/DMG diagonal rules entirely. The diagonalRule override for
 * hex grids is required because 5e standard movement on hex maps always uses "5-5-5" (every
 * hex costs exactly one move), regardless of the user's preferred diagonal rule.
 *
 * @param {Canvas} gameCanvas The Foundry canvas instance
 * @param {object} canvasModule The canvas module containing measureDistances
 * @param {Function} canvasModule.measureDistances Function to measure distances between points
 */
export function setupRulerElevation(gameCanvas, canvasModule) {
  // Step 1: Apply the dnd5e measureDistances function
  // The dnd5e system provides its own measureDistances that handles diagonal movement rules
  // (555, 5105, or Euclidean). Without this, the grid would use Foundry's default which
  // doesn't apply any diagonal rule logic.
  const { measureDistances } = canvasModule;
  gameCanvas.grid.measureDistances = measureDistances;

  // Step 2: Set the diagonal movement rule
  // The dnd5e measureDistances reads from this.parent.diagonalRule (InterfaceCanvasGroup).
  // We set it from game settings so the correct formula is used for elevation calculations.
  // Hex grids always use 5/5/5 rule
  // (standard D&D 5e hex movement)
  let diagonalRule = game.settings.get("dnd5e", "diagonalMovement");
  const hexTypes = [
    CONST.GRID_TYPES.HEXODDR,
    CONST.GRID_TYPES.HEXEVENR,
    CONST.GRID_TYPES.HEXODDQ,
    CONST.GRID_TYPES.HEXEVENQ
  ];
  if ( gameCanvas.grid?.type && hexTypes.includes(gameCanvas.grid.type) ) diagonalRule = "555";
  if ( gameCanvas.grid?.parent ) gameCanvas.grid.parent.diagonalRule = diagonalRule;

  // Step 3: Replace Ruler._computeDistance to apply elevation
  //
  // Purpose: Calculate 3D distances including elevation for each segment.
  //
  // How it works:
  // 1. Get base distances from grid.measureDistances (ground-only distance)
  // 2. For each segment, retrieve its elevation from segmentElevations array
  // 3. Convert elevation to feet using grid distance (e.g., 2 units * 5ft = 10ft)
  // 4. Apply 3D distance formula based on diagonal movement rule:
  //    - EUCL (Euclidean): hypotenuse of ground + elevation
  //    - 5105: ground+elevation paired as diagonals (alternating 5-10-5), excess one-axis steps at grid distance
  //    - 555 (default): max(ground, elevation) - only counts larger dimension
  // 5. Set segment.distance to the adjusted 3D distance
  // 6. Generate label with elevation info via _getSegmentLabel
  Ruler.prototype._computeDistance = function(_force) {
    // Get ground-only distances from grid (array of distances for each segment)
    const distances = canvas.grid.measureDistances(this.segments, { gridSpaces: true });
    const gridDistance = getGridDistance();
    // Read diagonal rule from the grid parent (already handles hex grid override)
    const diagonalRule = gameCanvas.grid?.parent?.diagonalRule ?? "555";

    // Create variables to store cumulative distance and elevation change between segments
    let cumulativeDistance = 0;
    let cumulativeDeltaElevation = 0;
    // Process each segment to calculate 3D distance including elevation
    for (let [i, d] of distances.entries()) {
      // Get elevation for this segment (in grid units, default to 0)
      const elevation = this.segmentElevations[i] || 0;
      // Convert elevation to feet: e.g., 2 units * 5ft = 10ft
      const elevationFeet = Math.abs(elevation) * gridDistance;
      // Apply 3D distance formula if there's elevation
      const adjustedDistance = elevation ? compute3DDistance(d, elevationFeet, diagonalRule) : d;

      cumulativeDistance += adjustedDistance;
      cumulativeDeltaElevation += (elevation * gridDistance);

      // Store the 3D-adjusted distance and mark if it's the last segment
      this.segments[i].distance = adjustedDistance;
      this.segments[i].cumDistance = cumulativeDistance;
      this.segments[i].cumDeltaElevation = cumulativeDeltaElevation;
      this.segments[i].last = i === (this.segments.length - 1);
      // Generate label with segment and cumulative distances + elevation info
      this.segments[i].text = this._getSegmentLabel(this.segments[i]);
    }
  };

  // Step 4: Install all Ruler patches
  installRulerPatches(gameCanvas);
}
