import {
  HP_MM,
  PANEL_WIDTH_CLEARANCE,
  HOLE_EDGE_OFFSET_H,
  HOLE_DIAMETER,
  SLOT_WIDTH,
  MIN_HOLE_EDGE_MARGIN,
  FOUR_HOLE_THRESHOLD_HP,
  FORMAT_PARAMS,
  MIN_HP,
  MAX_HP,
} from "./constants";
import type { Format, HoleStyle, PanelSpec, PlacedPanel } from "./types";
import { PanelValidationError } from "./types";

// ---------------------------------------------------------------------------
// Hole placement
// ---------------------------------------------------------------------------

/** Panel width in mm for a given HP, including the fit clearance. */
export function panelWidth(hp: number): number {
  return hp * HP_MM - PANEL_WIDTH_CLEARANCE;
}

/** How far a mounting feature reaches horizontally from its own center. */
function holeHalfWidth(style: HoleStyle): number {
  return style === "circle" ? HOLE_DIAMETER / 2 : SLOT_WIDTH / 2;
}

/**
 * Pick the leftmost mounting-hole X for a panel.
 *
 * The standard offset is HOLE_EDGE_OFFSET_H from the left edge, but that sits
 * off the panel entirely on a 1HP blank (7.5mm offset, 4.78mm of panel). Moving
 * the hole left by a whole number of HP lands it on the same rack thread grid,
 * so the panel still bolts up — it just uses the previous rail position.
 *
 * Returns null when no grid position leaves MIN_HOLE_EDGE_MARGIN of material on
 * both sides, i.e. the feature is simply too wide for the panel.
 */
function gridAlignedLeftX(width: number, style: HoleStyle): number | null {
  const halfWidth = holeHalfWidth(style);
  const minX = halfWidth + MIN_HOLE_EDGE_MARGIN;
  const maxX = width - halfWidth - MIN_HOLE_EDGE_MARGIN;

  for (let x = HOLE_EDGE_OFFSET_H; x >= minX; x -= HP_MM) {
    if (x <= maxX) return x;
  }
  return null;
}

/**
 * The hole style a panel can actually be cut with.
 *
 * A slot is 4mm wide, which leaves no usable material on the narrowest panels,
 * so those fall back to a round hole. Everything downstream reads the style off
 * the returned PanelSpec, so preview, SVG and STL all agree.
 */
export function resolveHoleStyle(hp: number, requested: HoleStyle): HoleStyle {
  if (requested === "circle") return "circle";
  return gridAlignedLeftX(panelWidth(hp), "slot") !== null ? "slot" : "circle";
}

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

  const width = panelWidth(hp);
  const effectiveHoleStyle = resolveHoleStyle(hp, holeStyle);

  // Horizontal hole positions. Fall back to horizontally centered if even a
  // round hole has no grid position that fits — unreachable for HP >= MIN_HP,
  // but better than emitting a hole off the edge of the panel.
  const leftX = gridAlignedLeftX(width, effectiveHoleStyle) ?? width / 2;
  const rawRightX = leftX + (hp - 3) * HP_MM;
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

  return { width, height, hp, format, holes, holeStyle: effectiveHoleStyle };
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
