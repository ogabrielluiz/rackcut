/**
 * Abstract 2D geometry produced by pattern generators.
 * Renderers convert this to SVG strings or 3D meshes.
 */

/** A sequence of points forming an open polyline */
export interface Path2D {
  points: [number, number][];
}

/** A closed polygon defined by vertices */
export interface Polygon2D {
  points: [number, number][];
}

/** A circle defined by center and radius */
export interface Circle2D {
  cx: number;
  cy: number;
  r: number;
}

/** A rectangle (axis-aligned) with optional corner radius */
export interface Rect2D {
  x: number;
  y: number;
  width: number;
  height: number;
  rx?: number;
  ry?: number;
}

/** A line segment */
export interface Line2D {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** A text element (for patterns like binary-matrix) */
export interface Text2D {
  x: number;
  y: number;
  text: string;
  fontSize: number;
  opacity?: number;
}

/**
 * Complete geometry output from a pattern generator.
 * Each field is optional — patterns use whichever primitives they need.
 */
export interface PatternGeometry {
  paths: Path2D[];
  polygons: Polygon2D[];
  circles: Circle2D[];
  rects: Rect2D[];
  lines: Line2D[];
  texts: Text2D[];
}

/** Creates an empty PatternGeometry */
export function emptyGeometry(): PatternGeometry {
  return {
    paths: [],
    polygons: [],
    circles: [],
    rects: [],
    lines: [],
    texts: [],
  };
}
