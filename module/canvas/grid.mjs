/** @inheritDoc */
export function measureDistances(segments, options={}) {
  if ( !options.gridSpaces ) return BaseGrid.prototype.measureDistances.call(this, segments, options);

  // Hex grids need native hex distance — the square-grid diagonal formula produces wrong results
  const hexTypes = [
    CONST.GRID_TYPES.HEXODDR, CONST.GRID_TYPES.HEXEVENR,
    CONST.GRID_TYPES.HEXODDQ, CONST.GRID_TYPES.HEXEVENQ
  ];
  if ( hexTypes.includes(canvas.grid.type) ) {
    return segments.map(s => {
      // Use this.grid.measureDistance (HexagonalGrid) which returns hex count
      // in grid units, NOT this.measureDistance (GridLayer) which returns feet.
      const hexCount = this.grid.measureDistance(s.ray.A, s.ray.B);
      const snapped = Math.round(hexCount);
      return snapped * canvas.dimensions.distance;
    });
  }

  // Track the total number of diagonals
  let nDiagonal = 0;
  const rule = this.parent.diagonalRule;
  const d = canvas.dimensions;

  // Iterate over measured segments
  return segments.map(s => {
    let r = s.ray;

    // Determine the total distance traveled
    let nx = Math.ceil(Math.abs(r.dx / d.size));
    let ny = Math.ceil(Math.abs(r.dy / d.size));

    // Determine the number of straight and diagonal moves
    let nd = Math.min(nx, ny);
    let ns = Math.abs(ny - nx);
    nDiagonal += nd;

    // Alternative DMG Movement
    if (rule === "5105") {
      let nd10 = Math.floor(nDiagonal / 2) - Math.floor((nDiagonal - nd) / 2);
      let spaces = (nd10 * 2) + (nd - nd10) + ns;
      return spaces * d.distance;
    }

    // Euclidean Measurement
    else if (rule === "EUCL") {
      return Math.hypot(nx, ny) * d.distance;
    }

    // Standard PHB Movement
    else return (ns + nd) * d.distance;
  });
}
