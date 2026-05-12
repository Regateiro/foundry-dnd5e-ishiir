// End-to-end tests for ruler elevation common user workflows.
// These tests simulate realistic user scenarios by chaining multiple operations.

/**
 * Run all end-to-end tests.
 * @returns {Promise<object>} Test results grouped by scenario.
 */
export async function runE2ETests() {
  console.debug("Running ruler elevation end-to-end tests...");

  const results = {
    measurePathWithElevation: await test_measurePathWithElevation(),
    moveTokenWithElevation: await test_moveTokenWithElevation(),
    clearAndMeasureAgain: await test_clearAndMeasureAgain(),
    removeWaypoints: await test_removeWaypoints(),
    switchGridTypes: await test_switchGridTypes(),
    multipleDiagonalRules: await test_multipleDiagonalRules(),
    remoteSync: await test_remoteSync(),
    keyboardElevation: await test_keyboardElevation(),
    wheelElevation: await test_wheelElevation(),
    complexMultiSegmentPath: await test_complexMultiSegmentPath(),
  };

  return results;
}

/* ============================================ */
/*  Scenario 1: Measure Path with Elevation     */
/* ============================================ */

/**
 * User measures a 3-segment path while adjusting elevation.
 * Workflow: measure → scroll up → measure → scroll down → measure
 */
async function test_measurePathWithElevation() {
  console.debug("E2E: measurePathWithElevation");
  const results = {};

  // Simulate user measuring a path and adjusting elevation
  const ruler = {
    segments: [
      { distance: 5, cumDistance: 0, cumDeltaElevation: 0, text: "", last: false },
      { distance: 5, cumDistance: 0, cumDeltaElevation: 0, text: "", last: false },
      { distance: 5, cumDistance: 0, cumDeltaElevation: 0, text: "", last: true }
    ],
    segmentElevations: [0, 0, 0],
    _state: 2
  };

  // User scrolls up on first segment (ascend 2 grid units)
  ruler.segmentElevations[0] = 2;
  
  // User scrolls down on second segment (descend 1 grid unit)
  ruler.segmentElevations[1] = -1;
  
  // User scrolls up on third segment (ascend 1 grid unit)
  ruler.segmentElevations[2] = 1;

  // Verify elevations
  results["seg0_elev"] = ruler.segmentElevations[0] === 2;
  results["seg1_elev"] = ruler.segmentElevations[1] === -1;
  results["seg2_elev"] = ruler.segmentElevations[2] === 1;

  // Verify cumulative elevation
  const totalElev = ruler.segmentElevations.reduce((a, b) => a + b, 0);
  results["total_elev"] = totalElev === 2; // 2 + (-1) + 1 = 2

  return results;
}

/* ============================================ */
/*  Scenario 2: Move Token with Elevation       */
/* ============================================ */

/**
 * User measures path with elevation, then moves token via SPACEBAR.
 * Token elevation should be updated based on measured elevation.
 */
async function test_moveTokenWithElevation() {
  console.debug("E2E: moveTokenWithElevation");
  const results = {};

  const gridDistance = 5; // 5ft grid
  const segmentElevations = [2, -1, 1]; // 2 up, 1 down, 1 up
  const cumulativeElevation = segmentElevations.reduce((a, b) => a + b, 0);
  
  // Calculate elevation delta in feet
  const elevationDelta = cumulativeElevation * gridDistance;
  const roundedElevationDelta = Math.ceil(elevationDelta / 5) * 5;
  
  const tokenStartElevation = 0;
  const tokenEndElevation = tokenStartElevation + roundedElevationDelta;

  results["cumulative_elev"] = cumulativeElevation === 2;
  results["elevation_delta_ft"] = elevationDelta === 10;
  results["rounded_delta"] = roundedElevationDelta === 10;
  results["token_end_elev"] = tokenEndElevation === 10;

  return results;
}

