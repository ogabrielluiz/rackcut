import type { PatternGeometry } from "../pattern-geometry/types";

/**
 * Renders PatternGeometry to an SVG string fragment.
 * This produces the same output that the old patterns.ts did directly.
 */
export function renderPatternToSvg(
  geometry: PatternGeometry,
  strokeColor: string,
  strokeWidth: number
): string {
  const STROKE = `stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="none"`;
  const parts: string[] = [];

  for (const circle of geometry.circles) {
    parts.push(
      `<circle cx="${circle.cx.toFixed(2)}" cy="${circle.cy.toFixed(2)}" r="${circle.r.toFixed(2)}" ${STROKE}/>`
    );
  }

  for (const line of geometry.lines) {
    parts.push(
      `<line x1="${line.x1.toFixed(2)}" y1="${line.y1.toFixed(2)}" x2="${line.x2.toFixed(2)}" y2="${line.y2.toFixed(2)}" ${STROKE}/>`
    );
  }

  for (const path of geometry.paths) {
    if (path.points.length < 2) continue;
    const pts = path.points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
    parts.push(`<polyline points="${pts}" ${STROKE}/>`);
  }

  for (const polygon of geometry.polygons) {
    if (polygon.points.length < 3) continue;
    const pts = polygon.points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
    parts.push(`<polygon points="${pts}" ${STROKE}/>`);
  }

  for (const rect of geometry.rects) {
    const rx = rect.rx ?? 0;
    const ry = rect.ry ?? rx;
    parts.push(
      `<rect x="${rect.x.toFixed(2)}" y="${rect.y.toFixed(2)}" width="${rect.width.toFixed(2)}" height="${rect.height.toFixed(2)}" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}" ${STROKE}/>`
    );
  }

  for (const text of geometry.texts) {
    const opacity = text.opacity !== undefined ? ` opacity="${text.opacity.toFixed(2)}"` : "";
    parts.push(
      `<text x="${text.x.toFixed(2)}" y="${text.y.toFixed(2)}" ` +
      `font-family="monospace" font-size="${text.fontSize}" ` +
      `fill="none" stroke="${strokeColor}" stroke-width="${Math.max(strokeWidth * 0.8, 0.2)}"${opacity}>${text.text}</text>`
    );
  }

  return parts.join("\n    ");
}
