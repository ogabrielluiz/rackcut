// All values in mm — based on Doepfer A-100 and Intellijel specs

export const HP_MM = 5.08;
export const PANEL_WIDTH_CLEARANCE = 0.3;

export const PANEL_HEIGHT_3U = 128.5;
export const PANEL_HEIGHT_1U_INTELLIJEL = 39.65;
export const PANEL_HEIGHT_1U_PULPLOGIC = 43.18;

export const HOLE_DIAMETER = 3.2;
export const SLOT_WIDTH = 4.0;
export const SLOT_HEIGHT = 3.2;

export const HOLE_EDGE_OFFSET_H = 7.5;
export const HOLE_EDGE_OFFSET_V = 3.0;

// Minimum material left between a mounting hole and the panel edge.
export const MIN_HOLE_EDGE_MARGIN = 0.6;

export const FOUR_HOLE_THRESHOLD_HP = 10;

export const CUT_COLOR = "#FF0000";
export const ENGRAVE_COLOR = "#0000FF";
export const CUT_STROKE_WIDTH = 0.1;

export const FORMAT_PARAMS = {
  "3u": {
    height: PANEL_HEIGHT_3U,
    holeEdgeV: HOLE_EDGE_OFFSET_V,
  },
  "1u-intellijel": {
    height: PANEL_HEIGHT_1U_INTELLIJEL,
    holeEdgeV: HOLE_EDGE_OFFSET_V,
  },
  "1u-pulplogic": {
    height: PANEL_HEIGHT_1U_PULPLOGIC,
    holeEdgeV: HOLE_EDGE_OFFSET_V,
  },
} as const;

export const MIN_HP = 1;
export const MAX_HP = 128;
/** Most copies of one panel a sheet will hold */
export const MAX_QUANTITY = 100;
export const MIN_GAP = 0.5;
export const MAX_GAP = 20;
export const DEFAULT_GAP = 2.0;
export const SVG_MARGIN = 5.0;
export const DEFAULT_MAX_BLANK_HP = 20;

// 3D print defaults
export const DEFAULT_PRINT_COLOR = "#cccccc";
/** Second filament for two-tone bands */
export const DEFAULT_ACCENT_COLOR = "#2a2a2a";
/** Thickness of a real module panel: 2 mm anodised aluminium (Doepfer A-100 construction details) */
export const STANDARD_PANEL_THICKNESS = 2;
/**
 * Panel thicknesses offered for printing. Panels made as circuit boards are
 * 1.6 mm; 3 mm is stiffer but stands 1 mm proud of the modules beside it.
 */
export const PANEL_THICKNESS_PRESETS = [
  { mm: 1.6, label: "PCB" },
  { mm: STANDARD_PANEL_THICKNESS, label: "Eurorack standard" },
  { mm: 3, label: "sturdy" },
] as const;
export const DEFAULT_PRINT_THICKNESS = STANDARD_PANEL_THICKNESS;
/** Height of raised lines and two-tone bands: three 0.2mm layers */
export const DEFAULT_PATTERN_HEIGHT = 0.6;
/** Peak height of relief surfaces: five 0.2mm layers, enough steps to read as sculpted */
export const DEFAULT_RELIEF_HEIGHT = 1.0;