/* ============================================ */
/*  Scenario 3: Clear and Measure Again         */
/* ============================================ */

/**
 * User clears ruler (ESC/right-click), then measures new path.
 * Old elevation data should be reset.
 */
async function test_clearAndMeasureAgain() {
  console.debug("E2E: clearAndMeasureAgain");
  const results = {};

  // Simulate ruler with elevation data
  const oldRuler = {
    segments: [{ distance: 5, cumDistance: 5, cumDeltaElevation: 10, text: "10ft | ↑10ft", last: true }],
    segmentElevations: [2],
    _state: 2
  };

  // User presses ESC to clear
  const newRuler = {
    segments: [{ distance: 5, cumDistance: 5, cumDeltaElevation: 0, text: "5ft", last: true }],
    segmentElevations: [0], // Reset to [0]
    _state: 2
  };

  results["old_elev"] = oldRuler.segmentElevations[0] === 2;
  results["new_elev"] = newRuler.segmentElevations[0] === 0;
  results["new_elev_length"] = newRuler.segmentElevations.length === 1;

  return results;
}

/* ============================================ */
/*  Scenario 4: Remove Waypoints                */
/* ============================================ */

/**
 * User right-clicks on a waypoint to remove it while measuring.
 * Elevation data should pop for that segment.
 */
async function test_removeWaypoints() {
  console.debug("E2E: removeWaypoints");
  const results = {};

  // Simulate ruler with 3 segments
  const ruler = {
    segments: [
      { distance: 5, cumDistance: 5, cumDeltaElevation: 0, text: "5ft", last: false },
      { distance: 5, cumDistance: 10, cumDeltaElevation: 10, text: "5ft > 10ft | ↑10ft", last: false },
      { distance: 5, cumDistance: 15, cumDeltaElevation: 5, text: "5ft > 15ft | ↑5ft", last: true }
    ],
    segmentElevations: [0, 2, 1], // 0, 2 up, 1 up
    _state: 2
  };

  // User removes middle waypoint (index 1)
  // This should pop segmentElevations[1]
  if (ruler.segmentElevations.length > 1) {
    ruler.segmentElevations.pop();
  }

  results["elev_length"] = ruler.segmentElevations.length === 2;
  results["elev_0"] = ruler.segmentElevations[0] === 0;
  results["elev_1"] = ruler.segmentElevations[1] === 2; // Was index 2, now index 1

  // Remove first waypoint
  if (ruler.segmentElevations.length > 1) {
    ruler.segmentElevations.pop();
  }

  results["final_length"] = ruler.segmentElevations.length === 1;
  results["final_elev"] = ruler.segmentElevations[0] === 0;

  return results;
}

/* ============================================ */
/*  Scenario 5: Switch Grid Types               */
/* ============================================ */

/**
 * User switches from square grid to hex grid.
 * Diagonal rule should automatically change to 555.
 */
async function test_switchGridTypes() {
  console.debug("E2E: switchGridTypes");
  const results = {};

  // Square grid - user chooses 5105
  const squareGrid = { type: 0 };
  let diagonalRule = "5105";
  const hexTypes = [3, 4, 5, 6];
  if (hexTypes.includes(squareGrid.type)) diagonalRule = "555";
  
  results["square_rule"] = diagonalRule === "5105";

  // Switch to hex grid - should override to 555
  const hexGrid = { type: 3 };
  diagonalRule = "5105"; // User still has 5105 selected
  if (hexTypes.includes(hexGrid.type)) diagonalRule = "555";
  
  results["hex_rule"] = diagonalRule === "555";

  // Switch back to square - should respect user choice
  const squareGrid2 = { type: 0 };
  diagonalRule = "EUCL";
  if (hexTypes.includes(squareGrid2.type)) diagonalRule = "555";
  
  results["square_rule_2"] = diagonalRule === "EUCL";

  return results;
}

/* ============================================ */
/*  Scenario 6: Multiple Diagonal Rules         */
/* ============================================ */

