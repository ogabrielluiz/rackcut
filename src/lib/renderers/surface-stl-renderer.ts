import type { Manifold, ManifoldToplevel } from "manifold-3d";
import type { PlacedPanel, SurfacePattern } from "../types";
import { parseSurfacePattern } from "../surfaces/fields";
import { buildHeightmap, sampleSurface, type Heightmap } from "../surfaces/heightmap";
import { traceContours } from "../surfaces/contours";
import { getManifold, meshToStl, scoped, subtractHoles, toPrintFrame, type Own } from "./manifold";

/**
 * STL renderer for surface patterns. Same conventions as stl-renderer: the
 * panel sits on the XY plane with Z up, and the pattern rises above `thickness`.
 *
 * Relief is one closed mesh: a grid of top vertices lifted by the height map,
 * vertical walls down to z = 0, and a fan closing the bottom.
 *
 * Bands are flat plateaus with vertical walls: the band outlines are traced
 * from the field, cleaned up in 2D, and extruded onto a plain slab.
 */

/** Grid spacing of the relief mesh (mm) */
export const RELIEF_MESH_CELL = 0.35;
/** Sample spacing used to trace band outlines (mm) */
export const BANDS_TRACE_CELL = 0.2;
/** Triangles are merged while the surface stays within this distance (mm) */
const SIMPLIFY_TOLERANCE = 0.02;
/** Bands and the gaps between them are never narrower than one nozzle line (mm) */
const MIN_BAND_FEATURE = 0.45;

/** Build vertex and triangle arrays for a slab whose top follows the height map. */
export function heightmapToMesh(
  map: Heightmap,
  thickness: number
): { vertProperties: Float32Array; triVerts: Uint32Array } {
  const { nx, ny, dx, dy, heights } = map;

  // Perimeter grid indices, counter-clockwise seen from +z
  const perimeter: number[] = [];
  for (let i = 0; i < nx - 1; i++) perimeter.push(i);
  for (let j = 0; j < ny - 1; j++) perimeter.push(j * nx + nx - 1);
  for (let i = nx - 1; i > 0; i--) perimeter.push((ny - 1) * nx + i);
  for (let j = ny - 1; j > 0; j--) perimeter.push(j * nx);

  const topCount = nx * ny;
  const rim = perimeter.length;
  const centre = topCount + rim;
  const vertProperties = new Float32Array((topCount + rim + 1) * 3);
  const triVerts = new Uint32Array(((nx - 1) * (ny - 1) * 2 + rim * 3) * 3);

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const v = (j * nx + i) * 3;
      vertProperties[v] = i * dx;
      vertProperties[v + 1] = j * dy;
      vertProperties[v + 2] = thickness + heights[j * nx + i];
    }
  }
  perimeter.forEach((top, k) => {
    const v = (topCount + k) * 3;
    vertProperties[v] = vertProperties[top * 3];
    vertProperties[v + 1] = vertProperties[top * 3 + 1];
    vertProperties[v + 2] = 0;
  });
  vertProperties[centre * 3] = ((nx - 1) * dx) / 2;
  vertProperties[centre * 3 + 1] = ((ny - 1) * dy) / 2;
  vertProperties[centre * 3 + 2] = 0;

  let t = 0;
  const tri = (a: number, b: number, c: number) => {
    triVerts[t++] = a; triVerts[t++] = b; triVerts[t++] = c;
  };

  // Top surface
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const v00 = j * nx + i;
      const v10 = v00 + 1;
      const v01 = v00 + nx;
      const v11 = v01 + 1;
      tri(v00, v10, v11);
      tri(v00, v11, v01);
    }
  }
  // Walls and bottom
  for (let k = 0; k < rim; k++) {
    const next = (k + 1) % rim;
    const topA = perimeter[k];
    const topB = perimeter[next];
    const botA = topCount + k;
    const botB = topCount + next;
    tri(botA, botB, topB);
    tri(botA, topB, topA);
    tri(centre, botB, botA);
  }

  return { vertProperties, triVerts };
}

/**
 * Closed outlines of the raised bands, in panel coordinates. Outlines may
 * overshoot the panel edge by up to one sample; clip them to the panel.
 */
