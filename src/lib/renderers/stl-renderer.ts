import type { PatternGeometry } from "../pattern-geometry/types";
import type { PlacedPanel } from "../types";
import { parseSurfacePattern } from "../surfaces/fields";
import type { ManifoldToplevel } from "manifold-3d";
import { getManifold, meshToStl, scoped, subtractHoles, toPrintFrame, type Own } from "./manifold";
import { generateSurfacePanelStl } from "./surface-stl-renderer";

/**
 * STL renderer using manifold-3d.
 *
 * Converts panel specs + pattern geometry into binary STL data.
 * All dimensions in mm. The panel sits on the XY plane with Z up.
 */

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
  const wasm = await getManifold();

  return scoped((own) => {
    const body = buildPanelBody(wasm, own, panel, thickness, patternHeight, patternGeometry, engraveMode);
    // Export as binary STL
    return meshToStl(own(toPrintFrame(body, panel.spec.height)).getMesh());
  });
}

/**
 * Build the panel solid in sheet coordinates. Every manifold-3d object made
 * along the way goes through `own`, so the caller's scope frees them.
 */
function buildPanelBody(
  wasm: ManifoldToplevel,
  own: Own,
  panel: PlacedPanel,
  thickness: number,
  patternHeight: number,
  patternGeometry: PatternGeometry,
  engraveMode: "extrude" | "recess"
): any {
  const { Manifold, CrossSection } = wasm;
  const spec = panel.spec;

  // 1. Panel body
  let body = own(Manifold.cube([spec.width, spec.height, thickness]));

  // 2. Subtract mounting holes
  body = own(subtractHoles(wasm, body, spec, thickness));

  // 3. Extrude pattern geometry on top of the panel
  // Strategy: build 2D cross-sections using CrossSection.hull() for smooth
  // capsule-shaped segments, merge them in 2D (fast Clipper2 boolean), then
  // extrude the merged 2D shape once into 3D.
  if (patternHeight > 0) {
    const patternMeshes: any[] = [];
    // Raised lines are one nozzle line wide (0.45mm) so a slicer keeps them;
    // recessed lines stay at the 0.25mm engrave width.
    const strokeR = engraveMode === "extrude" ? 0.225 : 0.125;
    const circleRes = 8; // resolution for stroke circles (low is fine at this size)
    const MAX_MESHES = 500; // limit total 3D meshes

    // One stroke-width dot, moved to each end of a segment
    const dot = own(CrossSection.circle(strokeR, circleRes));

    // Helper: build a 2D cross-section for a single line segment
    function lineToCrossSection(x1: number, y1: number, x2: number, y2: number): any {
      return own(CrossSection.hull([own(dot.translate([x1, y1])), own(dot.translate([x2, y2]))]));
    }

    // Helper: build a 2D cross-section from a polyline by hulling circles at each segment
    function pathToCrossSection(points: [number, number][]): any {
      let shape: any = null;
      for (let i = 0; i < points.length - 1; i++) {
        const seg = lineToCrossSection(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]);
        shape = shape ? own(shape.add(seg)) : seg;
      }
      return shape;
    }

    // Clip cross-section to panel bounds
    const panelClip = own(CrossSection.square([spec.width, spec.height]));

    // Clip a 2D shape to the panel and extrude what is left onto the face
    // (or down into it, for recessed patterns)
    const zOffset = engraveMode === "recess" ? thickness - patternHeight : thickness;
    function addToPattern(shape: any) {
      const clipped = own(shape.intersect(panelClip));
      if (clipped.area() > 0) {
        patternMeshes.push(own(own(Manifold.extrude(clipped, patternHeight)).translate([0, 0, zOffset])));
      }
    }

    // --- Lines ---
    // Group all lines into one 2D cross-section, then extrude once
    if (patternGeometry.lines.length > 0) {
      const lines = patternGeometry.lines;
      const step = Math.max(1, Math.ceil(lines.length / 2000));
      let lineShape: any = null;
      for (let i = 0; i < lines.length; i += step) {
        const { x1, y1, x2, y2 } = lines[i];
        const seg = lineToCrossSection(x1, y1, x2, y2);
        lineShape = lineShape ? own(lineShape.add(seg)) : seg;
      }
      if (lineShape) addToPattern(lineShape);
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
      if (shape) addToPattern(shape);
    }

    // --- Circles ---
    for (const circle of patternGeometry.circles) {
      if (patternMeshes.length >= MAX_MESHES) break;
      if (circle.cx + circle.r < 0 || circle.cx - circle.r > spec.width ||
          circle.cy + circle.r < 0 || circle.cy - circle.r > spec.height) continue;
      const outer = own(own(CrossSection.circle(circle.r + strokeR, 32)).translate([circle.cx, circle.cy]));
      const inner = own(own(CrossSection.circle(Math.max(0.05, circle.r - strokeR), 32)).translate([circle.cx, circle.cy]));
      addToPattern(own(outer.subtract(inner)));
    }

    // --- Polygons ---
    for (const polygon of patternGeometry.polygons) {
      if (polygon.points.length < 3 || patternMeshes.length >= MAX_MESHES) continue;
      const shape = pathToCrossSection([...polygon.points, polygon.points[0]]);
      if (shape) addToPattern(shape);
    }

    // --- Rects ---
    for (const rect of patternGeometry.rects) {
      if (patternMeshes.length >= MAX_MESHES) break;
      const { x, y, width, height } = rect;
      const corners: [number, number][] = [[x, y], [x + width, y], [x + width, y + height], [x, y + height], [x, y]];
      const shape = pathToCrossSection(corners);
      if (shape) addToPattern(shape);
    }

    // Texts — render "0" and "1" as 3D polygon glyphs
    for (const text of patternGeometry.texts) {
      if (patternMeshes.length >= MAX_MESHES) break;
      const h = text.fontSize * 0.8;
      const w = text.fontSize * 0.5;
      const sw = text.fontSize * 0.12; // stroke width for "0" outline
      const cx = text.x + w / 2;
      const cy = text.y - h * 0.35;

      let glyph: any = null;

      if (text.text === "1") {
        // "1" = thin vertical bar with a serif foot and angled top.
        // Sheet coordinates: the top of the glyph is at the smaller y.
        const barW = w * 0.3;
        const bar = own(own(CrossSection.square([barW, h])).translate([cx - barW / 2, cy - h / 2]));
        const foot = own(own(CrossSection.square([w * 0.6, sw])).translate([cx - w * 0.3, cy + h / 2 - sw]));
        const serif = own(CrossSection.ofPolygons([[
          [cx - barW / 2, cy - h / 2],
          [cx - barW / 2, cy - h * 0.3],
          [cx - w * 0.35, cy - h * 0.3],
        ]]));
        glyph = own(own(bar.add(foot)).add(serif));
      } else if (text.text === "0") {
        // "0" = ellipse ring (outer - inner)
        const outer = own(own(own(CrossSection.circle(1, 16))
          .scale([w / 2, h / 2]))
          .translate([cx, cy]));
        const inner = own(own(own(CrossSection.circle(1, 16))
          .scale([w / 2 - sw, h / 2 - sw]))
          .translate([cx, cy]));
        glyph = own(outer.subtract(inner));
      }

      if (glyph) addToPattern(glyph);
    }

    // Add (extrude) or subtract (recess) pattern from panel body.
    // The strokes overlap each other, so they are merged with a real union
    // first: concatenating them leaves the export open, and can crash the
    // boolean that follows.
    if (patternMeshes.length > 0) {
      const pattern = own(Manifold.union(patternMeshes));
      body = own(engraveMode === "recess" ? body.subtract(pattern) : body.add(pattern));
    }
  }

  return body;
}

/**
 * Generate STL files for all panels and return as a ZIP.
 */
export async function generateAllPanelsStlZip(
  panels: PlacedPanel[],
  thickness: number,
  patternHeight: number,
  getGeometry: (panel: PlacedPanel) => PatternGeometry,
  engraveMode: "extrude" | "recess" = "extrude",
  reliefHeight: number = patternHeight
): Promise<Blob> {
  // Simple ZIP implementation (no compression — STL is binary, compression saves little)
  const files: { name: string; data: ArrayBuffer }[] = [];

  const errors: string[] = [];
  for (let i = 0; i < panels.length; i++) {
    const panel = panels[i];
    try {
      const surface = parseSurfacePattern(panel.pattern);
      const stlData = surface
        ? await generateSurfacePanelStl(panel, thickness, surface.style === "relief" ? reliefHeight : patternHeight)
        : await generatePanelStl(panel, thickness, patternHeight, getGeometry(panel), engraveMode);
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
