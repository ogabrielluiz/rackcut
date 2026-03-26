import { describe, it, expect } from "vitest";
import { renderPatternToSvg } from "./svg-renderer";
import { emptyGeometry } from "../pattern-geometry/types";
import type { PatternGeometry } from "../pattern-geometry/types";

const COLOR = "#0000FF";
const SW = 0.25;

function geo(overrides: Partial<PatternGeometry> = {}): PatternGeometry {
  return { ...emptyGeometry(), ...overrides };
}

describe("renderPatternToSvg", () => {
  it("returns empty string for empty geometry", () => {
    expect(renderPatternToSvg(emptyGeometry(), COLOR, SW)).toBe("");
  });

  // Circles
  it("emits <circle> for Circle2D", () => {
    const svg = renderPatternToSvg(
      geo({ circles: [{ cx: 10, cy: 20, r: 5 }] }),
      COLOR, SW
    );
    expect(svg).toContain("<circle");
    expect(svg).toContain('cx="10.00"');
    expect(svg).toContain('cy="20.00"');
    expect(svg).toContain('r="5.00"');
    expect(svg).toContain(`stroke="${COLOR}"`);
  });

  it("emits multiple circles", () => {
    const svg = renderPatternToSvg(
      geo({ circles: [{ cx: 1, cy: 2, r: 3 }, { cx: 4, cy: 5, r: 6 }] }),
      COLOR, SW
    );
    const matches = svg.match(/<circle/g);
    expect(matches).toHaveLength(2);
  });

  // Lines
  it("emits <line> for Line2D", () => {
    const svg = renderPatternToSvg(
      geo({ lines: [{ x1: 0, y1: 0, x2: 10, y2: 20 }] }),
      COLOR, SW
    );
    expect(svg).toContain("<line");
    expect(svg).toContain('x1="0.00"');
    expect(svg).toContain('y2="20.00"');
  });

  // Paths
  it("emits <polyline> for Path2D with 2+ points", () => {
    const svg = renderPatternToSvg(
      geo({ paths: [{ points: [[0, 0], [10, 10], [20, 0]] }] }),
      COLOR, SW
    );
    expect(svg).toContain("<polyline");
    expect(svg).toContain("points=");
  });

  it("skips Path2D with fewer than 2 points", () => {
    const svg = renderPatternToSvg(
      geo({ paths: [{ points: [[5, 5]] }] }),
      COLOR, SW
    );
    expect(svg).not.toContain("<polyline");
  });

  it("skips Path2D with 0 points", () => {
    const svg = renderPatternToSvg(
      geo({ paths: [{ points: [] }] }),
      COLOR, SW
    );
    expect(svg).toBe("");
  });

  // Polygons
  it("emits <polygon> for Polygon2D with 3+ points", () => {
    const svg = renderPatternToSvg(
      geo({ polygons: [{ points: [[0, 0], [10, 0], [5, 10]] }] }),
      COLOR, SW
    );
    expect(svg).toContain("<polygon");
  });

  it("skips Polygon2D with fewer than 3 points", () => {
    const svg = renderPatternToSvg(
      geo({ polygons: [{ points: [[0, 0], [10, 0]] }] }),
      COLOR, SW
    );
    expect(svg).not.toContain("<polygon");
  });

  // Rects
  it("emits <rect> for Rect2D", () => {
    const svg = renderPatternToSvg(
      geo({ rects: [{ x: 1, y: 2, width: 10, height: 5 }] }),
      COLOR, SW
    );
    expect(svg).toContain("<rect");
    expect(svg).toContain('x="1.00"');
    expect(svg).toContain('width="10.00"');
    expect(svg).toContain('rx="0.00"'); // default rx
  });

  it("emits rx/ry when provided", () => {
    const svg = renderPatternToSvg(
      geo({ rects: [{ x: 0, y: 0, width: 10, height: 5, rx: 2, ry: 3 }] }),
      COLOR, SW
    );
    expect(svg).toContain('rx="2.00"');
    expect(svg).toContain('ry="3.00"');
  });

  it("ry defaults to rx when only rx provided", () => {
    const svg = renderPatternToSvg(
      geo({ rects: [{ x: 0, y: 0, width: 10, height: 5, rx: 2 }] }),
      COLOR, SW
    );
    expect(svg).toContain('rx="2.00"');
    expect(svg).toContain('ry="2.00"');
  });

  // Texts
  it("emits <text> for Text2D", () => {
    const svg = renderPatternToSvg(
      geo({ texts: [{ x: 5, y: 10, text: "1", fontSize: 4 }] }),
      COLOR, SW
    );
    expect(svg).toContain("<text");
    expect(svg).toContain('font-size="4"');
    expect(svg).toContain(">1</text>");
    expect(svg).toContain(`stroke="${COLOR}"`);
  });

  it("includes opacity on text when provided", () => {
    const svg = renderPatternToSvg(
      geo({ texts: [{ x: 0, y: 0, text: "0", fontSize: 3, opacity: 0.5 }] }),
      COLOR, SW
    );
    expect(svg).toContain('opacity="0.50"');
  });

  it("omits opacity on text when not provided", () => {
    const svg = renderPatternToSvg(
      geo({ texts: [{ x: 0, y: 0, text: "0", fontSize: 3 }] }),
      COLOR, SW
    );
    expect(svg).not.toContain("opacity");
  });

  it("text stroke-width is scaled from main stroke-width", () => {
    const svg = renderPatternToSvg(
      geo({ texts: [{ x: 0, y: 0, text: "X", fontSize: 4 }] }),
      COLOR, 0.5
    );
    // stroke-width should be max(0.5 * 0.8, 0.2) = 0.4
    expect(svg).toContain('stroke-width="0.4"');
  });

  it("text stroke-width has minimum of 0.2", () => {
    const svg = renderPatternToSvg(
      geo({ texts: [{ x: 0, y: 0, text: "X", fontSize: 4 }] }),
      COLOR, 0.1
    );
    // stroke-width should be max(0.1 * 0.8, 0.2) = 0.2
    expect(svg).toContain('stroke-width="0.2"');
  });

  // Color and stroke threading
  it("uses provided stroke color on all element types", () => {
    const svg = renderPatternToSvg(
      geo({
        circles: [{ cx: 0, cy: 0, r: 1 }],
        lines: [{ x1: 0, y1: 0, x2: 1, y2: 1 }],
        paths: [{ points: [[0, 0], [1, 1]] }],
      }),
      "#FF0000", SW
    );
    const matches = svg.match(/stroke="#FF0000"/g);
    expect(matches!.length).toBeGreaterThanOrEqual(3);
  });

  it("uses provided stroke width", () => {
    const svg = renderPatternToSvg(
      geo({ circles: [{ cx: 0, cy: 0, r: 1 }] }),
      COLOR, 0.5
    );
    expect(svg).toContain('stroke-width="0.5"');
  });

  // Mixed geometry
  it("handles all geometry types together", () => {
    const svg = renderPatternToSvg(
      geo({
        circles: [{ cx: 0, cy: 0, r: 1 }],
        lines: [{ x1: 0, y1: 0, x2: 1, y2: 1 }],
        paths: [{ points: [[0, 0], [1, 1], [2, 0]] }],
        polygons: [{ points: [[0, 0], [1, 0], [0.5, 1]] }],
        rects: [{ x: 0, y: 0, width: 5, height: 3 }],
        texts: [{ x: 0, y: 0, text: "A", fontSize: 3 }],
      }),
      COLOR, SW
    );
    expect(svg).toContain("<circle");
    expect(svg).toContain("<line");
    expect(svg).toContain("<polyline");
    expect(svg).toContain("<polygon");
    expect(svg).toContain("<rect");
    expect(svg).toContain("<text");
  });
});
