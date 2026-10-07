import { describe, it, expect } from "vitest";
import { WORKSPACE_STORAGE_KEY, defaultWorkspace, loadWorkspace, saveWorkspace, type Workspace } from "./workspace-storage";

/** A stand-in for window.localStorage that keeps its entries in memory */
function memoryStorage(entries: Record<string, string> = {}) {
  const data = new Map(Object.entries(entries));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

const stored = (value: unknown) => memoryStorage({ [WORKSPACE_STORAGE_KEY]: JSON.stringify(value) });

const workspace: Workspace = {
  panels: [
    { id: "a", hp: 8, format: "3u", holeStyle: "slot", quantity: 2, pattern: "relief-damascus", patternSeed: 402884 },
    { id: "b", hp: 2, format: "1u-intellijel", holeStyle: "circle", quantity: 1, pattern: "waveform", patternSeed: 7 },
  ],
  gap: 3.5,
  maxBlankHp: 12,
  splitMode: "fill-max",
  globalPattern: "bands-marble",
  material: "walnut",
  outputMode: "3d-print",
  printColor: "#3355cc",
  accentColor: "#f0f0f0",
};

describe("workspace storage", () => {
  it("starts from an empty sheet with the app's defaults when nothing is stored", () => {
    expect(loadWorkspace(memoryStorage())).toEqual({
      panels: [],
      gap: 2,
      maxBlankHp: 20,
      splitMode: "equal",
      globalPattern: "none",
      material: "mdf",
      outputMode: "laser-cut",
      printColor: "#cccccc",
      accentColor: "#2a2a2a",
    });
    expect(defaultWorkspace()).toEqual(loadWorkspace(memoryStorage()));
  });

  it("gives back exactly what was saved", () => {
    const storage = memoryStorage();
    saveWorkspace(workspace, storage);
    expect(loadWorkspace(storage)).toEqual(workspace);
  });

  // People's saved panels outlive deploys: this is what version 1 wrote to disk.
  it("reads a workspace saved in the version 1 format", () => {
    const storage = memoryStorage({
      [WORKSPACE_STORAGE_KEY]:
        '{"version":1,"panels":[{"id":"p1","hp":4,"format":"3u","holeStyle":"slot","quantity":3,"pattern":"bands-cells","patternSeed":123}],' +
        '"gap":2,"maxBlankHp":20,"splitMode":"equal","globalPattern":"none","material":"mdf","outputMode":"3d-print","printColor":"#cccccc","accentColor":"#2a2a2a"}',
    });
    const loaded = loadWorkspace(storage);
    expect(loaded.panels).toEqual([
      { id: "p1", hp: 4, format: "3u", holeStyle: "slot", quantity: 3, pattern: "bands-cells", patternSeed: 123 },
    ]);
    expect(loaded.outputMode).toBe("3d-print");
  });

  it("starts fresh when the stored text is not a workspace", () => {
    for (const text of ["", "not json", "null", "[]", "42", '"panels"']) {
      expect(loadWorkspace(memoryStorage({ [WORKSPACE_STORAGE_KEY]: text })), text).toEqual(defaultWorkspace());
    }
  });

  it("starts fresh rather than guess at a format version it does not know", () => {
    expect(loadWorkspace(stored({ ...workspace, version: 2 }))).toEqual(defaultWorkspace());
    expect(loadWorkspace(stored({ ...workspace }))).toEqual(defaultWorkspace());
  });

  it("drops panels whose size or format cannot be built, and keeps the rest", () => {
    const good = workspace.panels[0];
    const loaded = loadWorkspace(
      stored({
        ...workspace,
        version: 1,
        panels: [
          { ...good, id: "zero", hp: 0 },
          { ...good, id: "fraction", hp: 3.5 },
          { ...good, id: "huge", hp: 129 },
          { ...good, id: "text", hp: "8" },
          { ...good, id: "format", format: "9u" },
          "not a panel",
          null,
          good,
        ],
      })
    );
    expect(loaded.panels).toEqual([good]);
  });

  it("keeps a panel but clears a pattern this version does not have", () => {
    const [panel] = workspace.panels;
    const loaded = loadWorkspace(
      stored({ ...workspace, version: 1, panels: [{ ...panel, pattern: "retired-pattern" }, { ...panel, id: "x", pattern: 7 }] })
    );
    expect(loaded.panels.map((p) => p.pattern)).toEqual(["none", "none"]);
    expect(loaded.panels[0]).toEqual({ ...panel, pattern: "none" });
  });

  it("repairs quantity, hole style and seed instead of losing the panel", () => {
    const [panel] = workspace.panels;
    const loaded = loadWorkspace(
      stored({
        ...workspace,
        version: 1,
        panels: [
          { ...panel, id: "many", quantity: 5000 },
          { ...panel, id: "none", quantity: 0 },
          { ...panel, id: "half", quantity: 2.5 },
          { ...panel, id: "hole", holeStyle: "square" },
          { ...panel, id: "seed", patternSeed: "abc" },
        ],
      })
    );
    expect(loaded.panels.map((p) => p.quantity)).toEqual([100, 1, 1, 2, 2]);
    expect(loaded.panels[3].holeStyle).toBe("slot");
    expect(loaded.panels[4].patternSeed).toBe(0);
  });

  it("gives every panel its own id, even if the stored ones are missing or repeated", () => {
    const [panel] = workspace.panels;
    const loaded = loadWorkspace(
      stored({ ...workspace, version: 1, panels: [panel, { ...panel }, { ...panel, id: "" }, { ...panel, id: 5 }] })
    );
    const ids = loaded.panels.map((p) => p.id);
    expect(ids).toHaveLength(4);
    expect(ids[0]).toBe("a");
    expect(new Set(ids).size).toBe(4);
    expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
  });

  it("falls back setting by setting when a stored value is out of range", () => {
    const loaded = loadWorkspace(
      stored({
        ...workspace,
        version: 1,
        gap: 500,
        maxBlankHp: 0,
        splitMode: "diagonal",
        globalPattern: "retired-pattern",
        material: "gold",
        outputMode: "cnc",
        printColor: "red",
        accentColor: "#12345",
      })
    );
    expect(loaded).toEqual({ ...defaultWorkspace(), panels: workspace.panels });
  });

  it("keeps the valid settings next to an invalid one", () => {
    const loaded = loadWorkspace(stored({ ...workspace, version: 1, material: "gold" }));
    expect(loaded).toEqual({ ...workspace, material: "mdf" });
  });

  it("works without storage: private windows and blocked site data", () => {
    const refusing = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(loadWorkspace(refusing)).toEqual(defaultWorkspace());
    expect(() => saveWorkspace(workspace, refusing)).not.toThrow();
    expect(loadWorkspace(null)).toEqual(defaultWorkspace());
    expect(() => saveWorkspace(workspace, null)).not.toThrow();
  });
});
