import { describe, it, expect } from "vitest";
import { generatePatternGeometry, PATTERN_LABELS, SORTED_PATTERN_ENTRIES } from "./index";
import type { PatternType } from "../types";

// Panel dimensions typical for a 3U eurorack panel (e.g. 8HP)
const W = 40.32; // ~8HP
const H = 128.5; // 3U

const ALL_PATTERNS: PatternType[] = [
  "concentric-circles",
  "hex-grid",
  "waveform",
  "sierpinski-full",
  "radial-burst",
  "flow-field",
  "circuit-traces",
  "binary-matrix",
  "oscilloscope",
  "flower-of-life",
  "metatrons-cube",
  "seed-of-life",
  "lissajous",
  "voronoi",
  "lorenz-attractor",
  "topographic",
  "phyllotaxis",
  "moire-lines",
  "chladni",
  "spirograph",
  "reaction-diffusion",
];

function totalPrimitives(geo: ReturnType<typeof generatePatternGeometry>): number {
  return (
    geo.paths.length +
    geo.polygons.length +
    geo.circles.length +
    geo.rects.length +
    geo.lines.length +
    geo.texts.length
  );
}

// ---------------------------------------------------------------------------
// "none" pattern
// ---------------------------------------------------------------------------

describe('"none" pattern', () => {
  it("returns empty geometry", () => {
    const geo = generatePatternGeometry("none", W, H, 42);
    expect(geo.paths).toHaveLength(0);
    expect(geo.polygons).toHaveLength(0);
    expect(geo.circles).toHaveLength(0);
    expect(geo.rects).toHaveLength(0);
    expect(geo.lines).toHaveLength(0);
    expect(geo.texts).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Each pattern produces geometry
// ---------------------------------------------------------------------------

describe("each pattern returns non-empty geometry", () => {
  for (const pattern of ALL_PATTERNS) {
    it(`${pattern} produces at least one primitive`, () => {
      const geo = generatePatternGeometry(pattern, W, H, 1);
      expect(totalPrimitives(geo)).toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------------
// Determinism: same seed → same geometry
// ---------------------------------------------------------------------------

describe("same seed produces same geometry", () => {
  for (const pattern of ALL_PATTERNS) {
    it(`${pattern} is deterministic`, () => {
      const a = generatePatternGeometry(pattern, W, H, 12345);
      const b = generatePatternGeometry(pattern, W, H, 12345);
      expect(a).toEqual(b);
    });
  }
});

// ---------------------------------------------------------------------------
// Different seeds → different geometry
// ---------------------------------------------------------------------------

describe("different seeds produce different geometry", () => {
  // These patterns use the rng deterministically — skip patterns that happen to
  // produce the same geometry for both test seeds (e.g. sierpinski-full only
  // consumes one rng call and both seeds may map to the same depth value, and
  // metatrons-cube / seed-of-life ignore the seed entirely).
  const seedSensitive: PatternType[] = [
    "concentric-circles",
    "hex-grid",
    "waveform",
    "radial-burst",
    "flow-field",
    "circuit-traces",
    "binary-matrix",
    "oscilloscope",
    "flower-of-life",
    "lissajous",
    "voronoi",
    "lorenz-attractor",
    "topographic",
    "phyllotaxis",
    "moire-lines",
    "chladni",
    "spirograph",
    "reaction-diffusion",
  ];

  for (const pattern of seedSensitive) {
    it(`${pattern} differs between seed 1 and seed 99999`, () => {
      const a = generatePatternGeometry(pattern, W, H, 1);
      const b = generatePatternGeometry(pattern, W, H, 99999);
      expect(a).not.toEqual(b);
    });
  }
});

// ---------------------------------------------------------------------------
// Bounds: all coordinate values stay approximately within panel bounds
// The check is lenient — some patterns (e.g. concentric-circles, moire-lines)
// intentionally extend slightly beyond the panel edge, so we use a 50% margin.
// ---------------------------------------------------------------------------

describe("geometry stays approximately within panel bounds", () => {
  // moire-lines intentionally extends line endpoints by the panel diagonal in
  // each direction so the rotated lines cover the full panel. Use the diagonal
  // as the bound tolerance.
  const TOLERANCE = Math.sqrt(W * W + H * H);

  function checkBounds(pattern: PatternType) {
    const geo = generatePatternGeometry(pattern, W, H, 7);

    for (const { points } of geo.paths) {
      for (const [x, y] of points) {
        expect(x).toBeGreaterThan(-TOLERANCE);
        expect(x).toBeLessThan(W + TOLERANCE);
        expect(y).toBeGreaterThan(-TOLERANCE);
        expect(y).toBeLessThan(H + TOLERANCE);
      }
    }

    for (const { points } of geo.polygons) {
      for (const [x, y] of points) {
        expect(x).toBeGreaterThan(-TOLERANCE);
        expect(x).toBeLessThan(W + TOLERANCE);
        expect(y).toBeGreaterThan(-TOLERANCE);
        expect(y).toBeLessThan(H + TOLERANCE);
      }
    }

    for (const { cx, cy, r } of geo.circles) {
      expect(cx + r).toBeGreaterThan(-TOLERANCE);
      expect(cx - r).toBeLessThan(W + TOLERANCE);
      expect(cy + r).toBeGreaterThan(-TOLERANCE);
      expect(cy - r).toBeLessThan(H + TOLERANCE);
    }

    for (const { x1, y1, x2, y2 } of geo.lines) {
      for (const val of [x1, x2]) {
        expect(val).toBeGreaterThan(-TOLERANCE);
        expect(val).toBeLessThan(W + TOLERANCE);
      }
      for (const val of [y1, y2]) {
        expect(val).toBeGreaterThan(-TOLERANCE);
        expect(val).toBeLessThan(H + TOLERANCE);
      }
    }

    for (const { x, y, width, height } of geo.rects) {
      expect(x).toBeGreaterThan(-TOLERANCE);
      expect(x + width).toBeLessThan(W + TOLERANCE);
      expect(y).toBeGreaterThan(-TOLERANCE);
      expect(y + height).toBeLessThan(H + TOLERANCE);
    }

    for (const { x, y } of geo.texts) {
      expect(x).toBeGreaterThan(-TOLERANCE);
      expect(x).toBeLessThan(W + TOLERANCE);
      expect(y).toBeGreaterThan(-TOLERANCE);
      expect(y).toBeLessThan(H + TOLERANCE);
    }
  }

  for (const pattern of ALL_PATTERNS) {
    it(`${pattern} coordinates are within bounds`, () => {
      checkBounds(pattern);
    });
  }
});

// ---------------------------------------------------------------------------
// PATTERN_LABELS and SORTED_PATTERN_ENTRIES exports
// ---------------------------------------------------------------------------

describe("PATTERN_LABELS", () => {
  it("contains all 22 patterns (including none)", () => {
    const keys = Object.keys(PATTERN_LABELS);
    expect(keys).toHaveLength(22);
    expect(keys).toContain("none");
    for (const pattern of ALL_PATTERNS) {
      expect(keys).toContain(pattern);
    }
  });

  it("has non-empty string labels", () => {
    for (const label of Object.values(PATTERN_LABELS)) {
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(0);
    }
  });
});

describe("SORTED_PATTERN_ENTRIES", () => {
  it("has none as first entry", () => {
    expect(SORTED_PATTERN_ENTRIES[0][0]).toBe("none");
  });

  it("contains all 22 entries", () => {
    expect(SORTED_PATTERN_ENTRIES).toHaveLength(22);
  });

  it("is sorted alphabetically by label (after none)", () => {
    const rest = SORTED_PATTERN_ENTRIES.slice(1);
    for (let i = 0; i < rest.length - 1; i++) {
      expect(rest[i][1].localeCompare(rest[i + 1][1])).toBeLessThanOrEqual(0);
    }
  });
});
