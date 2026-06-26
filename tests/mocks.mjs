/**
 * MockManager — ensures globalThis.canvas, game, CONST, Ruler are always restored after tests.
 *
 * Usage:
 *   const m = new MockManager();
 *   m.setCanvas({...});       // saves original, sets new value
 *   m.setGame({...});         // same pattern
 *   m.setConst({...});        // patches CONST globals
 *   await someTest(m);        // tests can call m.ruler() to get a mock ruler
 *   m.restore();              // always restores originals (call in finally)
 */


import { assert } from "./shared.mjs";
export class MockManager {
  constructor() {
    this._origCanvas = globalThis.canvas;
    this._origGame = globalThis.game;
    this._origCONST = globalThis.CONST;
    this._origRulerProtoToJSON = Ruler.prototype.toJSON ? Object.getOwnPropertyDescriptor(Ruler.prototype, "toJSON") : undefined;
    this._origRulerProtoComputeDistance = Ruler.prototype._computeDistance;
  }

  /**
   * Save and set a new globalThis.canvas value.
   * @param {*} val The canvas mock object to set
   * @returns {MockManager} this for chaining
   */
  setCanvas(val) {
    globalThis.canvas = val;
    return this;
  }

  /**
   * Save and set a new globalThis.game value.
   * @param {*} val The game mock object to set
   * @returns {MockManager} this for chaining
   */
  setGame(val) {
    globalThis.game = val;
    return this;
  }

  /**
   * Save and replace the CONST global (e.g., GRID_TYPES, KEYBINDING_PRECEDENCE).
   * @param {*} val The CONST mock object to set
   * @returns {MockManager} this for chaining
   */
  setConst(val) {
    globalThis.CONST = val;
    return this;
  }

  /**
   * Temporarily override Ruler.prototype._computeDistance.
   * Pass null to restore the original.
   * @param {Function|null} fn The function to use, or null to restore original
   * @returns {MockManager} this for chaining
   */
  setComputeDistance(fn) {
    if (fn === null) {
      Ruler.prototype._computeDistance = this._origRulerProtoComputeDistance;
    } else {
      Ruler.prototype._computeDistance = fn;
    }
    return this;
  }

  /**
   * Temporarily override Ruler.prototype.toJSON.
   * Pass null to restore the original.
   * @param {Function|null} fn The function to use, or null to restore original
   * @returns {MockManager} this for chaining
   */
  setToJSON(fn) {
    if (fn === null) {
      if (this._origRulerProtoToJSON) {
        Object.defineProperty(Ruler.prototype, "toJSON", this._origRulerProtoToJSON);
      } else {
        delete Ruler.prototype.toJSON;
      }
    } else {
      Ruler.prototype.toJSON = fn;
    }
    return this;
  }

  /**
   * Restore all saved originals. Safe to call multiple times.
   * @returns {void}
   */
  restore() {
    globalThis.canvas = this._origCanvas;
    globalThis.game = this._origGame;
    if (this._origCONST !== undefined) {
      globalThis.CONST = this._origCONST;
    } else {
      delete globalThis.CONST;
    }
    // Restore Ruler prototype methods
    if (this._origRulerProtoToJSON) {
      Object.defineProperty(Ruler.prototype, "toJSON", this._origRulerProtoToJSON);
    } else {
      delete Ruler.prototype.toJSON;
    }
    Ruler.prototype._computeDistance = this._origRulerProtoComputeDistance;

    // Reset state so a new MockManager can be created cleanly
    this._origCanvas = globalThis.canvas;
    this._origGame = globalThis.game;
  }
}

/**
 * Helper: run an async function with canvas/game temporarily set, auto-restored.
 * @param {*} canvasValue The canvas mock object to set
 * @param {*} gameValue The game mock object to set
 * @param {Function} fn Async function to execute
 * @returns {Promise<*>} Result of fn()
 */
export async function mockGlobals(canvasValue, gameValue, fn) {
  const origCanvas = globalThis.canvas;
  const origGame = globalThis.game;
  try {
    globalThis.canvas = canvasValue;
    globalThis.game = gameValue;
    return await fn();
  } finally {
    globalThis.canvas = origCanvas;
    globalThis.game = origGame;
  }
}

/**
 * Helper: run an async function with CONST temporarily set, auto-restored.
 * @param {*} val The CONST mock object to set
 * @param {Function} fn Async function to execute
 * @returns {Promise<*>} Result of fn()
 */
