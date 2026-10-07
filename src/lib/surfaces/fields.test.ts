import { describe, it, expect } from "vitest";
import {
  SURFACE_FIELDS,
  SURFACE_STYLES,
  isSurfacePattern,
  makeSurfaceField,
  parseSurfacePattern,
  surfaceFieldLabel,
} from "./fields";
import { computePanel } from "../panel";
import type { Format, PatternType, SurfaceField, SurfaceStyle } from "../types";

const SEEDS = [7, 42, 900001];

/** Field values on a regular grid over the panel */
function sample(field: SurfaceField, style: SurfaceStyle, width: number, height: number, seed: number, step = 1) {
  const f = makeSurfaceField(field, style, width, height, seed);
  const values: number[] = [];
  for (let y = 0; y <= height; y += step) {
    for (let x = 0; x <= width; x += step) values.push(f(x, y));
  }
  return values;
}

const ALL: [SurfaceField, SurfaceStyle][] = SURFACE_FIELDS.flatMap((field) =>
  SURFACE_STYLES.map((style): [SurfaceField, SurfaceStyle] => [field, style])
);

describe("surface fields", () => {
  it("offers eight fields in two styles", () => {
    expect(SURFACE_FIELDS).toHaveLength(8);
    expect(SURFACE_STYLES).toEqual(["relief", "bands"]);
    for (const field of SURFACE_FIELDS) expect(surfaceFieldLabel(field).length).toBeGreaterThan(0);
  });

  for (const [field, style] of ALL) {
    it(`${style}-${field} stays within [0, 1]`, () => {
      for (const seed of SEEDS) {
        const values = sample(field, style, 40.34, 128.5, seed, 0.5);
        expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
        expect(Math.max(...values)).toBeLessThanOrEqual(1);
      }
    });

    it(`${style}-${field} is reproducible from its seed`, () => {
      expect(sample(field, style, 20.02, 128.5, 42)).toEqual(sample(field, style, 20.02, 128.5, 42));
      expect(sample(field, style, 20.02, 128.5, 42)).not.toEqual(sample(field, style, 20.02, 128.5, 43));
    });
  }
});

// The line patterns this feature replaces were blank on narrow panels. Every
// surface field must put raised and low areas on the panel at any width.
describe("panel coverage", () => {
  const sizes: [number, Format][] = [
    [1, "3u"],
    [2, "3u"],
    [8, "3u"],
    [20, "3u"],
    [2, "1u-intellijel"],
    [8, "1u-pulplogic"],
  ];

  for (const [field, style] of ALL) {
    it(`${style}-${field} raises 20% to 80% of the panel at every size`, () => {
      for (const [hp, format] of sizes) {
        const spec = computePanel(hp, format, "slot");
        for (const seed of SEEDS) {
          const values = sample(field, style, spec.width, spec.height, seed);
          const raised = values.filter((v) => v > 0.5).length / values.length;
          expect(raised, `${hp}HP ${format} seed ${seed}`).toBeGreaterThan(0.2);
          expect(raised, `${hp}HP ${format} seed ${seed}`).toBeLessThan(0.8);
        }
      }
    });
  }
});

describe("parseSurfacePattern", () => {
  it("splits a surface pattern into style and field", () => {
    expect(parseSurfacePattern("relief-damascus")).toEqual({ style: "relief", field: "damascus" });
    expect(parseSurfacePattern("bands-chladni-plate")).toEqual({ style: "bands", field: "chladni-plate" });
  });

  it("rejects line patterns and unknown fields", () => {
    expect(parseSurfacePattern("none")).toBeNull();
    expect(parseSurfacePattern("flow-field")).toBeNull();
    expect(parseSurfacePattern("chladni")).toBeNull();
    expect(parseSurfacePattern("relief-nope" as PatternType)).toBeNull();
    expect(parseSurfacePattern("bands-" as PatternType)).toBeNull();
  });

  it("agrees with isSurfacePattern", () => {
    expect(isSurfacePattern("bands-cells")).toBe(true);
    expect(isSurfacePattern("voronoi")).toBe(false);
  });
});
