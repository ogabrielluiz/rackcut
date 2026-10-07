import type { PatternType, SurfaceField, SurfacePattern, SurfaceStyle } from "../types";

/**
 * Surface fields: scalar functions over the panel, in mm.
 *
 * A field returns p in [0, 1]. p = 0.5 is the band edge; relief raises the
 * surface by depth * p^gamma. Feature sizes are fixed in mm rather than scaled
 * to the panel, so a 2HP blank carries the same texture as a 20HP one.
 */
export type FieldFn = (x: number, y: number) => number;

interface FieldDef {
  label: string;
  /** Exponent applied to p for relief; > 1 gives narrower, rounder ridges */
  gamma: number;
  make: (w: number, h: number, rng: () => number, style: SurfaceStyle) => FieldFn;
}

// Simple seeded PRNG (mulberry32)
function seededRng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAU = Math.PI * 2;

/** Plane waves summed per noise scale; several directions keep any one from dominating */
const WAVES_PER_SCALE = 3;

/**
 * Smooth band-limited noise: a few plane waves around each wavelength (mm),
 * with random directions and phases, amplitudes falling off as 1/n. Scaled to
 * unit RMS, so "warp * noise" displaces by about `warp` mm.
 */
function makeNoise(rng: () => number, wavelengths: number[]): FieldFn {
  const waves: [number, number, number, number][] = [];
  let power = 0;
  wavelengths.forEach((wavelength, i) => {
    const amp = 1 / (1 + i);
    for (let n = 0; n < WAVES_PER_SCALE; n++) {
      const angle = rng() * TAU;
      const k = TAU / (wavelength * (0.85 + 0.3 * rng()));
      waves.push([Math.cos(angle) * k, Math.sin(angle) * k, rng() * TAU, amp]);
      power += (amp * amp) / 2;
    }
  });
  const norm = 1 / Math.sqrt(power);
  return (x, y) => {
    let v = 0;
    for (const [kx, ky, phase, amp] of waves) v += amp * Math.sin(kx * x + ky * y + phase);
    return v * norm;
  };
}

const wave = (phase: number) => 0.5 + 0.5 * Math.sin(phase);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

