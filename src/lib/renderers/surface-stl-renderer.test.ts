// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  generateSurfacePanelStl,
  heightmapToMesh,
  traceBandOutlines,
} from "./surface-stl-renderer";
import { generateAllPanelsStlZip, generatePanelStl } from "./stl-renderer";
import { boundsOf, countVerticesNear, isWatertight, readTriangles, unzipStored, volumeOf } from "./stl-test-utils";
import { SURFACE_FIELDS, SURFACE_STYLES } from "../surfaces/fields";
import { SCREW_SEAT_RADIUS } from "../surfaces/heightmap";
import { emptyGeometry } from "../pattern-geometry/types";
import { computePanel } from "../panel";
import { HOLE_DIAMETER, SLOT_WIDTH, SLOT_HEIGHT } from "../constants";
import type { Format, HoleStyle, PatternType, PlacedPanel, SurfacePattern } from "../types";

const PATTERNS = SURFACE_STYLES.flatMap((style) =>
  SURFACE_FIELDS.map((field): SurfacePattern => `${style}-${field}`)
);

function makePanel(hp: number, pattern: PatternType, holeStyle: HoleStyle = "slot", format: Format = "3u", seed = 42): PlacedPanel {
  return { spec: computePanel(hp, format, holeStyle), x: 0, y: 0, label: `${hp}HP`, pattern, patternSeed: seed };
}

/** Flattened triangle soup of a mesh built by heightmapToMesh */
function soup({ vertProperties, triVerts }: { vertProperties: Float32Array; triVerts: Uint32Array }) {
  const out = new Float32Array(triVerts.length * 3);
  triVerts.forEach((v, i) => out.set(vertProperties.subarray(v * 3, v * 3 + 3), i * 3));
  return out;
}

describe("heightmapToMesh", () => {
  const flat = (height: number) => ({
    nx: 5,
    ny: 4,
    dx: 2,
    dy: 3,
    depth: 1,
    heights: new Float32Array(20).fill(height),
  });

  it("builds a closed slab with the top grid, four walls and a bottom fan", () => {
    const mesh = heightmapToMesh(flat(0), 2);
    const rim = 2 * (5 - 1) + 2 * (4 - 1);
    expect(mesh.triVerts.length / 3).toBe((5 - 1) * (4 - 1) * 2 + rim * 3);
    expect(isWatertight(soup(mesh))).toBe(true);
  });

  it("encloses width x height x (thickness + relief), wound outward", () => {
    expect(volumeOf(soup(heightmapToMesh(flat(0), 2)))).toBeCloseTo(8 * 9 * 2, 6);
    expect(volumeOf(soup(heightmapToMesh(flat(0.5), 2)))).toBeCloseTo(8 * 9 * 2.5, 5);
  });

  it("stays closed over an uneven surface", () => {
    const map = flat(0);
    map.heights.forEach((_, i) => (map.heights[i] = (i * 37) % 11 / 11));
    expect(isWatertight(soup(heightmapToMesh(map, 2)))).toBe(true);
  });
});

describe("traceBandOutlines", () => {
  it("closes outlines that run off the panel, just outside its edge", () => {
    // Left half raised, all the way to three panel edges
    const nx = 21;
    const ny = 11;
    const p = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < 10; i++) p[j * nx + i] = 1;
    const loops = traceBandOutlines(p, nx, ny, 1, 1);
    expect(loops).toHaveLength(1);
    const xs = loops[0].map(([x]) => x);
    const ys = loops[0].map(([, y]) => y);
    expect(Math.min(...xs)).toBe(-0.5);
    expect(Math.max(...xs)).toBe(9.5);
    expect(Math.min(...ys)).toBe(-0.5);
    expect(Math.max(...ys)).toBe(ny - 1 + 0.5);
    // no repeated closing point
    expect(loops[0][0]).not.toEqual(loops[0][loops[0].length - 1]);
  });

  it("returns nothing for a blank field", () => {
    expect(traceBandOutlines(new Float32Array(12 * 12), 12, 12, 1, 1)).toEqual([]);
  });
});

