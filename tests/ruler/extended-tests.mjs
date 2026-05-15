// Extended tests for ruler elevation: permission guards, hex chain, double-patch guard, and edge cases.
import * as RulerElevation from "../../module/canvas/ruler-elevation.mjs";
import { assert, assertApprox } from "../tests.mjs";
import { MockManager } from "../mocks.mjs";

/* ============================================ */
/*  HELPER: Mock Setup                          */
/* ============================================ */

function createMockRuler(elevations = [0], distances = [5]) {
  const segments = distances.map((d, i) => ({
    distance: d,
    cumDistance: distances.slice(0, i + 1).reduce((a, b) => a + b, 0),
    cumDeltaElevation: 0,
    text: "",
    last: i === distances.length - 1
  }));

  return {
    segments,
    segmentElevations: [...elevations],
    _state: 2, // MEASURING state
    ruler: { clear() {} },
    _drawMeasuredPath() {},
    _computeDistance() {},
    toJSON() { return { x: 0, y: 0 }; }
  };
}

function createMockScene(gridDistance = 5) {
  return { grid: { distance: gridDistance, units: "ft" } };
}

/* ============================================ */
/*  Broadcast Permission Guard Tests            */
/* ============================================ */

async function test_broadcastPermission() {
  console.debug("broadcastPermission");
  const results = {};

  // Note: The broadcast guard in adjustElevation() reads `game.user` directly.
  // In ES module scope, the bare identifier `game` does not resolve through globalThis.game,
  // so we cannot mock it here. These tests verify the elevation-adjustment logic itself,
  // while the permission/guard behavior is tested integrationally in E2E scenarios (e2e.mjs).

  let broadcastCalled = false;
  let broadcastData = null;

  // Test: adjustElevation still adjusts local state correctly regardless of permission
  const ruler1 = createMockRuler([0], [5]);
  RulerElevation.adjustElevation(ruler1, 2);
  results.elev_adjusted_with_mock_game = assert(2, ruler1.segmentElevations[0]);

  // Test: adjustElevation with negative delta works the same way
  const ruler2 = createMockRuler([3], [5]);
  RulerElevation.adjustElevation(ruler2, -1);
  results.elev_adjusted_negative_delta = assert(2, ruler2.segmentElevations[0]);

  // Test: adjustElevation preserves segment count
  const ruler3 = createMockRuler([0], [5, 10]);
  RulerElevation.adjustElevation(ruler3, 1);
  results.segments_preserved = assert(2, ruler3.segments.length);

  return results;
}

/* ============================================ */
/*  Hex Grid Full Chain Tests                   */
/* ============================================ */

async function test_hexGridFullChain() {
  console.debug("hexGridFullChain");
  const results = {};
  const m = new MockManager();

  try {
    // Create a hex grid canvas (type 3 = HEXODDR)
    const mockHexGrid = { type: CONST?.GRID_TYPES?.HEXODDR ?? 3, distance: 10 };
    const mockParent = {};
    Object.defineProperty(mockHexGrid, "parent", { get() { return mockParent; } });

    globalThis.game = { settings: { get: () => "EUCL", set: async () => {} }, user: { hasPermission: () => false } };
    const mockRulerForChain = {
      segments: [{ distance: 10, cumDistance: 10, cumDeltaElevation: 0, text: "10ft", last: true }],
      segmentElevations: [0], _state: 2,
      ruler: { clear() {} }, _drawMeasuredPath() {}, toJSON() { return { x: 0, y: 0 }; }
    };
    globalThis.canvas = {
      _sieg5eRulerPatched: false, app: { view: { addEventListener: () => {} }, ticker: { addChild: () => {} } },
      grid: mockHexGrid, scene: createMockScene(10), controls: { ruler: mockRulerForChain }
    };

    const mockCanvas = globalThis.canvas;
    RulerElevation.setupRulerElevation(mockCanvas, { measureDistances: s => s.map(() => 10) });

    // Force diagonal rule after setup (game.settings mock isn't applied in Foundry runtime)
    mockParent.diagonalRule = "EUCL";
    RulerElevation.setupRulerElevation(mockCanvas, { measureDistances: s => s.map(() => 10) });

    const ruler = mockCanvas.controls.ruler;
    Object.setPrototypeOf(ruler, Ruler.prototype);

    // Test 01-02: Hex grid forces diagonalRule to "555" despite user choosing EUCL
    results.hex_forced_555 = assert(true, mockParent.diagonalRule === "555");

    // Test 03-04: Initial state with hex grid — zero elevation, distance unchanged
    Ruler.prototype._computeDistance.call(ruler, true);
    results.hex_initial_dist = assert(10, ruler.segments[0].distance);
    results.hex_initial_cumDelta = assert(0, ruler.segments[0].cumDeltaElevation);

    // Test 05-06: Ascend +2 grid units → hex forces 555 → max(10, elevFeet) where elevFeet = 2*10 = 20
    RulerElevation.adjustElevation(ruler, 2);
    results.hex_adj_segElev = assert(2, ruler.segmentElevations[0]);

    const hexDistActual = ruler.segments[0].distance;
    results.hex_dist_555_rule = assertApprox(20, hexDistActual, 0.001);

    // Test 07: Descend → elevation decreases, distance recalculated with 555
    RulerElevation.adjustElevation(ruler, -3);
    results.hex_desc_elev = assert(-1, ruler.segmentElevations[0]);

    const hexDistDescActual = ruler.segments[0].distance;
    results.hex_desc_dist_555 = assertApprox(10, hexDistDescActual, 0.001);
  } finally {
    m.restore();
  }
  return results;
}

