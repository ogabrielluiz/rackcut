import { describe, it, expect } from "vitest";
import { SURFACE_FIELDS, SURFACE_STYLES } from "./fields";
import { SCREW_SEAT_RADIUS, buildHeightmap, sampleField, sampleSurface } from "./heightmap";
import { computePanel } from "../panel";
import { SLOT_WIDTH, SLOT_HEIGHT } from "../constants";
import type { HoleStyle, SurfacePattern } from "../types";

const PATTERNS = SURFACE_STYLES.flatMap((style) =>
  SURFACE_FIELDS.map((field): SurfacePattern => `${style}-${field}`)
);

describe("sampleField", () => {
  it("covers the panel exactly, corner to corner", () => {
    const { nx, ny, dx, dy, p } = sampleField("relief-damascus", 40.34, 128.5, 42, 0.3);
    expect((nx - 1) * dx).toBeCloseTo(40.34, 9);
    expect((ny - 1) * dy).toBeCloseTo(128.5, 9);
    expect(p).toHaveLength(nx * ny);
    expect(dx).toBeLessThanOrEqual(0.31);
    expect(dy).toBeLessThanOrEqual(0.31);
  });
});

describe("buildHeightmap", () => {
  for (const pattern of PATTERNS) {
    it(`${pattern} stays between the panel face and the requested depth`, () => {
      const spec = computePanel(8, "3u", "slot");
      const map = buildHeightmap(pattern, spec.width, spec.height, 42, {
        cell: 0.4,
        depth: 0.8,
        holes: spec.holes,
        holeStyle: spec.holeStyle,
      });
      let min = Infinity;
      let max = -Infinity;
      for (const h of map.heights) {
        min = Math.min(min, h);
        max = Math.max(max, h);
      }
      expect(min).toBe(0);
      expect(max).toBeLessThanOrEqual(0.8 + 1e-6);
      // The pattern uses the depth it was given
      expect(max).toBeGreaterThan(0.8 * 0.9);
    });
  }

  it("scales with depth", () => {
    const a = buildHeightmap("relief-topo", 20, 60, 7, { cell: 0.5, depth: 0.5 });
    const b = buildHeightmap("relief-topo", 20, 60, 7, { cell: 0.5, depth: 1.5 });
    for (let i = 0; i < a.heights.length; i++) expect(b.heights[i]).toBeCloseTo(a.heights[i] * 3, 5);
  });

  it("bands are flat plateaus: most of the panel is at the face or at full depth", () => {
    const map = buildHeightmap("bands-labyrinth", 40.34, 128.5, 42, { cell: 0.2, depth: 0.6 });
    let low = 0;
    let high = 0;
    for (const h of map.heights) {
      if (h === 0) low++;
      else if (Math.abs(h - 0.6) < 1e-6) high++;
    }
    expect(low / map.heights.length).toBeGreaterThan(0.25);
    expect(high / map.heights.length).toBeGreaterThan(0.25);
  });
});

// A screw head has to seat on a flat face. Measure the actual seat: every
// sample within the seat radius of the hole outline's centre line must be at
// the panel face, for both hole shapes.
describe("screw seats", () => {
  const seatDistance = (x: number, y: number, hx: number, hy: number, holeStyle: HoleStyle) => {
    const slotHalf = holeStyle === "slot" ? (SLOT_WIDTH - SLOT_HEIGHT) / 2 : 0;
    return Math.hypot(Math.max(Math.abs(x - hx) - slotHalf, 0), y - hy);
  };

  for (const holeStyle of ["slot", "circle"] as const) {
    for (const pattern of PATTERNS) {
      it(`${pattern} is flat around ${holeStyle} holes`, () => {
        const spec = computePanel(12, "3u", holeStyle);
        expect(spec.holes).toHaveLength(4);
        expect(spec.holeStyle).toBe(holeStyle);
        const map = buildHeightmap(pattern, spec.width, spec.height, 42, {
          cell: 0.3,
          depth: 1,
          holes: spec.holes,
          holeStyle: spec.holeStyle,
        });
        let inSeat = 0;
        let highestInSeat = 0;
        for (let j = 0; j < map.ny; j++) {
          for (let i = 0; i < map.nx; i++) {
            const x = i * map.dx;
            const y = j * map.dy;
            if (spec.holes.some(([hx, hy]) => seatDistance(x, y, hx, hy, holeStyle) <= SCREW_SEAT_RADIUS)) {
              inSeat++;
              highestInSeat = Math.max(highestInSeat, map.heights[j * map.nx + i]);
            }
          }
        }
        expect(inSeat).toBeGreaterThan(100);
        expect(highestInSeat).toBe(0);
      });
    }
  }

  it("the seat is wide enough for an M3 pan head (5.6mm) over the widest hole", () => {
    // The seat is measured from the hole's centre line, so it clears the head
    // wherever the screw sits along a slot.
    expect(SCREW_SEAT_RADIUS).toBeGreaterThanOrEqual(5.6 / 2);
  });

  it("leaves the field untouched away from the holes", () => {
    const spec = computePanel(8, "3u", "slot");
    const raw = sampleField("bands-cells", spec.width, spec.height, 42, 0.5);
    const seated = sampleSurface("bands-cells", spec.width, spec.height, 42, 0.5, {
      holes: spec.holes,
      holeStyle: "slot",
    });
    const mid = Math.floor(raw.ny / 2) * raw.nx + Math.floor(raw.nx / 2);
    expect(seated.p[mid]).toBe(raw.p[mid]);
    // and without holes nothing changes at all
    expect(sampleSurface("bands-cells", spec.width, spec.height, 42, 0.5).p).toEqual(raw.p);
  });
});