describe("surface STL export", () => {
  const thickness = 2;
  const depth = 0.8;

  for (const pattern of PATTERNS) {
    it(`${pattern} exports a closed solid within the panel envelope`, async () => {
      const panel = makePanel(2, pattern);
      const { width, height } = panel.spec;
      const stl = await generateSurfacePanelStl(panel, thickness, depth);
      expect(stl.byteLength).toBe(84 + new DataView(stl).getUint32(80, true) * 50);

      const tris = readTriangles(stl);
      expect(isWatertight(tris)).toBe(true);

      const { min, max } = boundsOf(tris);
      expect(min[0]).toBeCloseTo(0, 5);
      expect(min[1]).toBeCloseTo(0, 5);
      expect(min[2]).toBeCloseTo(0, 5);
      expect(max[0]).toBeCloseTo(width, 4);
      expect(max[1]).toBeCloseTo(height, 4);
      expect(max[2]).toBeLessThanOrEqual(thickness + depth + 1e-5);
      expect(max[2]).toBeGreaterThan(thickness + depth * 0.9);

      // The pattern is real material on top of the slab: between a tenth and
      // four fifths of the layer it could fill, even on the narrowest panel
      const slab = width * height * thickness;
      const fill = (volumeOf(tris) - slab) / (width * height * depth);
      expect(fill).toBeGreaterThan(0.1);
      expect(fill).toBeLessThan(0.8);
    });
  }

  it("bands have only three levels: bed, panel face and band top", async () => {
    const tris = readTriangles(await generateSurfacePanelStl(makePanel(4, "bands-marble"), thickness, depth));
    const levels = new Set<number>();
    for (let i = 2; i < tris.length; i += 3) levels.add(Math.round(tris[i] * 1e4) / 1e4);
    expect([...levels].sort((a, b) => a - b)).toEqual([0, thickness, thickness + depth]);
  });

  it("is reproducible", async () => {
    const a = await generateSurfacePanelStl(makePanel(3, "relief-ripple"), thickness, depth);
    const b = await generateSurfacePanelStl(makePanel(3, "relief-ripple"), thickness, depth);
    expect(new Uint8Array(a)).toEqual(new Uint8Array(b));
    const c = await generateSurfacePanelStl(makePanel(3, "relief-ripple", "slot", "3u", 43), thickness, depth);
    expect(new Uint8Array(a)).not.toEqual(new Uint8Array(c));
  });

  it("rejects patterns that are not surfaces", async () => {
    await expect(generateSurfacePanelStl(makePanel(4, "flow-field"), thickness, depth)).rejects.toThrow(/not a surface/i);
  });
});

// The screw head has to land on the flat panel face. Check the exported mesh
// itself, in print coordinates, for both hole shapes.
describe("screw seats in the export", () => {
  for (const holeStyle of ["slot", "circle"] as const) {
    for (const pattern of ["relief-damascus", "relief-cells", "bands-labyrinth", "bands-chladni-plate"] as const) {
      it(`${pattern} leaves ${holeStyle} holes clear and their seats flat`, async () => {
        const thickness = 2;
        const panel = makePanel(12, pattern, holeStyle);
        const { height, holes } = panel.spec;
        expect(panel.spec.holeStyle).toBe(holeStyle);
        const tris = readTriangles(await generateSurfacePanelStl(panel, thickness, 1));
        const slotHalf = holeStyle === "slot" ? (SLOT_WIDTH - SLOT_HEIGHT) / 2 : 0;

        let raisedInSeat = 0;
        for (let i = 0; i < tris.length; i += 3) {
          if (tris[i + 2] <= thickness + 1e-4) continue;
          for (const [hx, hy] of holes) {
            const ax = Math.max(Math.abs(tris[i] - hx) - slotHalf, 0);
            if (Math.hypot(ax, tris[i + 1] - (height - hy)) <= SCREW_SEAT_RADIUS) raisedInSeat++;
          }
        }
        expect(raisedInSeat).toBe(0);

        // and the hole really goes through there: its wall reaches the bed
        const reach = Math.max(SLOT_WIDTH, HOLE_DIAMETER) / 2 + 0.05;
        for (const [hx, hy] of holes) {
          expect(countVerticesNear(tris, hx, height - hy, 0, reach)).toBeGreaterThanOrEqual(8);
        }
      });
    }
  }
});

