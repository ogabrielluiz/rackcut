import type { CrossSection, Manifold, ManifoldToplevel, Mesh } from "manifold-3d";
import type { PanelSpec } from "../types";
import { HOLE_DIAMETER, SLOT_WIDTH, SLOT_HEIGHT } from "../constants";

/**
 * Shared manifold-3d plumbing for the STL renderers.
 * All dimensions in mm. Panels sit on the XY plane with Z up.
 */

// manifold-3d is loaded lazily since it's a WASM module
let manifoldModule: ManifoldToplevel | null = null;

export async function getManifold(): Promise<ManifoldToplevel> {
  if (manifoldModule) return manifoldModule;
  try {
    const Module = (await import("manifold-3d")).default;
    const wasm = await Module();
    wasm.setup();
    manifoldModule = wasm;
    return wasm;
  } catch (e) {
    manifoldModule = null; // allow retry on next call
    throw new Error(`Failed to load 3D engine: ${e instanceof Error ? e.message : "unknown error"}`);
  }
}

/** Registers a WASM object to be freed when its scope ends, and hands it back */
export type Own = <O extends { delete(): void }>(object: O) => O;

/**
 * Run `build`, then free every WASM object it registered through `own`.
 *
 * manifold-3d objects live on the WASM heap and are otherwise only released
 * by finalizers, which do not get a turn inside a loop of awaited exports.
 * Large meshes exhaust the heap long before that, so anything that is not
 * returned has to be freed by hand.
 */
export function scoped<T>(build: (own: Own) => T): T {
  const owned = new Set<{ delete(): void }>();
  try {
    return build((object) => {
      owned.add(object);
      return object;
    });
  } finally {
    for (const object of owned) object.delete();
  }
}

/**
 * Cut the mounting holes through a body that spans z = 0..height.
 * Returns a new body, or the given one when the panel has no holes; the
 * caller keeps ownership of both.
 */
export function subtractHoles(wasm: ManifoldToplevel, body: Manifold, spec: PanelSpec, height: number): Manifold {
  const { Manifold, CrossSection } = wasm;
  return scoped((own) => {
    let result = body;
    for (const [cx, cy] of spec.holes) {
      let holeCrossSection: CrossSection;

      if (spec.holeStyle === "circle") {
        holeCrossSection = CrossSection.circle(HOLE_DIAMETER / 2, 32);
      } else {
        // Slot: stadium shape (rectangle with semicircle caps on left/right)
        // SLOT_WIDTH > SLOT_HEIGHT, so caps are semicircles of radius SLOT_HEIGHT/2
        const hw = SLOT_WIDTH / 2;  // half width (horizontal)
        const r = SLOT_HEIGHT / 2;  // cap radius = half height
        const straight = hw - r;    // length of straight section

        const points: [number, number][] = [];
        const steps = 16;
        // Right semicircle (from -90 to +90 degrees)
        for (let i = 0; i <= steps; i++) {
          const angle = -Math.PI / 2 + (i / steps) * Math.PI;
          points.push([straight + Math.cos(angle) * r, Math.sin(angle) * r]);
        }
        // Left semicircle (from +90 to +270 degrees)
        for (let i = 0; i <= steps; i++) {
          const angle = Math.PI / 2 + (i / steps) * Math.PI;
          points.push([-straight + Math.cos(angle) * r, Math.sin(angle) * r]);
        }

        holeCrossSection = CrossSection.ofPolygons([points]);
      }

      const column = own(Manifold.extrude(own(holeCrossSection), height + 1));
      const hole = own(column.translate([cx, cy, -0.5]));
      const cut = result.subtract(hole);
      if (result !== body) own(result);
      result = cut;
    }
    return result;
  });
}

/**
 * Panels are modelled in sheet coordinates, where y runs down. Flip y so the
 * finished solid, seen from the front, matches the 2D sheet rather than its
 * mirror image.
 */
export function toPrintFrame(body: Manifold, height: number): Manifold {
  return scoped((own) => own(body.mirror([0, 1, 0])).translate([0, height, 0]));
}

/**
 * Convert a manifold mesh to binary STL format.
 *
 * Triangles whose corners coincide once stored as 32-bit floats are left out:
 * they have no area, and a slicer reads them as a broken surface.
 */
export function meshToStl(mesh: Pick<Mesh, "numProp" | "numTri" | "vertProperties" | "triVerts">): ArrayBuffer {
  const numProp = mesh.numProp;
  const vertProps = mesh.vertProperties;
  const triVerts = mesh.triVerts;

  const samePoint = (a: number, b: number) =>
    vertProps[a * numProp] === vertProps[b * numProp] &&
    vertProps[a * numProp + 1] === vertProps[b * numProp + 1] &&
    vertProps[a * numProp + 2] === vertProps[b * numProp + 2];

  const kept: number[] = [];
  for (let t = 0; t < mesh.numTri; t++) {
    const i0 = triVerts[t * 3];
    const i1 = triVerts[t * 3 + 1];
    const i2 = triVerts[t * 3 + 2];
    if (!samePoint(i0, i1) && !samePoint(i1, i2) && !samePoint(i2, i0)) kept.push(t);
  }
  const numTri = kept.length;

  // Binary STL: 80 byte header + 4 byte triangle count + 50 bytes per triangle
  const bufferSize = 80 + 4 + numTri * 50;
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);

  // Header (80 bytes) — "rackcut"
  const header = new TextEncoder().encode("rackcut STL export");
  new Uint8Array(buffer, 0, header.length).set(header);

  // Triangle count
  view.setUint32(80, numTri, true);

  let offset = 84;
  for (const t of kept) {
    const i0 = triVerts[t * 3];
    const i1 = triVerts[t * 3 + 1];
    const i2 = triVerts[t * 3 + 2];

    // Get vertices
    const v0 = [vertProps[i0 * numProp], vertProps[i0 * numProp + 1], vertProps[i0 * numProp + 2]];
    const v1 = [vertProps[i1 * numProp], vertProps[i1 * numProp + 1], vertProps[i1 * numProp + 2]];
    const v2 = [vertProps[i2 * numProp], vertProps[i2 * numProp + 1], vertProps[i2 * numProp + 2]];

    // Compute normal
    const e1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
    const e2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];
    const nx = e1[1] * e2[2] - e1[2] * e2[1];
    const ny = e1[2] * e2[0] - e1[0] * e2[2];
    const nz = e1[0] * e2[1] - e1[1] * e2[0];
    const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;

    // Normal
    view.setFloat32(offset, nx / nl, true); offset += 4;
    view.setFloat32(offset, ny / nl, true); offset += 4;
    view.setFloat32(offset, nz / nl, true); offset += 4;

    // Vertex 1
    view.setFloat32(offset, v0[0], true); offset += 4;
    view.setFloat32(offset, v0[1], true); offset += 4;
    view.setFloat32(offset, v0[2], true); offset += 4;

    // Vertex 2
    view.setFloat32(offset, v1[0], true); offset += 4;
    view.setFloat32(offset, v1[1], true); offset += 4;
    view.setFloat32(offset, v1[2], true); offset += 4;

    // Vertex 3
    view.setFloat32(offset, v2[0], true); offset += 4;
    view.setFloat32(offset, v2[1], true); offset += 4;
    view.setFloat32(offset, v2[2], true); offset += 4;

    // Attribute byte count (unused)
    view.setUint16(offset, 0, true); offset += 2;
  }

  return buffer;
}
