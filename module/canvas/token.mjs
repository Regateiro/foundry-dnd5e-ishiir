/**
 * Extend the base Token class to implement additional system-specific logic.
 *
 * Custom functionality:
 * - sortTokens(): Custom z-ordering for token draw order on the canvas. Standard Foundry uses
 *   a simple document ID or elevation-based sort. Sieg5e needs multi-criteria sorting because
 *   D&D 5e has meaningful vertical positioning: tokens at higher elevations should appear on top,
 *   smaller tokens (tiny creatures) need to be visible above larger ones, player characters must
 *   visually override NPCs for clarity during combat.
 *
 * - _drawHPBar(): Custom HP bar rendering that includes multiple layers — base HP color gradient,
 *   temporary HP (blue overlay), tempmax adjustments (purple for increases, dark red for decreases),
 *   and armor mastery hit points (gray). Standard Foundry only renders a single HP bar.
 *
 * - _onUpdate(): Tracks token movement timestamps in Token5e.lastMoved Map to support the
 *   "most recently moved on top" sort criterion. Without this, tokens that are moved would not
 *   visually update their z-order until the canvas re-renders via a separate trigger.
 */

export default class Token5e extends Token {

  /**
   * Track the last time each token was moved for sorting purposes.
   * @type {Map<string, number>}
   */
  static lastMoved = new Map();

  /** @inheritdoc */
  _drawBar(number, bar, data) {
    if ( data.attribute === "attributes.hp" ) return this._drawHPBar(number, bar, data);
    return super._drawBar(number, bar, data);
  }

  /* -------------------------------------------- */

  /**
   * Custom sorting function for token draw order.
   * Order: higher elevation on top > smaller tokens on top > player characters above NPCs > more recently moved on top.
   * @param {Token} tokenA  First token
   * @param {Token} tokenB  Second token
   * @returns {number} Sorting order
   */
  static sortTokens(tokenA, tokenB) {
    // First sort by elevation: higher elevation appears on top
    const elevDiff = (tokenA.document.elevation || 0) - (tokenB.document.elevation || 0);
    if (elevDiff !== 0) return elevDiff;

    // Second sort by size: smaller tokens should appear on top (higher z-index)
    const tokenASize = tokenA.document.width * tokenA.document.height;
    const tokenBSize = tokenB.document.width * tokenB.document.height;
    if ( tokenASize !== tokenBSize ) return tokenBSize - tokenASize;

    // Third sort by actor type: player characters ("character") appear above NPCs
    const tokenAType = tokenA.document.actor?.type;
    const tokenBType = tokenB.document.actor?.type;
    const tokenAisPlayer = tokenAType === "character";
    const tokenBisPlayer = tokenBType === "character";
    if ( tokenAisPlayer !== tokenBisPlayer ) return tokenAisPlayer - tokenBisPlayer;

    // Fourth sort by last moved time: more recently moved tokens appear on top
    // Uses static Map to track movement timestamps; defaults to 0 if not yet moved
    const tokenAMovedTime = Token5e.lastMoved.get(tokenA.document.id) ?? 0;
    const tokenBMovedTime = Token5e.lastMoved.get(tokenB.document.id) ?? 0;
    return tokenAMovedTime - tokenBMovedTime;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _onUpdate(...args) {
    const [data] = args;
    const positionChanged = Object.hasOwn(data, "x") || Object.hasOwn(data, "y");
    if ( positionChanged ) {
      Token5e.lastMoved.set(this.document.id, Date.now());
      globalThis.canvas.primary.sortChildren();
      globalThis.canvas.tokens?.objects?.sortChildren();
    }
    return super._onUpdate(...args);
  }

  /* -------------------------------------------- */

  /**
   * Specialized drawing function for HP bars.
   * @param {number} number      The Bar number
   * @param {PIXI.Graphics} bar  The Bar container
   * @param {object} data        Resource data for this bar
   * @private
   */
  _drawHPBar(number, bar, data) {

    // Extract health data
    const hp = this.document.actor?.system?.attributes?.hp || {};
    let {value=0, max=0, temp=0, tempmax=0, armor=0} = hp;
    temp = Number(temp);
    tempmax = Number(tempmax);
    armor = Number(armor);

    // Differentiate between effective maximum and displayed maximum
    const effectiveMax = Math.max(0, max + tempmax);
    const displayMax = Math.max(0, max + (tempmax > 0 ? tempmax : 0));

    // Allocate percentages of the total
    const tempPct = displayMax > 0 ? Math.clamped(temp, 0, displayMax) / displayMax : 0;
    const colorPct = displayMax > 0 ? Math.clamped(value, 0, effectiveMax) / displayMax : 0;
    const hpColor = dnd5e.documents.Actor5e.getHPColor(value, effectiveMax);

    // Determine colors to use
    const blk = 0x000000;
    const c = CONFIG.DND5E.tokenHPColors;

    // Determine the container size (logic borrowed from core)
    if ( !canvas?.dimensions ) return;
    const w = this.w;
    let h = Math.max((canvas.dimensions.size / 12), 8);
    if ( this.document.height >= 2 ) h *= 1.6;
    const bs = Math.clamped(h / 8, 1, 2);
    const bs1 = bs+1;

    // Overall bar container
    bar.clear();
    bar.beginFill(blk, 0.5).lineStyle(bs, blk, 1.0).drawRoundedRect(0, 0, w, h, 3);

    // Temporary maximum HP
    if (tempmax > 0) {
      const pct = max / effectiveMax;
      bar.beginFill(c.tempmax, 1.0).lineStyle(1, blk, 1.0).drawRoundedRect(pct*w, 0, (1-pct)*w, h, 2);
    }

    // Maximum HP penalty
    else if (tempmax < 0) {
      const pct = max > 0 ? (max + tempmax) / max : 0;
      bar.beginFill(c.negmax, 1.0).lineStyle(1, blk, 1.0).drawRoundedRect(pct*w, 0, (1-pct)*w, h, 2);
    }

    // Health bar
    bar.beginFill(hpColor, 1.0).lineStyle(bs, blk, 1.0).drawRoundedRect(0, 0, colorPct*w, h, 2);

    // Temporary hit points
    if ( temp > 0 ) {
      bar.beginFill(c.temp, 1.0).lineStyle(1, blk, 1.0).drawRoundedRect(bs1, bs1, (tempPct*w)-(2*bs1), h-(2*bs1), 1);
    }

    // Armor Mastery hit points — drawn last on top with transparency so THP shows through
    if ( armor > 0 ) {
      const ahpPct = displayMax > 0 ? Math.clamped(armor, 0, displayMax) / displayMax : 0;
      bar.beginFill(c.armor, 1).lineStyle(1, blk, 1.0).drawRoundedRect(bs1, bs1, (ahpPct*w)-(2*bs1), h-(2*bs1), 1);
    }

    // Set position
    let posY = (number === 0) ? (this.h - h) : 0;
    bar.position.set(0, posY);
  }
}