export function traceBandOutlines(
  p: Float32Array,
  nx: number,
  ny: number,
  dx: number,
  dy: number
): [number, number][][] {
  // A ring of "off" samples around the grid closes every outline
  const px = nx + 2;
  const py = ny + 2;
  const padded = new Float32Array(px * py);
  for (let j = 0; j < ny; j++) padded.set(p.subarray(j * nx, (j + 1) * nx), (j + 1) * px + 1);

  return traceContours(padded, px, py, dx, dy, 0.5)
    .map((loop) => loop.slice(0, -1).map(([x, y]): [number, number] => [x - dx, y - dy]))
    .filter((loop) => loop.length >= 3);
}

function reliefBody(
  wasm: ManifoldToplevel,
  panel: PlacedPanel,
  pattern: SurfacePattern,
  thickness: number,
  depth: number,
  cell: number
): Manifold {
  const { Manifold, Mesh } = wasm;
  const spec = panel.spec;
  const map = buildHeightmap(pattern, spec.width, spec.height, panel.patternSeed, {
    cell,
    depth,
    holes: spec.holes,
    holeStyle: spec.holeStyle,
  });
  const { vertProperties, triVerts } = heightmapToMesh(map, thickness);
  return new Manifold(new Mesh({ numProp: 3, vertProperties, triVerts }));
}

function bandsBody(
  wasm: ManifoldToplevel,
  own: Own,
  panel: PlacedPanel,
  pattern: SurfacePattern,
  thickness: number,
  depth: number,
  cell: number
): Manifold {
  const { Manifold, CrossSection } = wasm;
  const spec = panel.spec;
  const { nx, ny, dx, dy, p } = sampleSurface(pattern, spec.width, spec.height, panel.patternSeed, cell, {
    holes: spec.holes,
    holeStyle: spec.holeStyle,
  });

  // Opening then closing by half a nozzle line drops slivers and fills hairline
  // gaps the printer could not reproduce.
  const r = MIN_BAND_FEATURE / 2;
  const outlines = own(CrossSection.ofPolygons(traceBandOutlines(p, nx, ny, dx, dy), "EvenOdd"));
  const eroded = own(outlines.offset(-r, "Round", 2, 16));
  const opened = own(eroded.offset(2 * r, "Round", 2, 16));
  const closed = own(opened.offset(-r, "Round", 2, 16));
  const clipped = own(closed.intersect(own(CrossSection.square([spec.width, spec.height]))));
  const bands = own(clipped.simplify(SIMPLIFY_TOLERANCE));

  const slab = Manifold.cube([spec.width, spec.height, thickness]);
  if (bands.isEmpty()) return slab;
  const raised = own(own(Manifold.extrude(bands, depth)).translate([0, 0, thickness]));
  return own(slab).add(raised);
}

/**
 * Generate the binary STL for a panel carrying a surface pattern.
 *
 * @param thickness Panel thickness; the pattern rises above it
 * @param depth Peak pattern height above the panel face
 * @param cell Sample spacing in mm; defaults to the export resolution of the style
 */
export async function generateSurfacePanelStl(
  panel: PlacedPanel,
  thickness: number,
  depth: number,
  cell?: number
): Promise<ArrayBuffer> {
  const parsed = parseSurfacePattern(panel.pattern);
  if (!parsed) throw new Error(`Not a surface pattern: ${panel.pattern}`);
  const pattern = panel.pattern as SurfacePattern;
  const wasm = await getManifold();

  return scoped((own) => {
    const raw = own(
      parsed.style === "relief"
        ? reliefBody(wasm, panel, pattern, thickness, depth, cell ?? RELIEF_MESH_CELL)
        : bandsBody(wasm, own, panel, pattern, thickness, depth, cell ?? BANDS_TRACE_CELL)
    );
    const holed = own(subtractHoles(wasm, raw, panel.spec, thickness + depth));
    const body = own(holed.simplify(SIMPLIFY_TOLERANCE));
    if (body.isEmpty()) throw new Error(`Surface mesh for ${panel.label} came out empty`);
    return meshToStl(own(toPrintFrame(body, panel.spec.height)).getMesh());
  });
}
