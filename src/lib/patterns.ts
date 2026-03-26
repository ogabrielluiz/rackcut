/**
 * Pattern generation facade.
 *
 * This module is the public API for pattern generation. It delegates to:
 * - pattern-geometry/ for abstract geometry generation
 * - renderers/svg-renderer for SVG string output
 *
 * Consumers that need SVG strings (svg.ts, SvgPreview.tsx) use generatePattern().
 * Consumers that need raw geometry (stl-renderer) use generatePatternGeometry() directly.
 */

import { ENGRAVE_COLOR } from "./constants";
import type { PatternType } from "./types";
import { generatePatternGeometry } from "./pattern-geometry";
import { renderPatternToSvg } from "./renderers/svg-renderer";

// Re-export from pattern-geometry for backwards compatibility
export { PATTERN_LABELS, SORTED_PATTERN_ENTRIES } from "./pattern-geometry";
export { generatePatternGeometry } from "./pattern-geometry";

const STROKE_WIDTH = 0.25;

/**
 * Generate an SVG string for a pattern. This is the main API used by
 * svg.ts and the preview components.
 */
export function generatePattern(
  pattern: PatternType,
  width: number,
  height: number,
  seed: number
): string {
  if (pattern === "none") return "";

  const geometry = generatePatternGeometry(pattern, width, height, seed);
  return renderPatternToSvg(geometry, ENGRAVE_COLOR, STROKE_WIDTH);
}