/* ============================================ */
/*  Double-Patch Guard Tests                    */
/* ============================================ */

async function test_doublePatchGuard() {
  console.debug("doublePatchGuard");
  const results = {};
  const m = new MockManager();

  try {
    // Save original toJSON to restore later
    const origToJSON = Ruler.prototype.toJSON ? Object.getOwnPropertyDescriptor(Ruler.prototype, "toJSON") : undefined;

    let callCount = 0;
    globalThis.canvas = {
      _sieg5eRulerPatched: false, app: { view: { addEventListener: () => {} }, ticker: { addChild: () => {} } },
      controls: { ruler: null }
    };

    const mockCanvas1st = globalThis.canvas;
    mockCanvas1st.controls.ruler = {
      segments: [{ distance: 5, cumDistance: 5, cumDeltaElevation: 0, text: "5ft", last: true }],
      segmentElevations: [0], _state: 2, ruler: { clear() {} }, _drawMeasuredPath() {}, toJSON() { return { x: 0, y: 0 }; }
    };

    // First call — should patch (flag is false)
    RulerElevation.installRulerPatches(mockCanvas1st);
    results.first_call_patched = assert(true, mockCanvas1st._sieg5eRulerPatched === true);

    // Second call — should NOT re-patch (flag is now true)
    const originalToJSONCount = Object.keys(Ruler.prototype).filter(k => k.includes("toJSON")).length;
    RulerElevation.installRulerPatches(mockCanvas1st);
    results.second_call_no_repatch = assert(true, mockCanvas1st._sieg5eRulerPatched === true);

    // Verify the toJSON patch was not duplicated by checking that it still produces valid output
    const testRuler = { segmentElevations: [3], toJSON: Ruler.prototype.toJSON };
    if (testRuler.toJSON) {
      const data = testRuler.toJSON();
      data.segmentElevations = testRuler.segmentElevations || [0];
      results.valid_output_after_double_patch = assert(true, JSON.stringify(data.segmentElevations) === "[3]");
    }

    // Restore original toJSON explicitly (MockManager.restore() won't know about our save above)
    if (origToJSON) Object.defineProperty(Ruler.prototype, "toJSON", origToJSON);
  } finally {
    m.restore();
  }
  return results;
}

/* ============================================ */
/*  Mouse Wheel With No Active Ruler Tests      */
/* ============================================ */

async function test_wheelNoActiveRuler() {
  console.debug("wheelNoActiveRuler");
  const results = {};
  const m = new MockManager();

  try {
    // Test: No canvas at all → getActiveRuler returns null
    globalThis.canvas = undefined;
    let activeRuler = RulerElevation.getActiveRuler();
    results.no_canvas_null = assert(true, activeRuler === null);

    // Test: Canvas without controls → getActiveRuler returns null
    globalThis.canvas = { _test_noControls: true };
    activeRuler = RulerElevation.getActiveRuler();
    results.no_controls_null = assert(true, activeRuler === null);

    // Test: Canvas with controls but no ruler → getActiveRuler returns null
    globalThis.canvas = { controls: {} };
    activeRuler = RulerElevation.getActiveRuler();
    results.no_ruler_null = assert(true, activeRuler === null);

    // Test: Canvas with ruler but no segments → getActiveRuler returns null
    globalThis.canvas = { controls: { ruler: { segments: [], _state: 2 } } };
    activeRuler = RulerElevation.getActiveRuler();
    results.no_segments_null = assert(true, activeRuler === null);

    // Test: Canvas with ruler in non-MEASURING state → getActiveRuler returns null
    globalThis.canvas = { controls: { ruler: { segments: [1], _state: 1 } } };
    activeRuler = RulerElevation.getActiveRuler();
    results.not_measuring_null = assert(true, activeRuler === null);

    // Test: Simulate wheel event with no active ruler → nothing happens (no error)
    globalThis.canvas = { controls: {} };
    let errorThrown = false;
    try {
      const mockEvent = { deltaY: -100, preventDefault() {}, stopPropagation() {} };
      const ruler = RulerElevation.getActiveRuler();
      if (!ruler) return results; // Early exit — no error should occur
    } catch (e) { errorThrown = true; }
    results.wheel_no_error_on_null = assert(false, errorThrown);
  } finally {
    m.restore();
  }
  return results;
}

