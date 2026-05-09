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


/**
 * Adjust the current (last) ruler segment's elevation and re-render.
 * This function is called by both the mouse wheel handler and arrow key keybindings.
 *
 * @param {Ruler} ruler The active ruler instance
 * @param {number} delta Elevation change in grid units (+1 = ascend, -1 = descend)
 */
export function adjustElevation(ruler, delta) {
  // Ensure array exists and matches segments length
  const targetLen = ruler.segments.length;
  if (!ruler.segmentElevations || ruler.segmentElevations.length < targetLen) {
    ruler.segmentElevations ??= [];
    while (ruler.segmentElevations.length < targetLen) {
      ruler.segmentElevations.push(0);
    }
  }

  // Adjust only the current (last) segment - that's where the user is measuring
  const lastIndex = ruler.segments.length - 1;
  ruler.segmentElevations[lastIndex] = (ruler.segmentElevations[lastIndex] || 0) + delta;

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
 * @param {object} gameCanvas The canvas instance
 */
export function installRulerPatches(gameCanvas) {
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
      // Restore elevation BEFORE calling original update
      if (data.segmentElevations) {
        this.segmentElevations = data.segmentElevations;
      }
      const result = originalUpdate.call(this, data);

      // Force re-render - _drawMeasuredPath will apply elevation before drawing labels
      this._computeDistance(true);
      this.ruler.clear();
      this._drawMeasuredPath();
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

    // Get the unit string from the scene grid scale
    const units = canvas.scene.grid.units;

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
  const rulerInstance = globalThis.canvas.controls.ruler;
  if (!rulerInstance) return;

  rulerInstance.segmentElevations = [0];

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
      // Only pop if we have more than one segment (keep at least [0])
      if (this.segmentElevations && this.segmentElevations.length > 1) {
        this.segmentElevations.pop();
      }
      return originalRemoveWaypoint.call(this, point, options);
    };
  }

  // === Patch: Ruler.moveToken() ===
  //
  // Purpose: Apply cumulative elevation to token after movement.
  //
  // Why: When a token moves via SPACEBAR (ruler movement), if the user measured
  // with elevation, the token should end up at that elevation (or close to it).
  //
  // How: Get cumulative elevation (sum of all segmentElevations), convert to feet,
  // round to nearest 5ft (standard D&D rounding), and update token's elevation.
  //
  // Note: We get the token BEFORE movement because after movement the state changes.
  // We apply elevation AFTER originalMoveToken completes.
  const originalMoveToken = Ruler.prototype.moveToken;
  if (originalMoveToken) {
    Ruler.prototype.moveToken = async function() {
      // Guard: skip if no segments exist to prevent errors
      if (!this.segments || this.segments.length === 0) {
        return false;
      }

      const token = this._getMovementToken();
      const cumulativeElevation = this.segmentElevations?.reduce((a, b) => a + b, 0) || 0;
      const result = await originalMoveToken.call(this);

      // Apply elevation delta to token after movement completes
      if (result && token && cumulativeElevation !== 0) {
        const gridDistance = globalThis.canvas.scene?.grid?.distance || 5;
        const elevationDelta = cumulativeElevation * gridDistance;
        // Round to nearest 5ft (D&D standard)
        const roundedElevationDelta = Math.ceil(elevationDelta / 5) * 5;
        await token.document.update({ elevation: token.document.elevation + roundedElevationDelta });
      }
      return result;
    };
  }

  // === Mouse Wheel Handler ===
  //
  // Purpose: Adjust elevation with mouse wheel while measuring.
  //
  // How it works:
  // 1. Listen for wheel events on the canvas view
  // 2. Check that ruler is in MEASURING state (_state === 2)
  // 3. Determine direction: scroll up = increase, scroll down = decrease
  // 4. Delegate to adjustElevation()
  //
  // Note: We use passive: false to allow preventDefault() to stop page scrolling.
  const handleWheel = event => {
    const ruler = globalThis.canvas?.controls?.ruler;
    if (!ruler || !ruler.segments?.length) return;
    if (ruler._state !== 2) return;

    event.preventDefault();
    event.stopPropagation();

    // DeltaY > 0 means scrolling down (toward user) = descend = decrease elevation
    // deltaY < 0 means scrolling up (away from user) = ascend = increase elevation
    const delta = event.deltaY > 0 ? -1 : 1;
    adjustElevation(ruler, delta);
  };

  gameCanvas.app.view.addEventListener("wheel", handleWheel, { passive: false });
}

/**
 * Register keybindings for elevation adjustment with arrow keys.
 * These PRIORITY keybindings override the core pan keybindings when the ruler
 * is in MEASURING state, allowing arrow keys to adjust elevation instead of panning.
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
      const ruler = globalThis.canvas?.controls?.ruler;
      if (ruler && ruler.segments?.length && ruler._state === 2) {
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
      const ruler = globalThis.canvas?.controls?.ruler;
      if (ruler && ruler.segments?.length && ruler._state === 2) {
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
 * @param {number} groundDistance Ground distance in feet
 * @param {number} elevationFeet Elevation in feet
 * @param {string} diagonalRule Diagonal movement rule (EUCL, 5105, or 555)
 * @returns {number} 3D-adjusted distance in feet
 */
function compute3DDistance(groundDistance, elevationFeet, diagonalRule) {
  switch (diagonalRule) {
    case "EUCL": return Math.hypot(groundDistance, elevationFeet);
    case "5105": return groundDistance + ((elevationFeet / 10) * 5);
    default: return Math.max(groundDistance, elevationFeet);
  }
}

/**
 * Setup ruler elevation on canvas ready.
 * Called from the canvasReady hook in dnd5e.mjs.
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
  const diagonalRule = game.settings.get("dnd5e", "diagonalMovement");
  gameCanvas.grid.parent.diagonalRule = diagonalRule;

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
  //    - 5105: ground + (elevation/10 * 5) extra per 10ft of elevation
  //    - 555 (default): max(ground, elevation) - only counts larger dimension
  // 5. Set segment.distance to the adjusted 3D distance
  // 6. Generate label with elevation info via _getSegmentLabel
  Ruler.prototype._computeDistance = function(force) {
    // Get ground-only distances from grid (array of distances for each segment)
    const distances = canvas.grid.measureDistances(this.segments, { gridSpaces: true });
    const gridDistance = canvas.scene?.grid?.distance || 5;
    const diagonalRule = game.settings.get("dnd5e", "diagonalMovement");

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
