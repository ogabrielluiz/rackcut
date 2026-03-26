import type { PatternGeometry } from "../pattern-geometry/types";
import type { PlacedPanel } from "../types";
import { HOLE_DIAMETER, SLOT_WIDTH, SLOT_HEIGHT } from "../constants";

/**
 * STL renderer using manifold-3d.
 *
 * Converts panel specs + pattern geometry into binary STL data.
 * All dimensions in mm. The panel sits on the XY plane with Z up.
 */

// manifold-3d is loaded lazily since it's a WASM module
let manifoldModule: any = null;

async function getManifold() {
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

/**
 * Generate a 3D mesh for a single panel and return binary STL data.
 */
export async function generatePanelStl(
  panel: PlacedPanel,
  thickness: number,
  patternHeight: number,
  patternGeometry: PatternGeometry,
  engraveMode: "extrude" | "recess" = "extrude"
): Promise<ArrayBuffer> {
  const { Manifold, CrossSection } = await getManifold();
  const spec = panel.spec;

  // 1. Panel body
  let body = Manifold.cube([spec.width, spec.height, thickness]);

  // 2. Subtract mounting holes
  for (const [cx, cy] of spec.holes) {
    let holeCrossSection: any;

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

    const hole = Manifold.extrude(holeCrossSection, thickness + 1)
      .translate([cx, cy, -0.5]);
    body = body.subtract(hole);
  }

  // 3. Extrude pattern geometry on top of the panel
  // Strategy: build 2D cross-sections using CrossSection.hull() for smooth
  // capsule-shaped segments, merge them in 2D (fast Clipper2 boolean), then
  // extrude the merged 2D shape once into 3D.
  if (patternHeight > 0) {
    const patternMeshes: any[] = [];
    const strokeR = 0.125; // half stroke width
    const circleRes = 8; // resolution for stroke circles (low is fine at 0.25mm)
    const MAX_MESHES = 500; // limit total 3D meshes

    // Helper: build a 2D cross-section from a polyline by hulling circles at each segment
    function pathToCrossSection(points: [number, number][]): any {
      let shape: any = null;
      for (let i = 0; i < points.length - 1; i++) {
        const seg = CrossSection.hull([
          CrossSection.circle(strokeR, circleRes).translate(points[i]),
          CrossSection.circle(strokeR, circleRes).translate(points[i + 1]),
        ]);
        shape = shape ? shape.add(seg) : seg;
      }
      return shape;
    }

    // Helper: build a 2D cross-section for a single line segment
    function lineToCrossSection(x1: number, y1: number, x2: number, y2: number): any {
      return CrossSection.hull([
        CrossSection.circle(strokeR, circleRes).translate([x1, y1]),
        CrossSection.circle(strokeR, circleRes).translate([x2, y2]),
      ]);
    }

    // Clip cross-section to panel bounds
    const panelClip = CrossSection.square([spec.width, spec.height]);

    // --- Lines ---
    // Group all lines into one 2D cross-section, then extrude once
    if (patternGeometry.lines.length > 0) {
      const lines = patternGeometry.lines;
      const step = Math.max(1, Math.ceil(lines.length / 2000));
      let lineShape: any = null;
      for (let i = 0; i < lines.length; i += step) {
        const { x1, y1, x2, y2 } = lines[i];
        const seg = lineToCrossSection(x1, y1, x2, y2);
        lineShape = lineShape ? lineShape.add(seg) : seg;
      }
      if (lineShape) {
        lineShape = lineShape.intersect(panelClip);
        if (lineShape.area() > 0) {
          patternMeshes.push(
            Manifold.extrude(lineShape, patternHeight).translate([0, 0, engraveMode === "recess" ? thickness - patternHeight : thickness])
          );
        }
      }
    }

    // --- Paths ---
    // Each path becomes one 2D cross-section, then one 3D extrusion
    const validPaths = patternGeometry.paths.filter(p => p.points.length >= 2);
    const maxPaths = Math.min(validPaths.length, MAX_MESHES - patternMeshes.length);
    const pathStep = Math.max(1, Math.ceil(validPaths.length / maxPaths));

    for (let pi = 0; pi < validPaths.length && patternMeshes.length < MAX_MESHES; pi += pathStep) {
      const pts = validPaths[pi].points;
      // Sample points if path is very long
      let sampled = pts;
      if (pts.length > 200) {
        const s = Math.ceil(pts.length / 200);
        sampled = pts.filter((_, i) => i % s === 0 || i === pts.length - 1);
      }
      const shape = pathToCrossSection(sampled);
      if (shape) {
        const clipped = shape.intersect(panelClip);
        if (clipped.area() > 0) {
          patternMeshes.push(
            Manifold.extrude(clipped, patternHeight).translate([0, 0, engraveMode === "recess" ? thickness - patternHeight : thickness])
          );
        }
      }
    }

    // --- Circles ---
    for (const circle of patternGeometry.circles) {
      if (patternMeshes.length >= MAX_MESHES) break;
      if (circle.cx + circle.r < 0 || circle.cx - circle.r > spec.width ||
          circle.cy + circle.r < 0 || circle.cy - circle.r > spec.height) continue;
      const outer = CrossSection.circle(circle.r + strokeR, 32).translate([circle.cx, circle.cy]);
      const inner = CrossSection.circle(Math.max(0.05, circle.r - strokeR), 32).translate([circle.cx, circle.cy]);
      const ring = outer.subtract(inner).intersect(panelClip);
      if (ring.area() > 0) {
        patternMeshes.push(
          Manifold.extrude(ring, patternHeight).translate([0, 0, engraveMode === "recess" ? thickness - patternHeight : thickness])
        );
      }
    }

    // --- Polygons ---
    for (const polygon of patternGeometry.polygons) {
      if (polygon.points.length < 3 || patternMeshes.length >= MAX_MESHES) continue;
      const shape = pathToCrossSection([...polygon.points, polygon.points[0]]);
      if (shape) {
        const clipped = shape.intersect(panelClip);
        if (clipped.area() > 0) {
          patternMeshes.push(
            Manifold.extrude(clipped, patternHeight).translate([0, 0, engraveMode === "recess" ? thickness - patternHeight : thickness])
          );
        }
      }
    }

    // --- Rects ---
    for (const rect of patternGeometry.rects) {
      if (patternMeshes.length >= MAX_MESHES) break;
      const { x, y, width, height } = rect;
      const corners: [number, number][] = [[x, y], [x + width, y], [x + width, y + height], [x, y + height], [x, y]];
      const shape = pathToCrossSection(corners);
      if (shape) {
        const clipped = shape.intersect(panelClip);
        if (clipped.area() > 0) {
          patternMeshes.push(
            Manifold.extrude(clipped, patternHeight).translate([0, 0, engraveMode === "recess" ? thickness - patternHeight : thickness])
          );
        }
      }
    }

    // Texts — render "0" and "1" as 3D polygon glyphs
    for (const text of patternGeometry.texts) {
      if (patternMeshes.length >= MAX_MESHES) break;
      const h = text.fontSize * 0.8;
      const w = text.fontSize * 0.5;
      const sw = text.fontSize * 0.12; // stroke width for "0" outline
      const cx = text.x + w / 2;
      const cy = text.y - h * 0.35;
      const zOff = engraveMode === "recess" ? thickness - patternHeight : thickness;

      let glyph: any = null;

      if (text.text === "1") {
        // "1" = thin vertical bar with a serif foot and angled top
        const barW = w * 0.3;
        const bar = CrossSection.square([barW, h]).translate([cx - barW / 2, cy - h / 2]);
        const foot = CrossSection.square([w * 0.6, sw]).translate([cx - w * 0.3, cy - h / 2]);
        const serif = CrossSection.ofPolygons([[
          [cx - barW / 2, cy + h / 2],
          [cx - w * 0.35, cy + h * 0.3],
          [cx - barW / 2, cy + h * 0.3],
        ]]);
        glyph = bar.add(foot).add(serif);
      } else if (text.text === "0") {
        // "0" = ellipse ring (outer - inner)
        const outer = CrossSection.circle(1, 16)
          .scale([w / 2, h / 2])
          .translate([cx, cy]);
        const inner = CrossSection.circle(1, 16)
          .scale([w / 2 - sw, h / 2 - sw])
          .translate([cx, cy]);
        glyph = outer.subtract(inner);
      }

      if (glyph) {
        const clipped = glyph.intersect(panelClip);
        if (clipped.area() > 0) {
          patternMeshes.push(
            Manifold.extrude(clipped, patternHeight).translate([0, 0, zOff])
          );
        }
      }
    }

    // Add (extrude) or subtract (recess) pattern from panel body
    if (patternMeshes.length > 0) {
      if (engraveMode === "recess") {
        // Recess requires proper boolean subtraction — union first for watertight mesh
        const pattern = Manifold.union(patternMeshes);
        body = body.subtract(pattern);
      } else {
        // Extrude can use fast compose (concatenation)
        const pattern = Manifold.compose(patternMeshes);
        body = body.add(pattern);
      }
    }
  }

  // 4. Export as binary STL
  return meshToStl(body.getMesh());
}


/**
 * Convert a manifold mesh to binary STL format.
 */
function meshToStl(mesh: any): ArrayBuffer {
  const numTri = mesh.numTri;
  const numProp = mesh.numProp;
  const vertProps = mesh.vertProperties;
  const triVerts = mesh.triVerts;

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
  for (let t = 0; t < numTri; t++) {
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

/**
 * Generate STL files for all panels and return as a ZIP.
 */
export async function generateAllPanelsStlZip(
  panels: PlacedPanel[],
  thickness: number,
  patternHeight: number,
  getGeometry: (panel: PlacedPanel) => PatternGeometry,
  engraveMode: "extrude" | "recess" = "extrude"
): Promise<Blob> {
  // Simple ZIP implementation (no compression — STL is binary, compression saves little)
  const files: { name: string; data: ArrayBuffer }[] = [];

  const errors: string[] = [];
  for (let i = 0; i < panels.length; i++) {
    const panel = panels[i];
    try {
      const geometry = getGeometry(panel);
      const stlData = await generatePanelStl(panel, thickness, patternHeight, geometry, engraveMode);
      const name = `${panel.label.replace(/\s+/g, "-")}-${panel.patternSeed}.stl`;
      files.push({ name, data: stlData });
    } catch (e) {
      errors.push(`Panel ${i + 1} (${panel.label}): ${e instanceof Error ? e.message : "unknown error"}`);
    }
  }

  if (files.length === 0 && errors.length > 0) {
    throw new Error(`All panels failed to generate:\n${errors.join("\n")}`);
  }

  return createZip(files);
}

/**
 * Minimal ZIP file creator (no compression).
 */
function createZip(files: { name: string; data: ArrayBuffer }[]): Blob {
  const parts: Uint8Array[] = [];
  const centralDir: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name);
    const dataBytes = new Uint8Array(file.data);
    const fileCrc = crc32(dataBytes); // compute once, reuse

    // Local file header (30 + name + data)
    const localHeader = new ArrayBuffer(30 + nameBytes.length);
    const lv = new DataView(localHeader);
    lv.setUint32(0, 0x04034b50, true); // signature
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0, true); // flags
    lv.setUint16(8, 0, true); // compression (none)
    lv.setUint16(10, 0, true); // mod time
    lv.setUint16(12, 0, true); // mod date
    lv.setUint32(14, fileCrc, true); // CRC-32
    lv.setUint32(18, dataBytes.length, true); // compressed size
    lv.setUint32(22, dataBytes.length, true); // uncompressed size
    lv.setUint16(26, nameBytes.length, true); // name length
    lv.setUint16(28, 0, true); // extra length
    new Uint8Array(localHeader, 30).set(nameBytes);

    parts.push(new Uint8Array(localHeader));
    parts.push(dataBytes);

    // Central directory entry
    const cdEntry = new ArrayBuffer(46 + nameBytes.length);
    const cv = new DataView(cdEntry);
    cv.setUint32(0, 0x02014b50, true); // signature
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, 0, true); // flags
    cv.setUint16(10, 0, true); // compression
    cv.setUint16(12, 0, true); // mod time
    cv.setUint16(14, 0, true); // mod date
    cv.setUint32(16, fileCrc, true); // CRC-32
    cv.setUint32(20, dataBytes.length, true); // compressed size
    cv.setUint32(24, dataBytes.length, true); // uncompressed size
    cv.setUint16(28, nameBytes.length, true); // name length
    cv.setUint16(30, 0, true); // extra length
    cv.setUint16(32, 0, true); // comment length
    cv.setUint16(34, 0, true); // disk number
    cv.setUint16(36, 0, true); // internal attributes
    cv.setUint32(38, 0, true); // external attributes
    cv.setUint32(42, offset, true); // local header offset
    new Uint8Array(cdEntry, 46).set(nameBytes);

    centralDir.push(new Uint8Array(cdEntry));

    offset += 30 + nameBytes.length + dataBytes.length;
  }

  const cdOffset = offset;
  let cdSize = 0;
  for (const cd of centralDir) {
    parts.push(cd);
    cdSize += cd.length;
  }

  // End of central directory
  const eocd = new ArrayBuffer(22);
  const ev = new DataView(eocd);
  ev.setUint32(0, 0x06054b50, true); // signature
  ev.setUint16(4, 0, true); // disk number
  ev.setUint16(6, 0, true); // cd disk
  ev.setUint16(8, files.length, true); // cd entries on disk
  ev.setUint16(10, files.length, true); // total cd entries
  ev.setUint32(12, cdSize, true); // cd size
  ev.setUint32(16, cdOffset, true); // cd offset
  ev.setUint16(20, 0, true); // comment length

  parts.push(new Uint8Array(eocd));

  return new Blob(parts as BlobPart[], { type: "application/zip" });
}

/**
 * CRC-32 computation for ZIP files.
 */
function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