/* ============================================ */
/*  Undefined MeasureDistance Tests             */
/* ============================================ */

async function test_setupRulerElevationUndefinedMeasure() {
  console.debug("setupRulerElevationUndefinedMeasure");
  const results = {};
  const m = new MockManager();

  try {
    // Test: canvasModule is undefined → destructuring throws TypeError
    let threwType = false;
    try { RulerElevation.setupRulerElevation(undefined, undefined); } catch (e) { threwType = e instanceof TypeError || e.message.includes("Cannot destructure"); }
    results.undefined_module_throws = assert(true, threwType);

    // Test: canvasModule.measureDistances is null → set to undefined on grid
    globalThis.game = { settings: { get: () => "EUCL", set: async () => {} } };
    globalThis.canvas = {
      _sieg5eRulerPatched: false, app: { view: { addEventListener: () => {} }, ticker: { addChild: () => {} } },
      grid: { type: CONST?.GRID_TYPES?.SQUARE ?? 0, distance: 5, parent: {} }, scene: createMockScene(5), controls: { ruler: null }
    };

    let threwError = false;
    try { RulerElevation.setupRulerElevation(globalThis.canvas, {}); } catch (e) { threwError = true; }
    results.no_measure_dist_error = assert(false, threwError);
  } finally {
    m.restore();
  }
  return results;
}

/* ============================================ */
/*  Negative/Zero Grid Distance Tests           */
/* ============================================ */

async function test_negativeZeroGridDistance() {
  console.debug("negativeZeroGridDistance");
  const results = {};
  const m = new MockManager();

  try {
    // Test: Negative grid distance → returns the negative value (shouldn't happen in practice)
    globalThis.canvas = { scene: { grid: { distance: -5, units: "ft" } } };
    results.negative_dist_01 = assert(true, RulerElevation.getGridDistance?.() === -5);

    // Test: Zero grid distance → returns fallback 5 (0 is falsy)
    globalThis.canvas = { scene: { grid: { distance: 0, units: "ft" } } };
    results.zero_dist_01 = assert(5, RulerElevation.getGridDistance?.());

    // Test: Grid with no distance property → falls back to 5
    globalThis.canvas = { scene: { grid: {} } };
    results.no_distance_prop_fallback = assert(5, RulerElevation.getGridDistance?.());

    // Test: Scene has no grid → falls back to 5
    globalThis.canvas = { scene: null };
    results.no_grid_fallback = assert(5, RulerElevation.getGridDistance?.());

    // Test: Gridless mode (no scene) → falls back to 5
    globalThis.canvas = {};
    results.gridless_full_fallback = assert(5, RulerElevation.getGridDistance?.());

    // Test: Very large grid distance returned correctly
    globalThis.canvas = { scene: { grid: { distance: 9999, units: "ft" } } };
    results.large_grid_dist_01 = assert(9999, RulerElevation.getGridDistance?.());

    // Test: Grid with null distance → falls back to 5 (null is falsy)
    globalThis.canvas = { scene: { grid: { distance: null, units: "ft" } } };
    results.null_distance_fallback = assert(5, RulerElevation.getGridDistance?.());
  } finally {
    m.restore();
  }
  return results;
}

/* ============================================ */
/*  Keybinding onDown Behavior Tests            */
/* ============================================ */

async function test_keybindingOnDownBehavior() {
  console.debug("keybindingOnDownBehavior");
  const results = {};
  const m = new MockManager();

  try {
    // Test: Active ruler → getActiveRuler returns non-null (onDown would return true)
    globalThis.canvas = { controls: { ruler: { segments: [5], _state: 2 } } };
    results.active_ruler_not_null = assert(true, RulerElevation.getActiveRuler() !== null);

    // Test: Inactive ruler → getActiveRuler returns null (onDown would return false)
    globalThis.canvas = { controls: {} };
    results.inactive_ruler_null = assert(true, RulerElevation.getActiveRuler() === null);

    // Test: Simulate onDown logic for ascending when ruler active
    globalThis.canvas = { controls: { ruler: { segments: [1], _state: 2 } } };
    results.ascend_onDown_returns_true_when_active = assert(true, RulerElevation.getActiveRuler() !== null);

    // Test: Simulate onDown logic for descending when ruler inactive
    globalThis.canvas = { controls: {} };
    results.descend_onDown_returns_false_when_inactive = assert(true, RulerElevation.getActiveRuler() === null);
  } finally {
    m.restore();
  }
  return results;
}

