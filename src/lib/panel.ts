import {
  HP_MM,
  PANEL_WIDTH_CLEARANCE,
  HOLE_EDGE_OFFSET_H,
  FOUR_HOLE_THRESHOLD_HP,
  FORMAT_PARAMS,
  MIN_HP,
  MAX_HP,
} from "./constants";
import type { Format, HoleStyle, PanelSpec, PlacedPanel } from "./types";
import { PanelValidationError } from "./types";

// ---------------------------------------------------------------------------
// computePanel
// ---------------------------------------------------------------------------

export function computePanel(
  hp: number,
  format: Format,
  holeStyle: HoleStyle
): PanelSpec {
  // Validate HP
  if (!Number.isInteger(hp) || hp < MIN_HP || hp > MAX_HP) {
    throw new PanelValidationError(
      `HP must be an integer between ${MIN_HP} and ${MAX_HP}, got ${hp}`
    );
  }

  // Validate format
  if (!(format in FORMAT_PARAMS)) {
    throw new PanelValidationError(`Unknown format: ${format}`);
  }

  const { height, holeEdgeV } = FORMAT_PARAMS[format];

  const width = hp * HP_MM - PANEL_WIDTH_CLEARANCE;

  // Horizontal hole positions
  const leftX = HOLE_EDGE_OFFSET_H;
  const rawRightX = HOLE_EDGE_OFFSET_H + (hp - 3) * HP_MM;
  // Collapse rightX to leftX when the panel is too narrow
  const rightX = rawRightX > leftX ? rawRightX : leftX;

  // Vertical hole positions
  const topY = holeEdgeV;
  const bottomY = height - holeEdgeV;

  let holes: [number, number][];

  if (hp < FOUR_HOLE_THRESHOLD_HP) {
    // 2 holes: diagonal — top at leftX, bottom at rightX
    holes = [
      [leftX, topY],
      [rightX, bottomY],
    ];
  } else {
    // 4 holes: all four corners
    holes = [
      [leftX, topY],
      [rightX, topY],
      [leftX, bottomY],
      [rightX, bottomY],
    ];
  }

  return { width, height, hp, format, holes, holeStyle };
}

// ---------------------------------------------------------------------------
// splitBlank
// ---------------------------------------------------------------------------

export function splitBlank(
  hp: number,
  maxHp: number,
  mode: "equal" | "fill-max" = "equal"
): number[] {
  if (hp <= 0) return [];
  if (hp <= maxHp) return [hp];

  if (mode === "equal") {
    const count = Math.ceil(hp / maxHp);
    const base = Math.floor(hp / count);
    const remainder = hp - base * count;
    // Distribute: `remainder` panels get base+1, rest get base
    const result: number[] = [];
    for (let i = 0; i < count; i++) {
      result.push(i < remainder ? base + 1 : base);
    }
    return result;
  }

  // fill-max: fill maxHp panels first, leftover at the end
  const result: number[] = [];
  let remaining = hp;
  while (remaining > 0) {
    const size = Math.min(remaining, maxHp);
    result.push(size);
    remaining -= size;
  }
  return result;
}

// ---------------------------------------------------------------------------
// layoutPanels
// ---------------------------------------------------------------------------

export interface LayoutResult {
  placed: PlacedPanel[];
  sheetWidth: number;
  sheetHeight: number;
}

export interface PanelInput {
  spec: PanelSpec;
  pattern: import("./types").PatternType;
  patternSeed: number;
}

export function layoutPanels(panels: (PanelSpec | PanelInput)[], gap: number): LayoutResult {
  if (panels.length === 0) {
    return { placed: [], sheetWidth: 0, sheetHeight: 0 };
  }

  // Normalize inputs
  const normalized: PanelInput[] = panels.map((p) =>
    "spec" in p ? p : { spec: p, pattern: "none" as const, patternSeed: 0 }
  );

  // Group panels by height (rounded to 0.01 mm for floating-point safety)
  const groups = new Map<number, PanelInput[]>();
  for (const panel of normalized) {
    const key = Math.round(panel.spec.height * 100) / 100;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(panel);
  }

  const placed: PlacedPanel[] = [];
  let currentY = 0;
  let maxWidth = 0;
  let isFirstRow = true;

  for (const [, row] of groups) {
    if (!isFirstRow) {
      currentY += gap;
    }
    isFirstRow = false;

    const rowHeight = row[0].spec.height;
    let currentX = 0;
    let isFirstInRow = true;

    for (const input of row) {
      if (!isFirstInRow) {
        currentX += gap;
      }
      isFirstInRow = false;

      const formatLabels: Record<string, string> = {
        "3u": "3U",
        "1u-intellijel": "1U Intellijel",
        "1u-pulplogic": "1U Pulp Logic",
      };
      const label = `${input.spec.hp}HP ${formatLabels[input.spec.format] || input.spec.format}`;
      placed.push({
        spec: input.spec,
        x: currentX,
        y: currentY,
        label,
        pattern: input.pattern,
        patternSeed: input.patternSeed,
      });

      currentX += input.spec.width;
    }

    if (currentX > maxWidth) {
      maxWidth = currentX;
    }

    currentY += rowHeight;
  }

  return {
    placed,
    sheetWidth: maxWidth,
    sheetHeight: currentY,
  };
}
