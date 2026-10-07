// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { meshToStl, scoped } from "./manifold";
import { readTriangles } from "./stl-test-utils";
import { generatePatternGeometry } from "../pattern-geometry";
import { computePanel } from "../panel";
import type { PatternType, PlacedPanel } from "../types";

// manifold-3d keeps its objects on the WASM heap, and nothing in a loop of
// awaited exports gives its finalizers a turn. If an export leaves
// objects behind, the heap has to grow for the next one, until a ZIP of a few
// dozen panels crashes the engine. Each case gets a fresh engine, so the heap
// is no bigger than that one export needs and any leftovers force it to grow.
describe("mesh engine memory", () => {
  const panel = (pattern: PatternType): PlacedPanel => ({
    spec: computePanel(6, "3u", "slot"),
    x: 0,
    y: 0,
    label: "6HP",
    pattern,
    patternSeed: 42,
  });

  /** The renderers, loaded against a new instance of the engine */
  async function freshEngine() {
    vi.resetModules();
    const { getManifold } = await import("./manifold");
    const { generateSurfacePanelStl } = await import("./surface-stl-renderer");
    const { generatePanelStl } = await import("./stl-renderer");
    return { wasm: await getManifold(), generateSurfacePanelStl, generatePanelStl };
  }

  const cases: [string, (engine: Awaited<ReturnType<typeof freshEngine>>) => Promise<ArrayBuffer>][] = [
    ["relief", (engine) => engine.generateSurfacePanelStl(panel("relief-labyrinth"), 3, 1)],
    ["bands", (engine) => engine.generateSurfacePanelStl(panel("bands-labyrinth"), 3, 0.6)],
    [
      "line pattern",
      (engine) => {
        const p = panel("flow-field");
        const geometry = generatePatternGeometry(p.pattern, p.spec.width, p.spec.height, p.patternSeed);
        return engine.generatePanelStl(p, 3, 0.6, geometry);
      },
    ],
  ];

  for (const [name, run] of cases) {
    it(`${name} export gives its memory back`, async () => {
      const engine = await freshEngine();
      // Emscripten exposes the heap on the module; the library's types leave it out
      const heapSize = () => (engine.wasm as unknown as { HEAPU8: Uint8Array }).HEAPU8.length;
      const initial = heapSize();
      await run(engine);
      const settled = heapSize();
      // The export needed more than the engine starts with, so there is no slack to hide a leak in
      expect(settled).toBeGreaterThan(initial);
      for (let i = 0; i < 4; i++) await run(engine);
      expect(heapSize()).toBe(settled);
    });
  }
});

describe("scoped", () => {
  const fake = () => ({ deleted: 0, delete() { this.deleted++; } });

  it("frees what was registered and returns the result", () => {
    const a = fake();
    const b = fake();
    const kept = fake();
    const result = scoped((own) => {
      own(a);
      own(b);
      return kept;
    });
    expect(result).toBe(kept);
    expect([a.deleted, b.deleted, kept.deleted]).toEqual([1, 1, 0]);
  });

  it("frees each object once even if registered twice", () => {
    const a = fake();
    scoped((own) => own(own(a)));
    expect(a.deleted).toBe(1);
  });

  it("still frees when the build throws", () => {
    const a = fake();
    expect(() =>
      scoped((own) => {
        own(a);
        throw new Error("boom");
      })
    ).toThrow("boom");
    expect(a.deleted).toBe(1);
  });
});

describe("meshToStl", () => {
  it("leaves out triangles whose corners coincide", () => {
    // Two real triangles and one with a repeated position
    const mesh = {
      numProp: 3,
      numTri: 3,
      vertProperties: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0]),
      triVerts: new Uint32Array([0, 1, 2, 1, 3, 2, 1, 4, 2]),
    };
    const stl = meshToStl(mesh);
    expect(new DataView(stl).getUint32(80, true)).toBe(2);
    expect(stl.byteLength).toBe(84 + 2 * 50);
    expect(Array.from(readTriangles(stl))).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
  });
});