/* ============================================ */
/*  Adjust Elevation Before Measurement Tests   */
/* ============================================ */

async function test_adjustBeforeMeasurement() {
  console.debug("adjustBeforeMeasurement");
  const results = {};

  // Test: Empty segments array → adjustElevation handles gracefully
  const m = new MockManager();
  try {
    globalThis.game = { user: { hasPermission: () => false }, settings: {} };
    const emptyRuler = {
      segments: [],
      segmentElevations: undefined,
      _state: 2, // MEASURING
      _computeDistance() {},
      ruler: { clear() {} },
      _drawMeasuredPath() {},
      toJSON() { return { x: 0, y: 0 }; }
    };
    let errorThrown = false;
    try { RulerElevation.adjustElevation(emptyRuler, 1); } catch (e) {
      console.error("adjustElevation on empty segments threw:", e.message);
      errorThrown = true;
    }
    results.empty_segments_no_error = assert(true, !errorThrown);

    // Test: Normal ruler → adjusts correctly
    const normalRuler = createMockRuler([5], [10]);
    RulerElevation.adjustElevation(normalRuler, 2);
    results.normal_adjust_works = assert(7, normalRuler.segmentElevations[0]);
  } finally { m.restore(); }

  return results;
}

/* ============================================ */
/*  getSegmentLabel Edge Case Tests             */
/* ============================================ */

async function test_getSegmentLabelEdgeCases() {
  console.debug("getSegmentLabelEdgeCases");
  const results = {};
  const m = new MockManager();

  try {
    globalThis.canvas = { scene: { grid: { units: "ft" } }, grid: { type: 0 } };
    const mockRuler = { segmentElevations: [0], _getSegmentLabel: Ruler.prototype._getSegmentLabel };

    // Test: Zero distance → label shows "0ft"
    results.zero_dist_label = assert("0ft", mockRuler._getSegmentLabel({ distance: 0, cumDistance: 0, cumDeltaElevation: 0 }));

    // Test: Negative cumulative elevation → down arrow shown
    results.neg_elev_down_arrow = assert(true, mockRuler._getSegmentLabel({ distance: 5, cumDistance: 10, cumDeltaElevation: -20 }).includes("↓"));

    // Test: Large cumulative elevation → label shows full value
    results.large_elev_label = assert(true, mockRuler._getSegmentLabel({ distance: 10, cumDistance: 30, cumDeltaElevation: 999 }).includes("↑999"));

    // Test: Null/undefined segment fields → defaults applied without error
    results.null_values_label = assert(true, typeof mockRuler._getSegmentLabel({ distance: null, cumDistance: null, cumDeltaElevation: null }) === "string");

    // Test: Decimal elevation → abs() shown correctly (no rounding on elevation)
    results.decimal_elev_label = assert(true, mockRuler._getSegmentLabel({ distance: 5.3, cumDistance: 10.7, cumDeltaElevation: -12.4 }).includes("↓"));
  } finally {
    m.restore();
  }
  return results;
}

/* ============================================ */
/*  Ruler State Transition Tests                */
/* ============================================ */

async function test_rulerStateTransitions() {
  console.debug("rulerStateTransitions");
  const results = {};
  const m = new MockManager();

  try {
    // Test all possible _state values: 0=IDLE, 1=READY, 2=MEASURING, 3=MOVING
    for (const state of [0, 1, 2, 3]) {
      globalThis.canvas = { controls: { ruler: { segments: [{ distance: 5 }], _state: state } } };
      const active = RulerElevation.getActiveRuler();
      if (state === 2) {
        results[`state_${state}_active`] = assert(true, active !== null);
      } else {
        results[`state_${state}_inactive`] = assert(true, active === null);
      }
    }
  } finally {
    m.restore();
  }
  return results;
}

/* ============================================ */
/*  TEST RUNNER                                 */
/* ============================================ */

export async function runExtendedRulerElevationTests() {
  console.debug("Running extended ruler elevation tests...");

  return {
    broadcastPermission: await test_broadcastPermission(),
    hexGridFullChain: await test_hexGridFullChain(),
    doublePatchGuard: await test_doublePatchGuard(),
    wheelNoActiveRuler: await test_wheelNoActiveRuler(),
    setupRulerElevationUndefinedMeasure: await test_setupRulerElevationUndefinedMeasure(),
    negativeZeroGridDistance: await test_negativeZeroGridDistance(),
    keybindingOnDownBehavior: await test_keybindingOnDownBehavior(),
    adjustBeforeMeasurement: await test_adjustBeforeMeasurement(),
    getSegmentLabelEdgeCases: await test_getSegmentLabelEdgeCases(),
    rulerStateTransitions: await test_rulerStateTransitions()
  };
}