const FIELDS: Record<SurfaceField, FieldDef> = {
  // Wavy parallel layers with eyes, like pattern-welded steel
  damascus: {
    label: "Damascus",
    gamma: 1.6,
    make: (_w, _h, rng) => {
      const noise = makeNoise(rng, [60, 38, 24, 16]);
      const angle = (rng() - 0.5) * 1.2;
      const ax = Math.sin(angle);
      const ay = Math.cos(angle);
      const pitch = 5.0 + rng() * 1.2;
      // Enough warp to fold the layers into eyes, not so much that they crumple
      const warp = 10 + rng() * 2;
      return (x, y) => wave(((x * ax + y * ay + warp * noise(x, y)) * TAU) / pitch);
    },
  },

  // Blobs and islands pulled along a wavy grain
  marble: {
    label: "Marble",
    gamma: 1.3,
    make: (_w, _h, rng) => {
      const blobs = makeNoise(rng, [34, 22, 14, 9.5]);
      const grain = makeNoise(rng, [58, 40, 28, 16]);
      const pitch = 9 + rng() * 3;
      const density = 1.5 + rng() * 0.3;
      return (x, y) => {
        const f = 0.85 * blobs(x, y) + 0.45 * Math.sin(((y + 4 * grain(x, y)) * TAU) / pitch);
        return wave(Math.PI * f * density);
      };
    },
  },

  // Elevation bands of a rolling landscape
  topo: {
    label: "Topo",
    gamma: 1.4,
    make: (_w, _h, rng) => {
      const hills = makeNoise(rng, [42, 26, 17]);
      const levels = 2.3 + rng() * 1.3;
      return (x, y) => wave(hills(x, y) * levels * Math.PI);
    },
  },

  // Standing waves on a free-edged plate the size of the panel. Bands are the
  // regions moving in opposite phase; relief is the sand collected on the
  // nodal lines between them.
  "chladni-plate": {
    label: "Chladni Plate",
    gamma: 1.0,
    make: (w, h, rng, style) => {
      // Two modes of about the same wavelength, so their sum has curved nodal
      // lines. Even mode numbers keep the figure mirror-symmetric about both
      // centre lines; an odd one would split the panel into inverted halves.
      const half = 4.2 + rng() * 1.3; // half wavelength, mm
      const even = (cycles: number) => 2 * Math.round(cycles / 2);
      const mode = (angle: number): [number, number] => [
        (even((w * Math.cos(angle)) / half) * Math.PI) / w,
        (even((h * Math.sin(angle)) / half) * Math.PI) / h,
      ];
      const [kx1, ky1] = mode(0.26 + rng() * 0.44);
      const [kx2, second] = mode(0.87 + rng() * 0.44);
      // Two identical modes would cancel out; push the second one up a step
      const ky2 = kx1 === kx2 && ky1 === second ? second + (2 * Math.PI) / h : second;
      const sign = rng() < 0.5 ? 1 : -1;
      const ridge = 0.9; // half width of a nodal ridge, mm
      return (x, y) => {
        const c1x = Math.cos(kx1 * x), c1y = Math.cos(ky1 * y);
        const c2x = Math.cos(kx2 * x), c2y = Math.cos(ky2 * y);
        const f = c1x * c1y + sign * c2x * c2y;
        if (style === "bands") return clamp01(0.5 + 0.25 * f);
        const gx = -kx1 * Math.sin(kx1 * x) * c1y - sign * kx2 * Math.sin(kx2 * x) * c2y;
        const gy = -ky1 * c1x * Math.sin(ky1 * y) - sign * ky2 * c2x * Math.sin(ky2 * y);
        // |f| / |grad f| is the distance to the nearest nodal line. The floor on
        // the gradient joins ridges cleanly where two nodal lines cross.
        const t = clamp01(Math.abs(f) / Math.hypot(gx, gy, 0.08) / (2 * ridge));
        return 1 - t * t * (3 - 2 * t);
      };
    },
  },

  // Ripples from several point sources crossing each other
  interference: {
    label: "Interference",
    gamma: 1.3,
    make: (w, h, rng) => {
      const count = 2 + Math.floor(rng() * 2);
      const pitch = 3.6 + rng() * 1.4;
      // Sources sit outside the panel, so only their crossing wavefronts show
      const reach = Math.hypot(w, h) / 2;
      const sources: [number, number][] = [];
      for (let i = 0; i < count; i++) {
        const angle = rng() * TAU;
        const distance = reach * (1.05 + 0.5 * rng()) + 8;
        sources.push([w / 2 + Math.cos(angle) * distance, h / 2 + Math.sin(angle) * distance]);
      }
      return (x, y) => {
        let f = 0;
        for (const [sx, sy] of sources) f += Math.cos((Math.hypot(x - sx, y - sy) * TAU) / pitch);
        return clamp01(0.5 + 0.5 * Math.tanh((f / count) * 2.2));
      };
    },
  },

  // Pillowed Voronoi cells separated by channels
  cells: {
    label: "Cells",
    gamma: 0.8,
    make: (_w, _h, rng) => {
      const size = 5.5 + rng() * 2.5;
      const salt = Math.floor(rng() * 1e6);
      // Jittered-grid sites, hashed per cell so lookup needs no site list
      const site = (cx: number, cy: number): [number, number] => {
        let t = Math.imul(cx * 374761393 + cy * 668265263 + salt, 1274126177);
        t ^= t >>> 13;
        const a = ((Math.imul(t, 1103515245) >>> 0) / 4294967296);
        const b = ((Math.imul(t ^ 0x9e3779b9, 22695477) >>> 0) / 4294967296);
        return [(cx + 0.15 + 0.7 * a) * size, (cy + 0.15 + 0.7 * b) * size];
      };
      return (x, y) => {
        const cx = Math.floor(x / size);
        const cy = Math.floor(y / size);
        let d1 = Infinity;
        let d2 = Infinity;
        for (let i = -2; i <= 2; i++) {
          for (let j = -2; j <= 2; j++) {
            const [sx, sy] = site(cx + i, cy + j);
            const d = Math.hypot(x - sx, y - sy);
            if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
          }
        }
        // d2 - d1 is ~2x the distance to the cell wall
        const t = clamp01((d2 - d1) / 2.4);
        return t * t * (3 - 2 * t);
      };
    },
  },

  // Turing-style maze: many plane waves of one wavelength
  labyrinth: {
    label: "Labyrinth",
    gamma: 1.2,
    make: (_w, _h, rng) => {
      const pitch = 3.4 + rng() * 1.2;
      const count = 22;
      const waves: [number, number, number][] = [];
      for (let i = 0; i < count; i++) {
        const angle = rng() * TAU;
        const k = (TAU / pitch) * (0.94 + rng() * 0.12);
        waves.push([Math.cos(angle) * k, Math.sin(angle) * k, rng() * TAU]);
      }
      const norm = 1 / Math.sqrt(count / 2);
      return (x, y) => {
        let f = 0;
        for (const [kx, ky, phase] of waves) f += Math.cos(kx * x + ky * y + phase);
        return clamp01(0.5 + 0.5 * Math.tanh(f * norm * 1.3));
      };
    },
  },

  // Rings spreading from one drop, slightly disturbed
  ripple: {
    label: "Ripple",
    gamma: 1.5,
    make: (w, h, rng) => {
      const noise = makeNoise(rng, [34, 20, 14]);
      const sx = w * (0.2 + 0.6 * rng());
      const sy = h * (0.2 + 0.6 * rng());
      const pitch = 3.2 + rng() * 1.2;
      const warp = 1 + rng() * 1.5;
      return (x, y) => wave(((Math.hypot(x - sx, y - sy) + warp * noise(x, y)) * TAU) / pitch);
    },
  },
};

export const SURFACE_FIELDS = Object.keys(FIELDS) as SurfaceField[];
export const SURFACE_STYLES: SurfaceStyle[] = ["relief", "bands"];

export const SURFACE_STYLE_LABELS: Record<SurfaceStyle, string> = {
  relief: "Relief",
  bands: "Two-tone bands",
};

export function isSurfacePattern(pattern: PatternType): pattern is SurfacePattern {
  return parseSurfacePattern(pattern) !== null;
}

export function parseSurfacePattern(
  pattern: PatternType
): { style: SurfaceStyle; field: SurfaceField } | null {
  for (const style of SURFACE_STYLES) {
    if (pattern.startsWith(`${style}-`)) {
      const field = pattern.slice(style.length + 1) as SurfaceField;
      if (field in FIELDS) return { style, field };
    }
  }
  return null;
}

export function surfaceFieldLabel(field: SurfaceField): string {
  return FIELDS[field].label;
}

export function surfaceReliefGamma(field: SurfaceField): number {
  return FIELDS[field].gamma;
}

export function makeSurfaceField(
  field: SurfaceField,
  style: SurfaceStyle,
  width: number,
  height: number,
  seed: number
): FieldFn {
  return FIELDS[field].make(width, height, seededRng(seed), style);
}
