// All values in mm — based on Doepfer A-100 and Intellijel specs

export const HP_MM = 5.08;
export const PANEL_WIDTH_CLEARANCE = 0.3;

export const PANEL_HEIGHT_3U = 128.5;
export const PANEL_HEIGHT_1U_INTELLIJEL = 39.65;
export const PANEL_HEIGHT_1U_PULPLOGIC = 43.18;

export const HOLE_DIAMETER = 3.2;
export const SLOT_WIDTH = 3.2;
export const SLOT_HEIGHT = 3.5;

export const HOLE_EDGE_OFFSET_H = 7.5;
export const HOLE_EDGE_OFFSET_V = 3.0;

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
export const MIN_GAP = 0.5;
export const MAX_GAP = 20;
export const DEFAULT_GAP = 2.0;
export const SVG_MARGIN = 5.0;
