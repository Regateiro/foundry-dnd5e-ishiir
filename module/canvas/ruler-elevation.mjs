/**
 * Ruler Elevation Module
 * Adds vertical elevation support to the Ruler measurement tool.
 *
 * Features:
 * - Mouse wheel to adjust elevation per segment
 * - Display cumulative elevation in ruler labels
 * - Apply elevation to token after movement (rounded to nearest 5ft)
 * - Support for all diagonal movement rules (555, 5105, EUCL)
 */

/**
 * Adds elevation adjustment to the base distance calculation.
 * This function is called by Foundry's Ruler tool whenever it needs to calculate distances.
 *
 * How elevation affects distance depends on the diagonal rule:
 *
 * - EUCL (Euclidean): Uses the Pythagorean theorem to calculate the true 3D straight-line
 *   distance. This represents flying in a straight line from start to end point.
 *   Formula: sqrt(ground² + elevation²)
 *
 * - 5105 (DMG diagonal rule): Each 10ft of elevation adds 5ft to movement (like diagonals).
 *   Formula: ground + (elevation / 10) * 5
 *
 * - 555 (PHB diagonal rule): Each square is always gridDistance away, so distance is the max.
 *   Formula: max(ground, elevation)
 *
 * @param {Array} groundSegments Array of distances for each segment (in feet)
 * @returns {Array} Array of distances adjusted for elevation per segment
 */
export function measureDistancesWithElevation(groundSegments) {
  // Get the ruler instance which stores our custom elevation data
  const ruler = globalThis.canvas.controls?.ruler;
  const segmentElevations = ruler?.segmentElevations || [0];

  // Get the grid distance (usually 5ft per square)
  const gridDistance = globalThis.canvas.scene?.grid?.distance || 5;
  const diagonalRule = game.settings.get("dnd5e", "diagonalMovement");

  // Safety check: Ensure elevation array matches segment count
  // This handles edge cases where the ruler adds a new segment but our elevation
  // tracking array hasn't been updated yet (e.g., rapid clicking).
  if (segmentElevations.length < groundSegments.length && ruler) {
    while (segmentElevations.length < groundSegments.length) {
      segmentElevations.push(0);
    }
    ruler.segmentElevations = segmentElevations;
  }

  // Apply elevation calculation to each segment
  for (let i = 0; i < groundSegments.length; i++) {
    const elevation = segmentElevations[i];
    if (elevation) {
      // Convert elevation grid units to feet (e.g., 2 units * 5ft = 10ft)
      const elevationFeet = Math.abs(elevation) * gridDistance;

      // Calculate 3D distance based on diagonal rule
      if (diagonalRule === "EUCL") {
        // Euclidean: True 3D straight-line distance using Pythagorean theorem
        groundSegments[i] = Math.hypot(groundSegments[i], elevationFeet);
      } else if (diagonalRule === "5105") {
        // DMG 5/10/5: Each 10ft of elevation adds 5ft to movement (like diagonal cost)
        groundSegments[i] += (elevationFeet / 10) * 5;
      } else {
        // PHB 5/5/5: Distance is the max of ground or elevation
        // Each square is always gridDistance away
        groundSegments[i] = Math.max(groundSegments[i], elevationFeet);
      }
    }
  }

  return groundSegments;
}

/**
 * Installs patches on the Ruler class to add elevation support.
 *
 * @param {Function} Ruler The Ruler class constructor
 * @param {object} gameCanvas The canvas instance
 */