export async function mockConst(val, fn) {
  const origCONST = globalThis.CONST;
  try {
    globalThis.CONST = val;
    return await fn();
  } finally {
    if (origCONST !== undefined) {
      globalThis.CONST = origCONST;
    } else {
      delete globalThis.CONST;
    }
  }
}

/**
 * Run an async function with a fresh MockManager, auto-restored.
 * Eliminates the try/finally boilerplate in every test function.
 * @param {Function} fn Async function that receives the MockManager instance
 * @returns {Promise<*>} Result of fn(m)
 */
export async function withMocks(fn) {
  const m = new MockManager();
  try { return await fn(m); }
  finally { m.restore(); }
}

/* ============================================ */
/*  Ruler / Canvas Mock Helpers                 */
/* ============================================ */

/**
 * Create a minimal mock ruler with standard stubs.
 * @param {object} [overrides] Properties to override on the default mock
 * @returns {object}
 */
/**
 * Create a minimal mock ruler. Pass { patchRulerMethods: true } to auto-copy
 * relevant methods from the current Ruler.prototype (e.g., when overriding _computeDistance).
 * @param {object} [overrides] Properties to override on the default mock
 * @returns {object}
 */
export function createMockRuler(overrides = {}) {
  const hasPatchFlag = overrides.patchRulerMethods;
  delete overrides.patchRulerMethods;

  // Start with a base object
  let ruler = hasPatchFlag ? Object.create(Ruler.prototype) : {};

  // Set required properties as own properties (works for both paths)
  Object.defineProperties(ruler, {
    segments: { value: [{ distance: 5, cumDistance: 5, cumDeltaElevation: 0, text: "", last: true }], writable: true },
    segmentElevations: { value: [0], writable: true },
    _state: { value: 2, writable: true }
  });

  // Set required mock helpers as own properties (works for both paths)
  Object.defineProperties(ruler, {
    ruler: { value: { clear() {} }, writable: false },
    _drawMeasuredPath: { value() {}, writable: false },
    toJSON: { value() { return { x: 0, y: 0 }; }, writable: false }
  });

  // Default no-op stub for _computeDistance (can be overridden by test)
  Object.defineProperty(ruler, "_computeDistance", {
    value() {},
    writable: true,
    enumerable: true
  });

  // Apply overrides (spread into ruler object)
  Object.assign(ruler, overrides);

  return ruler;
}

/**
 * Create a mock scene with grid distance.
 * @param {number} [gridDistance=5]
 * @returns {object}
 */
export function createMockScene(gridDistance = 5) {
  return { grid: { distance: gridDistance, units: "ft" } };
}

/**
 * Create a mock canvas with common defaults.
 * @param {object} [overrides] Properties to override on the default mock
 * @returns {object}
 */
export function createMockCanvas(overrides = {}) {
  return {
    _sieg5eRulerPatched: false,
    app: { view: { addEventListener() {} }, ticker: { addChild() {} } },
    ...overrides
  };
}

/**
 * Assert getActiveRuler returns null.
 * @param {MockManager} m Mock manager instance (unused, for future extensibility)
 * @param {object} results Test results object to write into
 * @param {string} key Key name in results object
 */
export function expectNullRuler(m, results, key) {
  const ruler = globalThis.canvas ? getActiveRulerSafe() : null;
  results[key] = assert(true, ruler === null);
}

/**
 * Assert getActiveRuler returns non-null.
 * @param {MockManager} m Mock manager instance (unused, for future extensibility)
 * @param {object} results Test results object to write into
 * @param {string} key Key name in results object
 */
export function expectNonNullRuler(m, results, key) {
  const ruler = globalThis.canvas ? getActiveRulerSafe() : null;
  results[key] = assert(true, ruler !== null);
}

/**
 * Safely call getActiveRuler regardless of module availability.
 * @returns {Ruler|null} The active ruler or null
 */
function getActiveRulerSafe() {
  if (globalThis.RulerElevation?.getActiveRuler) return globalThis.RulerElevation.getActiveRuler();
  // Fallback: inline the logic from ruler-elevation.mjs
  const ruler = globalThis.canvas?.controls?.ruler;
  if (!ruler || !ruler.segments?.length || ruler._state !== 2) return null;
  return ruler;
}

/**
 * Standard debug logger for test output.
 * @param  {...any[]} args Arguments to log
 */
export function debug(...args) {
  console.debug(`...${args.join(" ")}`);
}
