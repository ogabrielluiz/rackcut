/**
 * Marching squares: trace the level curves of a sampled field and stitch the
 * per-cell segments into polylines.
 */
export function traceContours(
  values: Float32Array,
  nx: number,
  ny: number,
  dx: number,
  dy: number,
  level: number
): [number, number][][] {
  // Each grid edge crosses the level at most once. Horizontal edge (i, j)-(i+1, j)
  // has id j*nx+i; vertical edge (i, j)-(i, j+1) has id nx*ny + j*nx+i.
  const vOffset = nx * ny;
  const links = new Map<number, number[]>();
  const link = (a: number, b: number) => {
    (links.get(a) ?? links.set(a, []).get(a)!).push(b);
    (links.get(b) ?? links.set(b, []).get(b)!).push(a);
  };

  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = values[j * nx + i] >= level ? 1 : 0;
      const b = values[j * nx + i + 1] >= level ? 2 : 0;
      const c = values[(j + 1) * nx + i + 1] >= level ? 4 : 0;
      const d = values[(j + 1) * nx + i] >= level ? 8 : 0;
      const top = j * nx + i;
      const bottom = (j + 1) * nx + i;
      const left = vOffset + j * nx + i;
      const right = vOffset + j * nx + i + 1;
      switch (a | b | c | d) {
        case 1: case 14: link(left, top); break;
        case 2: case 13: link(top, right); break;
        case 3: case 12: link(left, right); break;
        case 4: case 11: link(right, bottom); break;
        case 6: case 9: link(top, bottom); break;
        case 7: case 8: link(left, bottom); break;
        case 5: link(left, top); link(right, bottom); break;
        case 10: link(top, right); link(left, bottom); break;
      }
    }
  }

  const point = (edge: number): [number, number] => {
    const vertical = edge >= vOffset;
    const idx = vertical ? edge - vOffset : edge;
    const i = idx % nx;
    const j = (idx - i) / nx;
    const v0 = values[j * nx + i];
    const v1 = vertical ? values[(j + 1) * nx + i] : values[j * nx + i + 1];
    const t = v1 === v0 ? 0.5 : (level - v0) / (v1 - v0);
    return vertical ? [i * dx, (j + t) * dy] : [(i + t) * dx, j * dy];
  };

  const visited = new Set<number>();
  const paths: [number, number][][] = [];
  const walk = (start: number) => {
    const pts: [number, number][] = [];
    let current: number | undefined = start;
    let closed = false;
    while (current !== undefined) {
      visited.add(current);
      pts.push(point(current));
      const neighbours: number[] = links.get(current)!;
      const next: number | undefined = neighbours.find((n) => !visited.has(n));
      if (next === undefined && neighbours.length === 2 && neighbours.includes(start) && pts.length > 2) closed = true;
      current = next;
    }
    if (closed) pts.push(pts[0]);
    if (pts.length >= 2) paths.push(pts);
  };

  // Open curves first (they end on the grid boundary), then closed loops
  for (const [edge, neighbours] of links) {
    if (neighbours.length === 1 && !visited.has(edge)) walk(edge);
  }
  for (const edge of links.keys()) {
    if (!visited.has(edge)) walk(edge);
  }
  return paths;
}