export function installRulerPatches(Ruler, gameCanvas) {
  // Patch _getSegmentLabel to show cumulative elevation
  // This function is called by Foundry for each segment label as the ruler is drawn.
  // We modify it to append elevation information to the distance label.
  //
  // The original function returns a string like "25ft" but we modify it to show
  // "25ft | ↑20ft" when there's elevation change, where ↑ indicates rising.
  Ruler.prototype._getSegmentLabel = function(segment, distance) {
    const scene = globalThis.canvas.scene;
    const gridDistance = scene?.grid?.distance || 5;
    const segmentElevations = this.segmentElevations || [0];

    if (this._labelSegmentIndex === undefined) {
      this._labelSegmentIndex = 0;
    }
    const idx = this._labelSegmentIndex;
    this._labelSegmentIndex++;

    if (segment?.last === true) {
      this._labelSegmentIndex = 0;
    }

    let cumulativeElevation = 0;
    for (let i = 0; i <= idx; i++) {
      cumulativeElevation += segmentElevations[i] || 0;
    }

    if (cumulativeElevation !== 0) {
      const elevationInFeet = cumulativeElevation * gridDistance;
      const direction = elevationInFeet >= 0 ? "↑" : "↓";
      const roundedElevation = Math.ceil(Math.abs(elevationInFeet) * 10) / 10;
      return `${Math.ceil(distance * 10) / 10}ft | ${direction}${roundedElevation}ft`;
    }
    return `${Math.ceil(distance * 10) / 10}ft`;
  };

  // Initialize ruler instance with elevation tracking
  // segmentElevations: Array storing elevation in grid units (not feet) for each segment.
  // Index 0 corresponds to the first segment, etc. Each value is an integer representing
  // how many grid squares of elevation change that segment has.
  const rulerInstance = globalThis.canvas.controls.ruler;
  if (!rulerInstance) return;

  rulerInstance.segmentElevations = [0];

  // Patch clear() to reset elevation
  const originalClear = Ruler.prototype.clear;
  if (originalClear) {
    Ruler.prototype.clear = function() {
      this.segmentElevations = [0];
      return originalClear.call(this);
    };
  }

  // Patch setWaypoints() to add elevation slots
  const originalSetWaypoints = Ruler.prototype.setWaypoints;
  if (originalSetWaypoints) {
    Ruler.prototype.setWaypoints = function(waypoints, { emit = true } = {}) {
      const currentCount = waypoints?.length || 0;
      const prevCount = this.segmentElevations?.length || 1;
      if (currentCount > prevCount) {
        this.segmentElevations = this.segmentElevations || [0];
        this.segmentElevations.push(0);
      }
      return originalSetWaypoints.call(this, waypoints, { emit });
    };
  }

  // Patch moveToken() to apply elevation to token
  // After the token moves via SPACEBAR, we need to update its elevation.
  // We get the token BEFORE movement (state is valid), then calculate cumulative elevation
  // and apply it after movement completes.
  const originalMoveToken = Ruler.prototype.moveToken;
  if (originalMoveToken) {
    Ruler.prototype.moveToken = async function() {
      // Guard: skip if no segments exist to prevent errors in original function
      if (!this.segments || this.segments.length === 0) {
        return false;
      }

      const token = this._getMovementToken();
      const cumulativeElevation = this.segmentElevations?.reduce((a, b) => a + b, 0) || 0;
      const result = await originalMoveToken.call(this);

      if (result && token && cumulativeElevation !== 0) {
        const gridDistance = globalThis.canvas.scene?.grid?.distance || 5;
        const elevationDelta = cumulativeElevation * gridDistance;
        const roundedElevationDelta = Math.ceil(elevationDelta / 5) * 5;
        await token.document.update({ elevation: token.document.elevation + roundedElevationDelta });
      }
      return result;
    };
  }

  // Mouse wheel handler for elevation adjustment
  // Listen for mouse wheel events while the ruler is active.
  // - Scroll up (negative deltaY) = increase elevation = fly/climb higher
  // - Scroll down (positive deltaY) = decrease elevation = descend
  // Only the current (last) segment's elevation is adjusted.
  const handleWheel = event => {
    // Get the current ruler instance from canvas (not a stored reference)
    const ruler = globalThis.canvas?.controls?.ruler;
    if (!ruler) return;

    // Only adjust elevation when ruler is actively measuring
    // _state === 2 means MEASURING - this ensures we're in an active measurement
    if (ruler._state !== 2) return;
    event.preventDefault();
    event.stopPropagation();

    // Determine direction: scroll up = positive (climb), scroll down = negative (descend)
    const delta = event.deltaY > 0 ? -1 : 1;

    // Ensure array exists (safety check)
    ruler.segmentElevations = ruler.segmentElevations || [0];

    // Update elevation for the current (last) segment only
    // The last index represents the segment currently being drawn/measured
    const lastIndex = ruler.segmentElevations.length - 1;
    ruler.segmentElevations[lastIndex] = (ruler.segmentElevations[lastIndex] || 0) + delta;

    // Force the ruler to re-measure and update the label
    // Manually call _computeDistance to update segments with new elevation,
    // then call _drawMeasuredPath to redraw labels
    ruler._computeDistance(true);
    ruler.ruler.clear();
    ruler._drawMeasuredPath();
  };

  // Add the wheel event listener to the canvas view
  // passive: false allows us to call preventDefault() to stop page scrolling
  gameCanvas.app.view.addEventListener("wheel", handleWheel, { passive: false });
}

/**
 * Setup ruler elevation on canvas ready.
 * This function is called from the canvasReady hook in dnd5e.mjs.
 *
 * @param {object} gameCanvas The Foundry canvas instance
 * @param {object} canvasModule The canvas module with measureDistances
 */
export function setupRulerElevation(gameCanvas, canvasModule) {
  // === Step 1: Apply the dnd5e measureDistances function ===
  // The dnd5e system provides its own measureDistances that handles diagonal movement rules
  // (555, 5105, or Euclidean). Without this, the grid would use the base Foundry function
  // which doesn't apply any diagonal rule logic.
  const { measureDistances } = canvasModule;
  gameCanvas.grid.measureDistances = measureDistances;

  // === Step 2: Set the diagonal movement rule ===
  // The dnd5e measureDistances reads from this.parent.diagonalRule (InterfaceCanvasGroup).
  // We get this from the game settings and set it on the canvas group.
  // The settings.mjs onChange also updates grid.parent when the setting changes.
  const diagonalRule = game.settings.get("dnd5e", "diagonalMovement");
  gameCanvas.grid.parent.diagonalRule = diagonalRule;

  // === Step 3: Override measureDistances to add elevation ===
  // Wrap the dnd5e measureDistances with elevation logic.
  // First call the original (which handles diagonal rules), then add elevation adjustment.
  const originalMeasure = gameCanvas.grid.measureDistances;
  gameCanvas.grid.measureDistances = function(segments, options) {
    // Call the original dnd5e measureDistances to get base distances with diagonal rules applied
    const groundSegments = originalMeasure.call(this, segments, options);
    // Then add elevation adjustments
    return measureDistancesWithElevation.call(this, groundSegments);
  };

  // === Step 4: Patch the Ruler class ===
  // The Ruler class may not be available when canvasReady fires, so we try to get it
  // immediately, or defer to a timeout if it's not ready yet.
  let Ruler = foundry.applications?.controls?.Ruler;
  if (!Ruler) {
    setTimeout(() => {
      const rulerInstance = globalThis.canvas?.controls?.ruler;
      Ruler = rulerInstance ? rulerInstance.constructor : null;
      if (Ruler) {
        installRulerPatches(Ruler, gameCanvas);
      }
    }, 1000);
  } else {
    installRulerPatches(Ruler, gameCanvas);
  }
}