// On 1HP and 2HP panels a slot does not fit, so the panel falls back to a round
// hole, stepped left onto the rail grid where needed. The surface has to follow
// the hole the panel really gets, not the one that was asked for.
describe("narrow panels", () => {
  for (const hp of [1, 2]) {
    for (const pattern of ["relief-damascus", "bands-labyrinth"] as const) {
      it(`${hp}HP ${pattern} cuts the fallback round hole and keeps its seat flat`, async () => {
        const thickness = 2;
        const panel = makePanel(hp, pattern, "slot");
        const { width, height, holes, holeStyle } = panel.spec;
        expect(holeStyle).toBe("circle");

        const tris = readTriangles(await generateSurfacePanelStl(panel, thickness, 1));
        expect(isWatertight(tris)).toBe(true);

        for (const [hx, hy] of holes) {
          // the hole is on the panel, with material on both sides
          expect(hx - HOLE_DIAMETER / 2).toBeGreaterThan(0.5);
          expect(hx + HOLE_DIAMETER / 2).toBeLessThan(width - 0.5);
          // and it goes through the print where the sheet shows it
          expect(countVerticesNear(tris, hx, height - hy, 0, HOLE_DIAMETER / 2 + 0.05)).toBeGreaterThanOrEqual(8);
        }

        let raisedInSeat = 0;
        let raisedElsewhere = 0;
        for (let i = 0; i < tris.length; i += 3) {
          if (tris[i + 2] <= thickness + 1e-4) continue;
          const inSeat = holes.some(([hx, hy]) => Math.hypot(tris[i] - hx, tris[i + 1] - (height - hy)) <= SCREW_SEAT_RADIUS);
          if (inSeat) raisedInSeat++;
          else raisedElsewhere++;
        }
        expect(raisedInSeat).toBe(0);
        // the seats do not swallow the pattern, even on a 4.78mm wide panel
        expect(raisedElsewhere).toBeGreaterThan(200);
      });
    }
  }
});

// The 2D sheet is drawn with y running down. A print seen from the front has
// to match it, not mirror it: the sheet's top-left hole is top-left in the print.
describe("print frame", () => {
  const cases: [string, (panel: PlacedPanel) => Promise<ArrayBuffer>, PatternType][] = [
    ["plain panel", (panel) => generatePanelStl(panel, 2, 0, emptyGeometry()), "none"],
    ["relief", (panel) => generateSurfacePanelStl(panel, 2, 1), "relief-topo"],
    ["bands", (panel) => generateSurfacePanelStl(panel, 2, 0.6), "bands-topo"],
  ];

  for (const [name, generate, pattern] of cases) {
    it(`${name}: holes sit where the sheet shows them`, async () => {
      const panel = makePanel(8, pattern, "circle");
      const { height, holes } = panel.spec;
      // 8HP has two holes on a diagonal: top-left and bottom-right on the sheet
      expect(holes).toHaveLength(2);
      const [[topX, topY], [bottomX, bottomY]] = holes;
      expect(topX).toBeLessThan(bottomX);
      expect(topY).toBeLessThan(bottomY);

      const tris = readTriangles(await generate(panel));
      const near = (x: number, y: number) => countVerticesNear(tris, x, y, 0, HOLE_DIAMETER / 2 + 0.05);
      // Top of the sheet is the far (high-y) end of the print
      expect(near(topX, height - topY)).toBeGreaterThanOrEqual(8);
      expect(near(bottomX, height - bottomY)).toBeGreaterThanOrEqual(8);
      // The mirrored diagonal has no holes
      expect(near(topX, topY)).toBe(0);
      expect(near(bottomX, bottomY)).toBe(0);
    });
  }
});

describe("ZIP export of surface panels", () => {
  it("gives relief its own height and bands the pattern height", async () => {
    const panels = [makePanel(2, "relief-damascus"), makePanel(2, "bands-damascus"), makePanel(2, "none")];
    panels.forEach((panel, i) => (panel.label = `p${i}`));
    const zip = await generateAllPanelsStlZip(panels, 2, 0.6, () => emptyGeometry(), "extrude", 1.4);
    const files = await unzipStored(zip);
    expect([...files.keys()]).toEqual(["p0-42.stl", "p1-42.stl", "p2-42.stl"]);
    const top = (name: string) => boundsOf(readTriangles(files.get(name)!)).max[2];
    expect(top("p0-42.stl")).toBeGreaterThan(2 + 1.4 * 0.9);
    expect(top("p0-42.stl")).toBeLessThanOrEqual(2 + 1.4 + 1e-5);
    expect(top("p1-42.stl")).toBeCloseTo(2 + 0.6, 5);
    expect(top("p2-42.stl")).toBeCloseTo(2, 5);
  });

  it("uses the pattern height for relief when no relief height is given", async () => {
    const zip = await generateAllPanelsStlZip([makePanel(2, "relief-ripple")], 2, 0.5, () => emptyGeometry());
    const [stl] = [...(await unzipStored(zip)).values()];
    const top = boundsOf(readTriangles(stl)).max[2];
    expect(top).toBeGreaterThan(2.4);
    expect(top).toBeLessThanOrEqual(2.5 + 1e-5);
  });
});
