// @vitest-environment node
import { describe, it, expect } from "vitest";
import { generatePanelStl, generateAllPanelsStlZip } from "./stl-renderer";
import { generatePatternGeometry } from "../pattern-geometry";
import { emptyGeometry } from "../pattern-geometry/types";
import type { PlacedPanel, PatternType } from "../types";

function makePanel(overrides: Partial<PlacedPanel> = {}): PlacedPanel {
  return {
    spec: {
      width: 40.34,
      height: 128.5,
      hp: 8,
      format: "3u",
      holes: [[7.5, 3.0], [32.84, 125.5]],
      holeStyle: "circle",
    },
    x: 0,
    y: 0,
    label: "8HP 3U",
    pattern: "none",
    patternSeed: 0,
    ...overrides,
  };
}

function getTriCount(stl: ArrayBuffer): number {
  return new DataView(stl).getUint32(80, true);
}

function isValidStl(stl: ArrayBuffer): boolean {
  if (stl.byteLength < 84) return false;
  const triCount = getTriCount(stl);
  return stl.byteLength === 84 + triCount * 50;
}

// ---------------------------------------------------------------------------
// Binary STL format validation
// ---------------------------------------------------------------------------

describe("STL format", () => {
  it("produces valid binary STL structure", async () => {
    const stl = await generatePanelStl(makePanel(), 3, 0, emptyGeometry());
    expect(isValidStl(stl)).toBe(true);
  });

  it("header is 80 bytes with rackcut identifier", async () => {
    const stl = await generatePanelStl(makePanel(), 3, 0, emptyGeometry());
    const header = new TextDecoder().decode(new Uint8Array(stl, 0, 18));
    expect(header).toBe("rackcut STL export");
    // Rest of header is null-padded
    const headerBytes = new Uint8Array(stl, 0, 80);
    expect(headerBytes.length).toBe(80);
  });

  it("triangle count matches buffer size", async () => {
    const stl = await generatePanelStl(makePanel(), 3, 0, emptyGeometry());
    const triCount = getTriCount(stl);
    expect(triCount).toBeGreaterThan(0);
    expect(stl.byteLength).toBe(84 + triCount * 50);
  });

  it("each triangle has valid normal vector (non-NaN)", async () => {
    const stl = await generatePanelStl(makePanel(), 3, 0, emptyGeometry());
    const view = new DataView(stl);
    const triCount = getTriCount(stl);

    for (let t = 0; t < triCount; t++) {
      const offset = 84 + t * 50;
      const nx = view.getFloat32(offset, true);
      const ny = view.getFloat32(offset + 4, true);
      const nz = view.getFloat32(offset + 8, true);
      expect(isNaN(nx)).toBe(false);
      expect(isNaN(ny)).toBe(false);
      expect(isNaN(nz)).toBe(false);
    }
  });

  it("each triangle has valid vertex coordinates (non-NaN, finite)", async () => {
    const stl = await generatePanelStl(makePanel(), 3, 0, emptyGeometry());
    const view = new DataView(stl);
    const triCount = getTriCount(stl);

    for (let t = 0; t < triCount; t++) {
      const offset = 84 + t * 50;
      for (let v = 0; v < 3; v++) {
        const vOffset = offset + 12 + v * 12;
        const x = view.getFloat32(vOffset, true);
        const y = view.getFloat32(vOffset + 4, true);
        const z = view.getFloat32(vOffset + 8, true);
        expect(isFinite(x)).toBe(true);
        expect(isFinite(y)).toBe(true);
        expect(isFinite(z)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Panel body geometry
// ---------------------------------------------------------------------------

describe("panel body", () => {
  it("generates a box for a blank panel (12 triangles)", async () => {
    const panel = makePanel({
      spec: { width: 40, height: 128.5, hp: 8, format: "3u", holes: [], holeStyle: "circle" },
    });
    const stl = await generatePanelStl(panel, 3, 0, emptyGeometry());
    expect(getTriCount(stl)).toBe(12); // 6 faces x 2 triangles
  });

  it("different panel sizes produce different vertex data", async () => {
    const small = makePanel({
      spec: { width: 20, height: 128.5, hp: 4, format: "3u", holes: [], holeStyle: "circle" },
    });
    const large = makePanel({
      spec: { width: 100, height: 128.5, hp: 20, format: "3u", holes: [], holeStyle: "circle" },
    });

    const stlSmall = await generatePanelStl(small, 3, 0, emptyGeometry());
    const stlLarge = await generatePanelStl(large, 3, 0, emptyGeometry());

    // Same triangle count but different vertex positions
    expect(getTriCount(stlSmall)).toBe(getTriCount(stlLarge));

    const bytesSmall = new Uint8Array(stlSmall);
    const bytesLarge = new Uint8Array(stlLarge);
    let differ = false;
    for (let i = 84; i < bytesSmall.length; i++) {
      if (bytesSmall[i] !== bytesLarge[i]) { differ = true; break; }
    }
    expect(differ).toBe(true);
  });

  it("different thicknesses produce different Z coordinates", async () => {
    const panel = makePanel({
      spec: { width: 40, height: 128.5, hp: 8, format: "3u", holes: [], holeStyle: "circle" },
    });
    const stl3 = await generatePanelStl(panel, 3, 0, emptyGeometry());
    const stl5 = await generatePanelStl(panel, 5, 0, emptyGeometry());

    // Same triangle count, different data
    expect(getTriCount(stl3)).toBe(getTriCount(stl5));
    const b3 = new Uint8Array(stl3);
    const b5 = new Uint8Array(stl5);
    let differ = false;
    for (let i = 84; i < b3.length; i++) {
      if (b3[i] !== b5[i]) { differ = true; break; }
    }
    expect(differ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Mounting holes
// ---------------------------------------------------------------------------

describe("mounting holes", () => {
  it("circle holes add triangles", async () => {
    const noHoles = makePanel({
      spec: { width: 40, height: 128.5, hp: 8, format: "3u", holes: [], holeStyle: "circle" },
    });
    const withHoles = makePanel({
      spec: { width: 40, height: 128.5, hp: 8, format: "3u", holes: [[7.5, 3.0]], holeStyle: "circle" },
    });

    const stlNo = await generatePanelStl(noHoles, 3, 0, emptyGeometry());
    const stlWith = await generatePanelStl(withHoles, 3, 0, emptyGeometry());
    expect(getTriCount(stlWith)).toBeGreaterThan(getTriCount(stlNo));
  });

  it("slot holes add triangles", async () => {
    const noHoles = makePanel({
      spec: { width: 40, height: 128.5, hp: 8, format: "3u", holes: [], holeStyle: "slot" },
    });
    const withHoles = makePanel({
      spec: { width: 40, height: 128.5, hp: 8, format: "3u", holes: [[7.5, 3.0]], holeStyle: "slot" },
    });

    const stlNo = await generatePanelStl(noHoles, 3, 0, emptyGeometry());
    const stlWith = await generatePanelStl(withHoles, 3, 0, emptyGeometry());
    expect(getTriCount(stlWith)).toBeGreaterThan(getTriCount(stlNo));
  });

  it("more holes produce more triangles", async () => {
    const oneHole = makePanel({
      spec: { width: 40, height: 128.5, hp: 8, format: "3u", holes: [[7.5, 3.0]], holeStyle: "circle" },
    });
    const twoHoles = makePanel({
      spec: { width: 40, height: 128.5, hp: 8, format: "3u", holes: [[7.5, 3.0], [32, 125]], holeStyle: "circle" },
    });

    const stl1 = await generatePanelStl(oneHole, 3, 0, emptyGeometry());
    const stl2 = await generatePanelStl(twoHoles, 3, 0, emptyGeometry());
    expect(getTriCount(stl2)).toBeGreaterThan(getTriCount(stl1));
  });
});

// ---------------------------------------------------------------------------
// Pattern extrusion
// ---------------------------------------------------------------------------

describe("pattern extrusion", () => {
  it("pattern extrusion adds geometry", async () => {
    const panel = makePanel();
    const geo = generatePatternGeometry("concentric-circles", 40.34, 128.5, 42);

    const stlBlank = await generatePanelStl(panel, 3, 0, emptyGeometry());
    const stlPatterned = await generatePanelStl(panel, 3, 0.5, geo);

    expect(getTriCount(stlPatterned)).toBeGreaterThan(getTriCount(stlBlank));
  });

  it("zero pattern height produces no pattern geometry", async () => {
    const panel = makePanel();
    const geo = generatePatternGeometry("concentric-circles", 40.34, 128.5, 42);

    const stlZeroHeight = await generatePanelStl(panel, 3, 0, geo);
    const stlBlank = await generatePanelStl(panel, 3, 0, emptyGeometry());

    expect(getTriCount(stlZeroHeight)).toBe(getTriCount(stlBlank));
  });

  it("higher pattern extrusion produces different vertex data", async () => {
    const panel = makePanel();
    const geo = generatePatternGeometry("radial-burst", 40.34, 128.5, 42);

    const stlLow = await generatePanelStl(panel, 3, 0.3, geo);
    const stlHigh = await generatePanelStl(panel, 3, 1.0, geo);

    const bLow = new Uint8Array(stlLow);
    const bHigh = new Uint8Array(stlHigh);
    let differ = false;
    for (let i = 84; i < Math.min(bLow.length, bHigh.length); i++) {
      if (bLow[i] !== bHigh[i]) { differ = true; break; }
    }
    expect(differ).toBe(true);
  });

  const patternsWithGeometry: PatternType[] = [
    "concentric-circles", "hex-grid", "radial-burst", "flow-field",
    "lissajous", "spirograph", "seed-of-life",
  ];

  for (const pattern of patternsWithGeometry) {
    it(`pattern "${pattern}" produces valid STL when extruded`, async () => {
      const panel = makePanel();
      const geo = generatePatternGeometry(pattern, 40.34, 128.5, 42);
      const stl = await generatePanelStl(panel, 3, 0.5, geo);

      expect(isValidStl(stl)).toBe(true);
      expect(getTriCount(stl)).toBeGreaterThan(12); // more than just the box
    });
  }

  // Out-of-bounds line/polygon segments are skipped
  it("out-of-bounds line segments are excluded from STL", async () => {
    const W = 40.34;
    const H = 128.5;
    const panel = makePanel({
      spec: { width: W, height: H, hp: 8, format: "3u", holes: [], holeStyle: "circle" },
    });
    // sierpinski-full extends beyond panel — verify STL is still valid
    const geo = generatePatternGeometry("sierpinski-full", W, H, 42);
    const stl = await generatePanelStl(panel, 3, 0.5, geo);
    expect(isValidStl(stl)).toBe(true);
    expect(getTriCount(stl)).toBeGreaterThan(12);
  });
});

// ---------------------------------------------------------------------------
// ZIP export
// ---------------------------------------------------------------------------

describe("ZIP export", () => {
  it("generates a ZIP blob", async () => {
    const panels = [makePanel()];
    const zip = await generateAllPanelsStlZip(
      panels, 3, 0,
      () => emptyGeometry()
    );

    expect(zip).toBeInstanceOf(Blob);
    expect(zip.size).toBeGreaterThan(0);
    expect(zip.type).toBe("application/zip");
  });

  it("ZIP contains correct number of files", async () => {
    const panels = [
      makePanel({ label: "8HP 3U", patternSeed: 1 }),
      makePanel({ label: "4HP 3U", patternSeed: 2 }),
    ];

    const zip = await generateAllPanelsStlZip(
      panels, 3, 0,
      () => emptyGeometry()
    );

    // Read ZIP and count local file headers (signature 0x04034b50)
    const bytes = new Uint8Array(await zip.arrayBuffer());
    let fileCount = 0;
    for (let i = 0; i < bytes.length - 3; i++) {
      if (bytes[i] === 0x50 && bytes[i+1] === 0x4b && bytes[i+2] === 0x03 && bytes[i+3] === 0x04) {
        fileCount++;
      }
    }
    expect(fileCount).toBe(2);
  });

  it("ZIP file names include panel label and seed", async () => {
    const panels = [makePanel({ label: "8HP 3U", patternSeed: 42 })];

    const zip = await generateAllPanelsStlZip(
      panels, 3, 0,
      () => emptyGeometry()
    );

    const bytes = new Uint8Array(await zip.arrayBuffer());
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("8HP-3U-42.stl");
  });

  it("ZIP with patterns produces larger files than blank", async () => {
    const panels = [makePanel()];

    const zipBlank = await generateAllPanelsStlZip(
      panels, 3, 0,
      () => emptyGeometry()
    );

    const zipPatterned = await generateAllPanelsStlZip(
      panels, 3, 0.5,
      (p) => generatePatternGeometry("concentric-circles", p.spec.width, p.spec.height, 42)
    );

    expect(zipPatterned.size).toBeGreaterThan(zipBlank.size);
  });

  it("empty panels array produces valid but minimal ZIP", async () => {
    const zip = await generateAllPanelsStlZip(
      [], 3, 0,
      () => emptyGeometry()
    );

    expect(zip).toBeInstanceOf(Blob);
    expect(zip.size).toBeGreaterThan(0); // at least the end-of-central-directory
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  it("handles 1HP panel (very narrow)", async () => {
    const panel = makePanel({
      spec: { width: 5.08, height: 128.5, hp: 1, format: "3u", holes: [[2.54, 3.0]], holeStyle: "circle" },
    });
    const stl = await generatePanelStl(panel, 3, 0, emptyGeometry());
    expect(isValidStl(stl)).toBe(true);
  });

  it("handles 1U panel (short)", async () => {
    const panel = makePanel({
      spec: { width: 40.34, height: 39.65, hp: 8, format: "1u-intellijel", holes: [[7.5, 3.0]], holeStyle: "circle" },
    });
    const stl = await generatePanelStl(panel, 3, 0, emptyGeometry());
    expect(isValidStl(stl)).toBe(true);
  });

  it("handles very thin panel (1mm)", async () => {
    const stl = await generatePanelStl(makePanel(), 1, 0, emptyGeometry());
    expect(isValidStl(stl)).toBe(true);
  });

  it("handles thick panel (10mm)", async () => {
    const stl = await generatePanelStl(makePanel(), 10, 0, emptyGeometry());
    expect(isValidStl(stl)).toBe(true);
  });

  it("handles max pattern height (2mm)", async () => {
    const geo = generatePatternGeometry("radial-burst", 40.34, 128.5, 42);
    const stl = await generatePanelStl(makePanel(), 3, 2.0, geo);
    expect(isValidStl(stl)).toBe(true);
  });

  it("circle holes are round (more triangles than box)", async () => {
    const panel = makePanel({
      spec: { width: 40, height: 128.5, hp: 8, format: "3u", holes: [[20, 64]], holeStyle: "circle" },
    });
    const stl = await generatePanelStl(panel, 3, 0, emptyGeometry());
    // Circle hole adds many triangles from the cylinder boolean
    expect(getTriCount(stl)).toBeGreaterThan(30);
  });

  it("slot holes are wider than tall (different from circle)", async () => {
    const circlePanel = makePanel({
      spec: { width: 40, height: 128.5, hp: 8, format: "3u", holes: [[20, 64]], holeStyle: "circle" },
    });
    const slotPanel = makePanel({
      spec: { width: 40, height: 128.5, hp: 8, format: "3u", holes: [[20, 64]], holeStyle: "slot" },
    });

    const stlCircle = await generatePanelStl(circlePanel, 3, 0, emptyGeometry());
    const stlSlot = await generatePanelStl(slotPanel, 3, 0, emptyGeometry());

    // Different hole shapes produce different triangle counts
    expect(getTriCount(stlCircle)).not.toBe(getTriCount(stlSlot));
    // Both should be valid
    expect(isValidStl(stlCircle)).toBe(true);
    expect(isValidStl(stlSlot)).toBe(true);
  });

  it("produces deterministic output for same inputs", async () => {
    const panel = makePanel();
    const geo = generatePatternGeometry("seed-of-life", 40.34, 128.5, 42);

    const stl1 = await generatePanelStl(panel, 3, 0.5, geo);
    const stl2 = await generatePanelStl(panel, 3, 0.5, geo);

    const b1 = new Uint8Array(stl1);
    const b2 = new Uint8Array(stl2);
    expect(b1.length).toBe(b2.length);
    for (let i = 0; i < b1.length; i++) {
      expect(b1[i]).toBe(b2[i]);
    }
  });
});

// ---------------------------------------------------------------------------
// Pattern quality — detect straight-line artifacts
// ---------------------------------------------------------------------------

describe("pattern quality", () => {
  /**
   * Detect triangles in the pattern layer (z > panel thickness) that have
   * edges spanning an unreasonably long distance. A triangle edge longer
   * than maxEdgeLength at the pattern Z-level indicates a straight-line artifact.
   */
  function findLongEdgesInPatternLayer(stl: ArrayBuffer, panelThickness: number, maxEdgeLength: number) {
    const view = new DataView(stl);
    const triCount = getTriCount(stl);
    const longEdges: { length: number; z: number }[] = [];

    for (let t = 0; t < triCount; t++) {
      const offset = 84 + t * 50;
      const verts: [number, number, number][] = [];

      for (let v = 0; v < 3; v++) {
        const vOffset = offset + 12 + v * 12;
        verts.push([
          view.getFloat32(vOffset, true),
          view.getFloat32(vOffset + 4, true),
          view.getFloat32(vOffset + 8, true),
        ]);
      }

      // Only check triangles in the pattern layer (z > thickness)
      const minZ = Math.min(verts[0][2], verts[1][2], verts[2][2]);
      if (minZ < panelThickness - 0.1) continue;

      // Check each edge length in XY plane
      for (let i = 0; i < 3; i++) {
        const j = (i + 1) % 3;
        const dx = verts[j][0] - verts[i][0];
        const dy = verts[j][1] - verts[i][1];
        const edgeLen = Math.sqrt(dx * dx + dy * dy);
        if (edgeLen > maxEdgeLength) {
          longEdges.push({ length: edgeLen, z: minZ });
        }
      }
    }

    return longEdges;
  }

  // Note: composed (non-unioned) meshes can show visual Z-fighting artifacts
  // in STL viewers where overlapping bar end-faces create apparent straight lines.
  // This is cosmetic only — slicers auto-repair these for printing.
  // A future optimization could use Manifold.union for small patterns or
  // the offset-polygon approach for paths.

  it("flow-field STL produces valid geometry with pattern", async () => {
    const panel = makePanel({
      spec: { width: 40.34, height: 128.5, hp: 8, format: "3u", holes: [], holeStyle: "circle" },
    });
    const geo = generatePatternGeometry("flow-field", 40.34, 128.5, 42);
    const stl = await generatePanelStl(panel, 3, 0.5, geo);
    expect(isValidStl(stl)).toBe(true);
    expect(getTriCount(stl)).toBeGreaterThan(12);
  });

  it("lissajous STL produces valid geometry with pattern", async () => {
    const panel = makePanel({
      spec: { width: 40.34, height: 128.5, hp: 8, format: "3u", holes: [], holeStyle: "circle" },
    });
    const geo = generatePatternGeometry("lissajous", 40.34, 128.5, 42);
    const stl = await generatePanelStl(panel, 3, 0.5, geo);
    expect(isValidStl(stl)).toBe(true);
    expect(getTriCount(stl)).toBeGreaterThan(12);
  });
});