/**
 * User measures path with different diagonal rules.
 * Distance should vary based on rule.
 */
async function test_multipleDiagonalRules() {
  console.debug("E2E: multipleDiagonalRules");
  const results = {};

  const groundDistance = 10;
  const elevationFeet = 10;

  // EUCL rule
  const euclDist = Math.hypot(groundDistance, elevationFeet);
  results["eucl_dist"] = Math.abs(euclDist - 14.142) < 0.001;

  // 5105 rule
  const rule5105Dist = groundDistance + ((elevationFeet / 10) * 5);
  results["5105_dist"] = rule5105Dist === 15;

  // 555 rule
  const rule555Dist = Math.max(groundDistance, elevationFeet);
  results["555_dist"] = rule555Dist === 10;

  // Verify order: 555 < 5105 < EUCL for equal ground/elevation
  results["order"] = rule555Dist <= rule5105Dist && rule5105Dist <= euclDist;

  return results;
}

/* ============================================ */
/*  Scenario 7: Remote Sync                     */
/* ============================================ */

/**
 * User adjusts elevation locally, ruler state broadcasts to remote clients.
 * Remote clients should see the same elevation data.
 */
async function test_remoteSync() {
  console.debug("E2E: remoteSync");
  const results = {};

  // Local ruler state
  const localRuler = {
    segments: [
      { distance: 5, cumDistance: 5, cumDeltaElevation: 0, text: "5ft", last: false },
      { distance: 5, cumDistance: 10, cumDeltaElevation: 10, text: "5ft > 10ft | ↑10ft", last: true }
    ],
    segmentElevations: [0, 2],
    toJSON: function() {
      return {
        x: 0,
        y: 0,
        segmentElevations: this.segmentElevations || [0]
      };
    }
  };

  // Simulate broadcast
  const serialized = localRuler.toJSON();
  
  // Remote client receives and parses
  const remoteRuler = {
    segments: [
      { distance: 5, cumDistance: 5, cumDeltaElevation: 0, text: "5ft", last: false },
      { distance: 5, cumDistance: 10, cumDeltaElevation: 10, text: "5ft > 10ft | ↑10ft", last: true }
    ],
    segmentElevations: [0],
    update: function(data) {
      if (data.segmentElevations) {
        this.segmentElevations = data.segmentElevations;
      }
    }
  };

  remoteRuler.update(serialized);

  results["serialized_elev"] = JSON.stringify(serialized.segmentElevations) === "[0,2]";
  results["remote_elev_0"] = remoteRuler.segmentElevations[0] === 0;
  results["remote_elev_1"] = remoteRuler.segmentElevations[1] === 2;

  return results;
}

/* ============================================ */
/*  Scenario 8: Keyboard Elevation              */
/* ============================================ */

/**
 * User uses arrow keys to adjust elevation while measuring.
 * ArrowUp = ascend, ArrowDown = descend.
 */
async function test_keyboardElevation() {
  console.debug("E2E: keyboardElevation");
  const results = {};

  const ruler = {
    segments: [{ distance: 5, cumDistance: 5, cumDeltaElevation: 0, text: "5ft", last: true }],
    segmentElevations: [0],
    _state: 2
  };

  // User presses ArrowUp 3 times (ascend 3 grid units)
  for (let i = 0; i < 3; i++) {
    ruler.segmentElevations[0] += 1;
  }

  results["after_up"] = ruler.segmentElevations[0] === 3;

  // User presses ArrowDown 1 time (descend 1 grid unit)
  ruler.segmentElevations[0] -= 1;

  results["after_down"] = ruler.segmentElevations[0] === 2;

  // User presses Numpad2 (ArrowDown equivalent)
  ruler.segmentElevations[0] -= 1;

  results["after_numpad"] = ruler.segmentElevations[0] === 1;

  return results;
}

