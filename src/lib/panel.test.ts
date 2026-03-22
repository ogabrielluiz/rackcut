import { describe, it, expect } from "vitest";
import { computePanel, layoutPanels } from "./panel";
import {
  HP_MM,
  PANEL_WIDTH_CLEARANCE,
  PANEL_HEIGHT_3U,
  PANEL_HEIGHT_1U_INTELLIJEL,
  PANEL_HEIGHT_1U_PULPLOGIC,
  HOLE_EDGE_OFFSET_H,
  HOLE_EDGE_OFFSET_V,
  FOUR_HOLE_THRESHOLD_HP,
} from "./constants";
import { PanelValidationError } from "./types";

// ---------------------------------------------------------------------------
// computePanel
// ---------------------------------------------------------------------------

describe("computePanel", () => {
  // Dimensions -----------------------------------------------------------

  describe("dimensions", () => {
    it("produces correct width for 1HP", () => {
      const panel = computePanel(1, "3u", "circle");
      expect(panel.width).toBeCloseTo(1 * HP_MM - PANEL_WIDTH_CLEARANCE, 5);
    });

    it("produces correct width for 8HP", () => {
      const panel = computePanel(8, "3u", "circle");
      expect(panel.width).toBeCloseTo(8 * HP_MM - PANEL_WIDTH_CLEARANCE, 5);
    });

    it("produces correct width for 128HP", () => {
      const panel = computePanel(128, "3u", "circle");
      expect(panel.width).toBeCloseTo(128 * HP_MM - PANEL_WIDTH_CLEARANCE, 5);
    });

    it("3u format has correct height", () => {
      const panel = computePanel(8, "3u", "circle");
      expect(panel.height).toBe(PANEL_HEIGHT_3U);
    });

    it("1u-intellijel format has correct height", () => {
      const panel = computePanel(8, "1u-intellijel", "circle");
      expect(panel.height).toBe(PANEL_HEIGHT_1U_INTELLIJEL);
    });

    it("1u-pulplogic format has correct height", () => {
      const panel = computePanel(8, "1u-pulplogic", "circle");
      expect(panel.height).toBe(PANEL_HEIGHT_1U_PULPLOGIC);
    });
  });

  // Stored fields --------------------------------------------------------

  describe("stored fields", () => {
    it("stores hp on result", () => {
      const panel = computePanel(8, "3u", "circle");
      expect(panel.hp).toBe(8);
    });

    it("stores format on result", () => {
      const panel = computePanel(8, "3u", "circle");
      expect(panel.format).toBe("3u");
    });

    it("stores slot holeStyle on result", () => {
      const panel = computePanel(8, "3u", "slot");
      expect(panel.holeStyle).toBe("slot");
    });

    it("stores circle holeStyle on result", () => {
      const panel = computePanel(8, "3u", "circle");
      expect(panel.holeStyle).toBe("circle");
    });
  });

  // Hole layout — small panels (< FOUR_HOLE_THRESHOLD_HP) ---------------

  describe("2-hole layout (below threshold)", () => {
    // 8HP is below the 10HP threshold
    it("8HP panel has exactly 2 holes", () => {
      const panel = computePanel(8, "3u", "circle");
      expect(panel.holes).toHaveLength(2);
    });

    it("8HP panel — top hole is at topY (HOLE_EDGE_OFFSET_V)", () => {
      const panel = computePanel(8, "3u", "circle");
      const topY = HOLE_EDGE_OFFSET_V;
      const hasTop = panel.holes.some(([, y]) => Math.abs(y - topY) < 1e-6);
      expect(hasTop).toBe(true);
    });

    it("8HP panel — bottom hole is at height - HOLE_EDGE_OFFSET_V", () => {
      const panel = computePanel(8, "3u", "circle");
      const bottomY = PANEL_HEIGHT_3U - HOLE_EDGE_OFFSET_V;
      const hasBottom = panel.holes.some(([, y]) => Math.abs(y - bottomY) < 1e-6);
      expect(hasBottom).toBe(true);
    });

    it("8HP panel — top hole is at leftX, bottom hole is at rightX (diagonal)", () => {
      const panel = computePanel(8, "3u", "circle");
      const leftX = HOLE_EDGE_OFFSET_H;
      const rightX = HOLE_EDGE_OFFSET_H + (8 - 3) * HP_MM;
      const topY = HOLE_EDGE_OFFSET_V;
      const bottomY = PANEL_HEIGHT_3U - HOLE_EDGE_OFFSET_V;

      const topHole = panel.holes.find(([, y]) => Math.abs(y - topY) < 1e-6);
      const bottomHole = panel.holes.find(([, y]) => Math.abs(y - bottomY) < 1e-6);

      expect(topHole![0]).toBeCloseTo(leftX, 5);
      expect(bottomHole![0]).toBeCloseTo(rightX, 5);
    });
  });

  // Hole layout — larger panels (>= FOUR_HOLE_THRESHOLD_HP) -------------

  describe("4-hole layout (at/above threshold)", () => {
    it(`${FOUR_HOLE_THRESHOLD_HP}HP panel has exactly 4 holes`, () => {
      const panel = computePanel(FOUR_HOLE_THRESHOLD_HP, "3u", "circle");
      expect(panel.holes).toHaveLength(4);
    });

    it("12HP panel has exactly 4 holes", () => {
      const panel = computePanel(12, "3u", "circle");
      expect(panel.holes).toHaveLength(4);
    });

    it("20HP panel has exactly 4 holes", () => {
      const panel = computePanel(20, "3u", "circle");
      expect(panel.holes).toHaveLength(4);
    });

    it("10HP panel — all four corner positions are present", () => {
      const panel = computePanel(10, "3u", "circle");
      const leftX = HOLE_EDGE_OFFSET_H;
      const rightX = HOLE_EDGE_OFFSET_H + (10 - 3) * HP_MM;
      const topY = HOLE_EDGE_OFFSET_V;
      const bottomY = PANEL_HEIGHT_3U - HOLE_EDGE_OFFSET_V;

      const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

      expect(panel.holes.some(([x, y]) => near(x, leftX) && near(y, topY))).toBe(true);   // top-left
      expect(panel.holes.some(([x, y]) => near(x, rightX) && near(y, topY))).toBe(true);  // top-right
      expect(panel.holes.some(([x, y]) => near(x, leftX) && near(y, bottomY))).toBe(true); // bottom-left
      expect(panel.holes.some(([x, y]) => near(x, rightX) && near(y, bottomY))).toBe(true); // bottom-right
    });
  });

  // Collapsed holes (very small panels) ---------------------------------

  describe("hole collapsing (HP=1)", () => {
    it("1HP panel has 2 holes at the same X (collapsed)", () => {
      const panel = computePanel(1, "3u", "circle");
      // rightX would be <= leftX, so both holes share leftX
      const leftX = HOLE_EDGE_OFFSET_H;
      expect(panel.holes).toHaveLength(2);
      expect(panel.holes.every(([x]) => Math.abs(x - leftX) < 1e-6)).toBe(true);
    });
  });

  // Validation -----------------------------------------------------------

  describe("validation", () => {
    it("throws PanelValidationError for HP < 1", () => {
      expect(() => computePanel(0, "3u", "circle")).toThrow(PanelValidationError);
    });

    it("throws PanelValidationError for HP < 1 (negative)", () => {
      expect(() => computePanel(-5, "3u", "circle")).toThrow(PanelValidationError);
    });

    it("throws PanelValidationError for HP > 128", () => {
      expect(() => computePanel(129, "3u", "circle")).toThrow(PanelValidationError);
    });

    it("throws PanelValidationError for non-integer HP", () => {
      expect(() => computePanel(4.5, "3u", "circle")).toThrow(PanelValidationError);
    });

    it("throws PanelValidationError for unknown format", () => {
      // @ts-expect-error — intentionally passing invalid format
      expect(() => computePanel(8, "2u-unknown", "circle")).toThrow(PanelValidationError);
    });

    it("does not throw for HP=1 (boundary)", () => {
      expect(() => computePanel(1, "3u", "circle")).not.toThrow();
    });

    it("does not throw for HP=128 (boundary)", () => {
      expect(() => computePanel(128, "3u", "circle")).not.toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// layoutPanels
// ---------------------------------------------------------------------------

describe("layoutPanels", () => {
  const GAP = 2;

  it("empty input returns empty result with 0 dimensions", () => {
    const result = layoutPanels([], GAP);
    expect(result.placed).toHaveLength(0);
    expect(result.sheetWidth).toBe(0);
    expect(result.sheetHeight).toBe(0);
  });

  it("single panel is placed at origin (0, 0)", () => {
    const spec = computePanel(8, "3u", "circle");
    const result = layoutPanels([spec], GAP);
    expect(result.placed).toHaveLength(1);
    expect(result.placed[0].x).toBe(0);
    expect(result.placed[0].y).toBe(0);
  });

  it("single panel — sheet dimensions equal panel dimensions", () => {
    const spec = computePanel(8, "3u", "circle");
    const result = layoutPanels([spec], GAP);
    expect(result.sheetWidth).toBeCloseTo(spec.width, 5);
    expect(result.sheetHeight).toBeCloseTo(spec.height, 5);
  });

  it("two same-height panels placed left-to-right with gap", () => {
    const spec1 = computePanel(4, "3u", "circle");
    const spec2 = computePanel(8, "3u", "circle");
    const result = layoutPanels([spec1, spec2], GAP);

    expect(result.placed[0].x).toBe(0);
    expect(result.placed[0].y).toBe(0);
    expect(result.placed[1].x).toBeCloseTo(spec1.width + GAP, 5);
    expect(result.placed[1].y).toBe(0);
  });

  it("same-height panels — sheet width = sum of widths + gaps", () => {
    const spec1 = computePanel(4, "3u", "circle");
    const spec2 = computePanel(8, "3u", "circle");
    const result = layoutPanels([spec1, spec2], GAP);
    const expectedWidth = spec1.width + GAP + spec2.width;
    expect(result.sheetWidth).toBeCloseTo(expectedWidth, 5);
  });

  it("same-height panels — sheet height equals panel height", () => {
    const spec1 = computePanel(4, "3u", "circle");
    const spec2 = computePanel(8, "3u", "circle");
    const result = layoutPanels([spec1, spec2], GAP);
    expect(result.sheetHeight).toBeCloseTo(spec1.height, 5);
  });

  it("different-height panels are placed in separate rows", () => {
    const spec3u = computePanel(8, "3u", "circle");
    const spec1u = computePanel(8, "1u-intellijel", "circle");
    const result = layoutPanels([spec3u, spec1u], GAP);

    // They must have different y positions (different rows)
    const ys = result.placed.map((p) => p.y);
    const uniqueYs = new Set(ys);
    expect(uniqueYs.size).toBe(2);
  });

  it("rows are separated by the gap", () => {
    const spec3u = computePanel(8, "3u", "circle");
    const spec1u = computePanel(8, "1u-intellijel", "circle");
    const result = layoutPanels([spec3u, spec1u], GAP);

    const sorted = [...result.placed].sort((a, b) => a.y - b.y);
    const row0 = sorted[0];
    const row1 = sorted[1];
    // The second row should start at row0.y + its panel height + gap
    const expectedY = row0.spec.height + GAP;
    expect(row1.y).toBeCloseTo(expectedY, 5);
  });

  it("sheet height spans all rows with gaps between them", () => {
    const spec3u = computePanel(8, "3u", "circle");
    const spec1u = computePanel(8, "1u-intellijel", "circle");
    const result = layoutPanels([spec3u, spec1u], GAP);
    const expectedHeight = spec3u.height + GAP + spec1u.height;
    expect(result.sheetHeight).toBeCloseTo(expectedHeight, 5);
  });

  it("placed panels carry the original spec", () => {
    const spec = computePanel(8, "3u", "circle");
    const result = layoutPanels([spec], GAP);
    expect(result.placed[0].spec).toBe(spec);
  });

  it("placed panels have a label property (string)", () => {
    const spec = computePanel(8, "3u", "circle");
    const result = layoutPanels([spec], GAP);
    expect(typeof result.placed[0].label).toBe("string");
  });
});
