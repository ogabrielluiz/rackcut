import { SLOT_WIDTH, SLOT_HEIGHT } from "../constants";
import type { HoleStyle, SurfacePattern } from "../types";
import { makeSurfaceField, parseSurfacePattern, surfaceReliefGamma } from "./fields";

/** Radius kept flat around a mounting hole so an M3 screw head seats on it (mm) */
export const SCREW_SEAT_RADIUS = 3.3;
/** Distance over which the surface rises from the flat seat to full height (mm) */
const SEAT_BLEND = 1.4;
/** Width over which a band edge ramps in the height map, which smooths it in previews (mm) */
const BAND_CHAMFER = 0.4;
/** Relief eases to the panel face over this distance from the outline (mm) */
const EDGE_FADE = 0.6;

export interface Heightmap {
  /** Samples along x and y; sample (i, j) sits at (i * dx, j * dy) */
  nx: number;
  ny: number;
  dx: number;
  dy: number;
  /** Height above the panel face in mm, row-major, length nx * ny */
  heights: Float32Array;
  /** Peak height the map was built for, in mm */
  depth: number;
}

/** Options locating the mounting holes, which the surface must stay clear of. */
export interface HoleOptions {
  holes?: [number, number][];
  holeStyle?: HoleStyle;
}

export interface HeightmapOptions extends HoleOptions {
  /** Target sample spacing in mm */
  cell: number;
  /** Peak height above the panel face in mm */
  depth: number;
}

/** Sample the raw field (p in [0, 1]) on a grid covering the panel. */
export function sampleField(
  pattern: SurfacePattern,
  width: number,
  height: number,
  seed: number,
  cell: number
): { nx: number; ny: number; dx: number; dy: number; p: Float32Array } {
  const parsed = parseSurfacePattern(pattern)!;
  const field = makeSurfaceField(parsed.field, parsed.style, width, height, seed);
  const nx = Math.max(2, Math.round(width / cell) + 1);
  const ny = Math.max(2, Math.round(height / cell) + 1);
  const dx = width / (nx - 1);
  const dy = height / (ny - 1);
  const p = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) p[j * nx + i] = field(i * dx, j * dy);
  }
  return { nx, ny, dx, dy, p };
}

/**
 * Sample the field with the screw seats applied: p falls to 0 around each
 * mounting hole, so bands stop short of it and relief flattens to the face.
 */
export function sampleSurface(
  pattern: SurfacePattern,
  width: number,
  height: number,
  seed: number,
  cell: number,
  options: HoleOptions = {}
): { nx: number; ny: number; dx: number; dy: number; p: Float32Array } {
  const sampled = sampleField(pattern, width, height, seed, cell);
  const { nx, ny, dx, dy, p } = sampled;
  const holes = options.holes ?? [];
  // A slot is a circle swept along x; measure distance to its centre segment
  const slotHalf = options.holeStyle === "slot" ? (SLOT_WIDTH - SLOT_HEIGHT) / 2 : 0;

  for (let j = 0; j < ny; j++) {
    const y = j * dy;
    for (let i = 0; i < nx; i++) {
      const x = i * dx;
      let seat = 1;
      for (const [hx, hy] of holes) {
        const ax = Math.max(Math.abs(x - hx) - slotHalf, 0);
        const d = Math.hypot(ax, y - hy);
        const t = Math.min(1, Math.max(0, (d - SCREW_SEAT_RADIUS) / SEAT_BLEND));
        seat = Math.min(seat, t * t * (3 - 2 * t));
      }
      p[j * nx + i] *= seat;
    }
  }
  return sampled;
}

/**
 * Height map of a surface pattern. Relief is exported straight from it. For
 * bands it only drives the previews: their export traces the band outlines
 * instead, to get vertical walls.
 */
export function buildHeightmap(
  pattern: SurfacePattern,
  width: number,
  height: number,
  seed: number,
  options: HeightmapOptions
): Heightmap {
  const { style, field } = parseSurfacePattern(pattern)!;
  const { depth } = options;
  const { nx, ny, dx, dy, p } = sampleSurface(pattern, width, height, seed, options.cell, options);

  const heights = new Float32Array(nx * ny);

  if (style === "bands") {
    // Dividing by the gradient turns p into a distance from the band edge,
    // so the chamfer has the same width everywhere.
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const i0 = Math.max(i - 1, 0), i1 = Math.min(i + 1, nx - 1);
        const j0 = Math.max(j - 1, 0), j1 = Math.min(j + 1, ny - 1);
        const gx = (p[j * nx + i1] - p[j * nx + i0]) / ((i1 - i0) * dx);
        const gy = (p[j1 * nx + i] - p[j0 * nx + i]) / ((j1 - j0) * dy);
        const grad = Math.max(Math.hypot(gx, gy), 1e-4);
        const t = 0.5 + (p[j * nx + i] - 0.5) / (grad * BAND_CHAMFER);
        heights[j * nx + i] = depth * Math.min(1, Math.max(0, t));
      }
    }
  } else {
    const gamma = surfaceReliefGamma(field);
    for (let j = 0; j < ny; j++) {
      const y = j * dy;
      for (let i = 0; i < nx; i++) {
        const x = i * dx;
        const edge = Math.min(x, width - x, y, height - y);
        const fade = Math.min(1, edge / EDGE_FADE);
        heights[j * nx + i] = depth * Math.pow(p[j * nx + i], gamma) * fade;
      }
    }
  }

  return { nx, ny, dx, dy, heights, depth };
}
