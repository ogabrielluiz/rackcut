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
// layoutPanels
// ---------------------------------------------------------------------------

export interface LayoutResult {
  placed: PlacedPanel[];
  sheetWidth: number;
  sheetHeight: number;
}

export function layoutPanels(panels: PanelSpec[], gap: number): LayoutResult {
  if (panels.length === 0) {
    return { placed: [], sheetWidth: 0, sheetHeight: 0 };
  }

  // Group panels by height (rounded to 0.01 mm for floating-point safety)
  const groups = new Map<number, PanelSpec[]>();
  for (const panel of panels) {
    const key = Math.round(panel.height * 100) / 100;
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

    const rowHeight = row[0].height;
    let currentX = 0;
    let isFirstInRow = true;

    for (const spec of row) {
      if (!isFirstInRow) {
        currentX += gap;
      }
      isFirstInRow = false;

      const formatLabels: Record<string, string> = {
        "3u": "3U",
        "1u-intellijel": "1U Intellijel",
        "1u-pulplogic": "1U Pulp Logic",
      };
      const label = `${spec.hp}HP ${formatLabels[spec.format] || spec.format}`;
      placed.push({ spec, x: currentX, y: currentY, label });

      currentX += spec.width;
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