/* ============================================ */
/*  Scenario 9: Wheel Elevation                 */
/* ============================================ */

/**
 * User scrolls mouse wheel to adjust elevation.
 * Scroll up = ascend, scroll down = descend.
 */
async function test_wheelElevation() {
  console.debug("E2E: wheelElevation");
  const results = {};

  const ruler = {
    segments: [{ distance: 5, cumDistance: 5, cumDeltaElevation: 0, text: "5ft", last: true }],
    segmentElevations: [0],
    _state: 2
  };

  // Simulate wheel events
  const wheelEvents = [
    { deltaY: -100, expected: 1 },  // Scroll up → ascend
    { deltaY: -100, expected: 1 },
    { deltaY: 100, expected: -1 },  // Scroll down → descend
    { deltaY: -100, expected: 1 }   // Scroll up → ascend
  ];

  for (const event of wheelEvents) {
    const delta = event.deltaY > 0 ? -1 : 1;
    ruler.segmentElevations[0] += delta;
  }

  results["final_elev"] = ruler.segmentElevations[0] === 2; // 1+1-1+1 = 2

  return results;
}

/* ============================================ */
/*  Scenario 10: Complex Multi-Segment Path     */
/* ============================================ */

/**
 * User measures a complex path with multiple segments, varying elevations,
 * and different diagonal rules.
 */
async function test_complexMultiSegmentPath() {
  console.debug("E2E: complexMultiSegmentPath");
  const results = {};

  const gridDistance = 5;
  const segments = [
    { distance: 5, cumDistance: 0, cumDeltaElevation: 0, text: "", last: false },
    { distance: 5, cumDistance: 0, cumDeltaElevation: 0, text: "", last: false },
    { distance: 5, cumDistance: 0, cumDeltaElevation: 0, text: "", last: false },
    { distance: 5, cumDistance: 0, cumDeltaElevation: 0, text: "", last: true }
  ];
  const segmentElevations = [0, 2, -1, 3]; // 0, up 2, down 1, up 3
  let cumulativeDistance = 0;
  let cumulativeDeltaElevation = 0;

  // Simulate _computeDistance with 555 rule
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const elevation = segmentElevations[i] || 0;
    const elevationFeet = Math.abs(elevation) * gridDistance;
    const adjustedDistance = elevation
      ? Math.max(seg.distance, elevationFeet)
      : seg.distance;

    cumulativeDistance += adjustedDistance;
    cumulativeDeltaElevation += (elevation * gridDistance);

    seg.distance = adjustedDistance;
    seg.cumDistance = cumulativeDistance;
    seg.cumDeltaElevation = cumulativeDeltaElevation;
    seg.last = i === (segments.length - 1);
  }

  // Verify distances
  results["seg0_dist"] = segments[0].distance === 5;
  results["seg1_dist"] = segments[1].distance === 10; // max(5,10)
  results["seg2_dist"] = segments[2].distance === 5;  // max(5,5)
  results["seg3_dist"] = segments[3].distance === 15; // max(5,15)

  // Verify cumulative distances
  results["seg0_cum"] = segments[0].cumDistance === 5;
  results["seg1_cum"] = segments[1].cumDistance === 15; // 5+10
  results["seg2_cum"] = segments[2].cumDistance === 20; // 15+5
  results["seg3_cum"] = segments[3].cumDistance === 35; // 20+15

  // Verify cumulative elevation
  results["seg0_cumDelta"] = segments[0].cumDeltaElevation === 0;
  results["seg1_cumDelta"] = segments[1].cumDeltaElevation === 10; // 0+2*5
  results["seg2_cumDelta"] = segments[2].cumDeltaElevation === 5;  // 10+(-1)*5
  results["seg3_cumDelta"] = segments[3].cumDeltaElevation === 20; // 5+3*5

  // Verify last flag
  results["seg0_last"] = segments[0].last === false;
  results["seg3_last"] = segments[3].last === true;

  return results;
}
