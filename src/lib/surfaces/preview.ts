import { DEFAULT_PATTERN_HEIGHT, DEFAULT_RELIEF_HEIGHT } from "../constants";
import type { SurfacePattern } from "../types";
import { parseSurfacePattern } from "./fields";
import { buildHeightmap, type Heightmap, type HoleOptions } from "./heightmap";

/** Sample spacing for 2D previews (mm) */
const PREVIEW_CELL = 0.3;
/** Light direction for relief shading: from the upper left, in image coordinates */
const LIGHT: [number, number, number] = (() => {
  const v = [-0.55, -0.6, 0.58];
  const n = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / n, v[1] / n, v[2] / n];
})();

function hexToRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

/**
 * Encode an 8-bit paletted image as a BMP data URL. BMP needs no canvas, so
 * previews render the same in the browser and in tests.
 */
export function encodeBmpDataUrl(
  indices: Uint8Array,
  width: number,
  height: number,
  palette: [number, number, number][]
): string {
  const rowSize = (width + 3) & ~3;
  const dataOffset = 14 + 40 + 256 * 4;
  const bytes = new Uint8Array(dataOffset + rowSize * height);
  const view = new DataView(bytes.buffer);
  bytes[0] = 0x42; bytes[1] = 0x4d; // "BM"
  view.setUint32(2, bytes.length, true);
  view.setUint32(10, dataOffset, true);
  view.setUint32(14, 40, true); // DIB header size
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true); // planes
  view.setUint16(28, 8, true); // bits per pixel
  view.setUint32(34, rowSize * height, true);
  view.setUint32(46, 256, true); // palette size
  for (let i = 0; i < 256; i++) {
    const [r, g, b] = palette[i];
    bytes.set([b, g, r, 0], 54 + i * 4);
  }
  // Rows are stored bottom-up
  for (let y = 0; y < height; y++) {
    bytes.set(indices.subarray(y * width, (y + 1) * width), dataOffset + (height - 1 - y) * rowSize);
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:image/bmp;base64,${btoa(binary)}`;
}

/** Render a height map to an image: lit relief, or flat two-tone bands. */
export function renderHeightmapImage(
  map: Heightmap,
  style: "relief" | "bands",
  baseColor: string,
  accentColor: string
): string {
  const { nx, ny, dx, dy, heights, depth } = map;
  const base = hexToRgb(baseColor);
  const accent = hexToRgb(accentColor);
  const indices = new Uint8Array(nx * ny);
  const palette: [number, number, number][] = [];

  if (style === "bands") {
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      palette.push(base.map((c, k) => Math.round(c + (accent[k] - c) * t)) as [number, number, number]);
    }
    for (let k = 0; k < heights.length; k++) indices[k] = Math.round((heights[k] / depth) * 255);
  } else {
    // Index 128 is a flat face and shows the filament colour unchanged
    for (let i = 0; i < 256; i++) {
      const f = i / 128;
      palette.push(base.map((c) =>
        Math.round(f <= 1 ? c * (0.28 + 0.72 * f) : c + (255 - c) * (f - 1) * 0.75)
      ) as [number, number, number]);
    }
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const i0 = Math.max(i - 1, 0), i1 = Math.min(i + 1, nx - 1);
        const j0 = Math.max(j - 1, 0), j1 = Math.min(j + 1, ny - 1);
        const gx = (heights[j * nx + i1] - heights[j * nx + i0]) / ((i1 - i0) * dx);
        const gy = (heights[j1 * nx + i] - heights[j0 * nx + i]) / ((j1 - j0) * dy);
        const lit = (-gx * LIGHT[0] - gy * LIGHT[1] + LIGHT[2]) / Math.hypot(gx, gy, 1);
        indices[j * nx + i] = Math.min(255, Math.max(0, Math.round((lit / LIGHT[2]) * 128)));
      }
    }
  }
  return encodeBmpDataUrl(indices, nx, ny, palette);
}

const cache = new Map<string, string>();
const CACHE_LIMIT = 64;

/**
 * Data URL of a surface pattern as it will print at the default heights.
 * Cached per pattern, size, seed and colours.
 */
export function surfacePreviewImage(
  pattern: SurfacePattern,
  width: number,
  height: number,
  seed: number,
  baseColor: string,
  accentColor: string,
  options: HoleOptions = {}
): string {
  const key = JSON.stringify([pattern, width, height, seed, baseColor, accentColor, options]);
  const hit = cache.get(key);
  if (hit) return hit;
  const { style } = parseSurfacePattern(pattern)!;
  const depth = style === "relief" ? DEFAULT_RELIEF_HEIGHT : DEFAULT_PATTERN_HEIGHT;
  const map = buildHeightmap(pattern, width, height, seed, { ...options, cell: PREVIEW_CELL, depth });
  const url = renderHeightmapImage(map, style, baseColor, accentColor);
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  cache.set(key, url);
  return url;
}
