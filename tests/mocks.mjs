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
   */
  setCanvas(val) {
    globalThis.canvas = val;
    return this;
  }

  /**
   * Save and set a new globalThis.game value.
   */
  setGame(val) {
    globalThis.game = val;
    return this;
  }

  /**
   * Save and replace the CONST global (e.g., GRID_TYPES, KEYBINDING_PRECEDENCE).
   */
  setConst(val) {
    globalThis.CONST = val;
    return this;
  }

  /**
   * Temporarily override Ruler.prototype._computeDistance.
   * Pass null to restore the original.
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
