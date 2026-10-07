import { describe, it, expect } from "vitest";
import { traceContours } from "./contours";

/** Sample f on an nx x ny grid with unit spacing */
function grid(nx: number, ny: number, f: (x: number, y: number) => number) {
  const values = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) values[j * nx + i] = f(i, j);
  return values;
}

const isClosed = (path: [number, number][]) =>
  path[0][0] === path[path.length - 1][0] && path[0][1] === path[path.length - 1][1];

describe("traceContours", () => {
  it("returns nothing when the field never crosses the level", () => {
    expect(traceContours(grid(10, 10, () => 0.2), 10, 10, 1, 1, 0.5)).toEqual([]);
    expect(traceContours(grid(10, 10, () => 0.9), 10, 10, 1, 1, 0.5)).toEqual([]);
  });

  it("traces a disc as one closed loop on its circle", () => {
    const r = 8;
    const values = grid(41, 41, (x, y) => r - Math.hypot(x - 20, y - 20));
    const paths = traceContours(values, 41, 41, 1, 1, 0);
    expect(paths).toHaveLength(1);
    expect(isClosed(paths[0])).toBe(true);
    for (const [x, y] of paths[0]) expect(Math.hypot(x - 20, y - 20)).toBeCloseTo(r, 1);
    // one vertex per grid edge crossed: about the circumference in cells, and the loop goes all the way round
    expect(paths[0].length).toBeGreaterThan(2 * Math.PI * r);
    const angles = paths[0].map(([x, y]) => Math.atan2(y - 20, x - 20));
    expect(Math.max(...angles) - Math.min(...angles)).toBeGreaterThan(6);
  });

  it("traces a half-plane as one open curve ending on the grid boundary", () => {
    const values = grid(20, 12, (x) => x - 7.25);
    const paths = traceContours(values, 20, 12, 1, 1, 0);
    expect(paths).toHaveLength(1);
    const path = paths[0];
    expect(isClosed(path)).toBe(false);
    for (const [x] of path) expect(x).toBeCloseTo(7.25, 5);
    const ys = [path[0][1], path[path.length - 1][1]].sort((a, b) => a - b);
    expect(ys).toEqual([0, 11]);
  });

  it("keeps separate shapes as separate loops", () => {
    const values = grid(60, 30, (x, y) =>
      Math.max(5 - Math.hypot(x - 15, y - 15), 5 - Math.hypot(x - 45, y - 15))
    );
    const paths = traceContours(values, 60, 30, 1, 1, 0);
    expect(paths).toHaveLength(2);
    expect(paths.every(isClosed)).toBe(true);
  });

  it("scales points by the sample spacing", () => {
    const values = grid(41, 41, (x, y) => 8 - Math.hypot(x - 20, y - 20));
    const [path] = traceContours(values, 41, 41, 0.25, 0.5, 0);
    for (const [x, y] of path) expect(Math.hypot(x / 0.25 - 20, y / 0.5 - 20)).toBeCloseTo(8, 1);
  });

  it("uses every crossing exactly once, saddles included", () => {
    // A checkerboard of bumps makes saddle cells between diagonal neighbours
    const values = grid(31, 31, (x, y) => Math.sin(x * 0.7) * Math.sin(y * 0.7));
    const paths = traceContours(values, 31, 31, 1, 1, 0);
    let crossings = 0;
    for (let j = 0; j < 31; j++) {
      for (let i = 0; i < 31; i++) {
        const a = values[j * 31 + i] >= 0;
        if (i < 30 && a !== values[j * 31 + i + 1] >= 0) crossings++;
        if (j < 30 && a !== values[(j + 1) * 31 + i] >= 0) crossings++;
      }
    }
    const used = paths.reduce((n, path) => n + path.length - (isClosed(path) ? 1 : 0), 0);
    expect(used).toBe(crossings);
  });
});
