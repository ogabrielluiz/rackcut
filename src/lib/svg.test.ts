import { describe, it, expect, vi, afterEach } from "vitest";
import { generateSvg, downloadSvg } from "./svg";
import type { PlacedPanel } from "./types";
import type { Format, HoleStyle } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlacedPanel(overrides: Partial<PlacedPanel> = {}): PlacedPanel {
  return {
    spec: {
      width: 40.34,
      height: 128.5,
      hp: 8,
      format: "3u" as Format,
      holes: [
        [7.5, 3.0],
        [32.84, 125.5],
      ],
      holeStyle: "slot" as HoleStyle,
    },
    x: 0,
    y: 0,
    label: "8HP",
    pattern: "none" as const,
    patternSeed: 0,
    ...overrides,
  };
}

function parseSvg(svgString: string): Document {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, "image/svg+xml");
  // Check for parse errors
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    throw new Error(`SVG parse error: ${parserError.textContent}`);
  }
  return doc;
}

// ---------------------------------------------------------------------------
// generateSvg — structural / shape tests
// ---------------------------------------------------------------------------

describe("generateSvg", () => {
  describe("SVG root structure", () => {
    it("includes xml declaration", () => {
      const svg = generateSvg([], 200, 300);
      expect(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    });

    it("produces parseable SVG XML", () => {
      const svg = generateSvg([], 200, 300);
      expect(() => parseSvg(svg)).not.toThrow();
    });

    it("root element is svg", () => {
      const doc = parseSvg(generateSvg([], 200, 300));
      expect(doc.documentElement.tagName).toBe("svg");
    });

    it("has xmlns attribute", () => {
      const doc = parseSvg(generateSvg([], 200, 300));
      const svg = doc.documentElement;
      expect(svg.getAttribute("xmlns")).toBe("http://www.w3.org/2000/svg");
    });

    it("width attribute includes mm units", () => {
      const doc = parseSvg(generateSvg([], 200, 300));
      const svg = doc.documentElement;
      expect(svg.getAttribute("width")).toContain("mm");
    });

    it("height attribute includes mm units", () => {
      const doc = parseSvg(generateSvg([], 200, 300));
      const svg = doc.documentElement;
      expect(svg.getAttribute("height")).toContain("mm");
    });

    it("width reflects sheetW + 2*margin", () => {
      const margin = 5.0;
      const sheetW = 200;
      const doc = parseSvg(generateSvg([], sheetW, 300, margin));
      const svg = doc.documentElement;
      expect(svg.getAttribute("width")).toBe(`${sheetW + 2 * margin}mm`);
    });

    it("height reflects sheetH + 2*margin", () => {
      const margin = 5.0;
      const sheetH = 300;
      const doc = parseSvg(generateSvg([], 200, sheetH, margin));
      const svg = doc.documentElement;
      expect(svg.getAttribute("height")).toBe(`${sheetH + 2 * margin}mm`);
    });

    it("viewBox covers full sheet including margins", () => {
      const margin = 5.0;
      const sheetW = 200;
      const sheetH = 300;
      const doc = parseSvg(generateSvg([], sheetW, sheetH, margin));
      const svg = doc.documentElement;
      const expected = `0 0 ${sheetW + 2 * margin} ${sheetH + 2 * margin}`;
      expect(svg.getAttribute("viewBox")).toBe(expected);
    });

    it("custom margin is respected in dimensions", () => {
      const margin = 10;
      const doc = parseSvg(generateSvg([], 100, 150, margin));
      const svg = doc.documentElement;
      expect(svg.getAttribute("width")).toBe("120mm");
      expect(svg.getAttribute("height")).toBe("170mm");
    });
  });

  describe("empty panel list", () => {
    it("produces valid SVG for empty panel list", () => {
      const svg = generateSvg([], 200, 300);
      expect(() => parseSvg(svg)).not.toThrow();
    });

    it("has no rect elements inside panel groups for empty list", () => {
      const doc = parseSvg(generateSvg([], 200, 300));
      // The only groups should be the outer margin group with no panel children
      const rects = doc.querySelectorAll("rect");
      expect(rects.length).toBe(0);
    });
  });

  describe("panel outline", () => {
    it("renders a red rect for panel outline", () => {
      const placed = makePlacedPanel();
      const doc = parseSvg(generateSvg([placed], 100, 150));
      const rects = Array.from(doc.querySelectorAll("rect"));
      const outline = rects.find(
        (r) => r.getAttribute("stroke") === "#FF0000" && r.getAttribute("rx") === "0.5"
      );
      expect(outline).toBeDefined();
    });

    it("panel outline rect has correct width", () => {
      const placed = makePlacedPanel();
      const doc = parseSvg(generateSvg([placed], 100, 150));
      const rects = Array.from(doc.querySelectorAll("rect"));
      const outline = rects.find(
        (r) => r.getAttribute("stroke") === "#FF0000" && r.getAttribute("rx") === "0.5"
      );
      expect(outline?.getAttribute("width")).toBe(String(placed.spec.width));
    });

    it("panel outline rect has correct height", () => {
      const placed = makePlacedPanel();
      const doc = parseSvg(generateSvg([placed], 100, 150));
      const rects = Array.from(doc.querySelectorAll("rect"));
      const outline = rects.find(
        (r) => r.getAttribute("stroke") === "#FF0000" && r.getAttribute("rx") === "0.5"
      );
      expect(outline?.getAttribute("height")).toBe(String(placed.spec.height));
    });

    it("panel outline has fill=none", () => {
      const placed = makePlacedPanel();
      const doc = parseSvg(generateSvg([placed], 100, 150));
      const rects = Array.from(doc.querySelectorAll("rect"));
      const outline = rects.find(
        (r) => r.getAttribute("stroke") === "#FF0000" && r.getAttribute("rx") === "0.5"
      );
      expect(outline?.getAttribute("fill")).toBe("none");
    });
  });

  describe("engrave patterns", () => {
    it("renders no engrave elements when pattern is none", () => {
      const placed = makePlacedPanel({ pattern: "none" });
      const svg = generateSvg([placed], 100, 150);
      const doc = parseSvg(svg);
      const texts = doc.querySelectorAll("text");
      expect(texts.length).toBe(0);
    });

    it("renders engrave elements when pattern is set", () => {
      const placed = makePlacedPanel({ pattern: "concentric-circles", patternSeed: 42 });
      const svg = generateSvg([placed], 100, 150);
      const doc = parseSvg(svg);
      const circles = Array.from(doc.querySelectorAll("circle"));
      const engraveCircles = circles.filter((c) => c.getAttribute("stroke") === "#0000FF");
      expect(engraveCircles.length).toBeGreaterThan(0);
    });

    it("different seeds produce different patterns", () => {
      const p1 = makePlacedPanel({ pattern: "flow-field", patternSeed: 1 });
      const p2 = makePlacedPanel({ pattern: "flow-field", patternSeed: 999 });
      const svg1 = generateSvg([p1], 100, 150);
      const svg2 = generateSvg([p2], 100, 150);
      expect(svg1).not.toBe(svg2);
    });
  });

  describe("slot holes", () => {
    it("renders slot holes as rects with rx > 0", () => {
      const placed = makePlacedPanel({
        spec: {
          width: 40.34,
          height: 128.5,
          hp: 8,
          format: "3u" as Format,
          holes: [
            [7.5, 3.0],
            [32.84, 125.5],
          ],
          holeStyle: "slot" as HoleStyle,
        },
      });
      const doc = parseSvg(generateSvg([placed], 100, 150));
      const rects = Array.from(doc.querySelectorAll("rect"));
      // Slot rects: rx = min(SLOT_WIDTH, SLOT_HEIGHT)/2 = 1.6; outline rx = 0.5
      // So slot rects have rx > 0.5
      const slotRects = rects.filter((r) => {
        const rx = Number(r.getAttribute("rx") ?? 0);
        return rx > 0.5;
      });
      expect(slotRects.length).toBeGreaterThan(0);
    });

    it("renders correct number of slot holes (2 for 8HP panel with 2 holes)", () => {
      const placed = makePlacedPanel({
        spec: {
          width: 40.34,
          height: 128.5,
          hp: 8,
          format: "3u" as Format,
          holes: [
            [7.5, 3.0],
            [32.84, 125.5],
          ],
          holeStyle: "slot" as HoleStyle,
        },
      });
      const doc = parseSvg(generateSvg([placed], 100, 150));
      const rects = Array.from(doc.querySelectorAll("rect"));
      // Slot rects have rx = 1.6 (> 0.5); outline has rx = 0.5
      const slotRects = rects.filter((r) => {
        const rx = Number(r.getAttribute("rx") ?? 0);
        return rx > 0.5;
      });
      expect(slotRects.length).toBe(2);
    });

    it("renders 4 slot holes for a 12HP panel", () => {
      // 12HP >= FOUR_HOLE_THRESHOLD_HP so 4 holes
      const placed: PlacedPanel = {
        spec: {
          width: 60.96,
          height: 128.5,
          hp: 12,
          format: "3u" as Format,
          holes: [
            [7.5, 3.0],
            [7.5, 125.5],
            [53.46, 3.0],
            [53.46, 125.5],
          ],
          holeStyle: "slot" as HoleStyle,
        },
        x: 0,
        y: 0,
        label: "12HP",
      };
      const doc = parseSvg(generateSvg([placed], 100, 150));
      const rects = Array.from(doc.querySelectorAll("rect"));
      // Slot rects have rx = 1.6 (> 0.5); outline has rx = 0.5
      const slotRects = rects.filter((r) => {
        const rx = Number(r.getAttribute("rx") ?? 0);
        return rx > 0.5;
      });
      expect(slotRects.length).toBe(4);
    });

    it("slot holes use red stroke (CUT_COLOR)", () => {
      const placed = makePlacedPanel();
      const doc = parseSvg(generateSvg([placed], 100, 150));
      const rects = Array.from(doc.querySelectorAll("rect"));
      // Slot rects have rx = 1.6 (> 0.5); outline has rx = 0.5
      const slotRects = rects.filter((r) => {
        const rx = Number(r.getAttribute("rx") ?? 0);
        return rx > 0.5;
      });
      slotRects.forEach((r) => {
        expect(r.getAttribute("stroke")).toBe("#FF0000");
      });
    });
  });

  describe("circle holes", () => {
    it("renders circle holes as circle elements", () => {
      const placed: PlacedPanel = {
        spec: {
          width: 40.34,
          height: 128.5,
          hp: 8,
          format: "3u" as Format,
          holes: [
            [7.5, 3.0],
            [32.84, 125.5],
          ],
          holeStyle: "circle" as HoleStyle,
        },
        x: 0,
        y: 0,
        label: "8HP circle",
      };
      const doc = parseSvg(generateSvg([placed], 100, 150));
      const circles = doc.querySelectorAll("circle");
      expect(circles.length).toBe(2);
    });

    it("circle holes use red stroke (CUT_COLOR)", () => {
      const placed: PlacedPanel = {
        spec: {
          width: 40.34,
          height: 128.5,
          hp: 8,
          format: "3u" as Format,
          holes: [
            [7.5, 3.0],
            [32.84, 125.5],
          ],
          holeStyle: "circle" as HoleStyle,
        },
        x: 0,
        y: 0,
        label: "8HP circle",
      };
      const doc = parseSvg(generateSvg([placed], 100, 150));
      const circles = Array.from(doc.querySelectorAll("circle"));
      circles.forEach((c) => {
        expect(c.getAttribute("stroke")).toBe("#FF0000");
      });
    });

    it("circle holes have correct radius (HOLE_DIAMETER/2 = 1.6)", () => {
      const placed: PlacedPanel = {
        spec: {
          width: 40.34,
          height: 128.5,
          hp: 8,
          format: "3u" as Format,
          holes: [[7.5, 3.0]],
          holeStyle: "circle" as HoleStyle,
        },
        x: 0,
        y: 0,
        label: "8HP circle",
      };
      const doc = parseSvg(generateSvg([placed], 100, 150));
      const circles = Array.from(doc.querySelectorAll("circle"));
      expect(Number(circles[0].getAttribute("r"))).toBeCloseTo(1.6);
    });

    it("circle holes have fill=none", () => {
      const placed: PlacedPanel = {
        spec: {
          width: 40.34,
          height: 128.5,
          hp: 8,
          format: "3u" as Format,
          holes: [[7.5, 3.0]],
          holeStyle: "circle" as HoleStyle,
        },
        x: 0,
        y: 0,
        label: "8HP circle",
      };
      const doc = parseSvg(generateSvg([placed], 100, 150));
      const circles = Array.from(doc.querySelectorAll("circle"));
      expect(circles[0].getAttribute("fill")).toBe("none");
    });

    it("circle center matches hole coordinates", () => {
      const holeX = 7.5;
      const holeY = 3.0;
      const placed: PlacedPanel = {
        spec: {
          width: 40.34,
          height: 128.5,
          hp: 8,
          format: "3u" as Format,
          holes: [[holeX, holeY]],
          holeStyle: "circle" as HoleStyle,
        },
        x: 0,
        y: 0,
        label: "circle center test",
      };
      const doc = parseSvg(generateSvg([placed], 100, 150));
      const circles = Array.from(doc.querySelectorAll("circle"));
      expect(Number(circles[0].getAttribute("cx"))).toBeCloseTo(holeX);
      expect(Number(circles[0].getAttribute("cy"))).toBeCloseTo(holeY);
    });
  });

  describe("multi-panel layout", () => {
    it("renders multiple panels without overlap (each in a group with translate)", () => {
      const p1 = makePlacedPanel({ x: 0, y: 0, label: "P1" });
      const p2 = makePlacedPanel({ x: 50, y: 0, label: "P2" });
      const svg = generateSvg([p1, p2], 200, 150);
      const doc = parseSvg(svg);
      // Each panel in its own group with a translate transform
      const groups = Array.from(doc.querySelectorAll("g[transform]"));
      // One outer margin group + 2 panel groups
      const panelGroups = groups.filter((g) =>
        g.getAttribute("transform")?.startsWith("translate(")
      );
      expect(panelGroups.length).toBeGreaterThanOrEqual(2);
    });

    it("renders correct number of outlines for multiple panels", () => {
      const p1 = makePlacedPanel({ x: 0, y: 0, label: "P1" });
      const p2 = makePlacedPanel({ x: 50, y: 0, label: "P2" });
      const doc = parseSvg(generateSvg([p1, p2], 200, 150));
      const rects = Array.from(doc.querySelectorAll("rect"));
      const outlines = rects.filter(
        (r) => r.getAttribute("stroke") === "#FF0000" && r.getAttribute("rx") === "0.5"
      );
      expect(outlines.length).toBe(2);
    });

    it("panel groups have translate matching placed x/y offset from margin", () => {
      const margin = 5;
      const p1 = makePlacedPanel({ x: 10, y: 20, label: "P1" });
      const svg = generateSvg([p1], 200, 150, margin);
      // The panel group should have translate(10, 20) relative to outer margin group
      expect(svg).toContain("translate(10, 20)");
    });
  });

  describe("stroke widths", () => {
    it("outline uses CUT_STROKE_WIDTH (0.1)", () => {
      const placed = makePlacedPanel();
      const doc = parseSvg(generateSvg([placed], 100, 150));
      const rects = Array.from(doc.querySelectorAll("rect"));
      const outline = rects.find(
        (r) => r.getAttribute("stroke") === "#FF0000" && r.getAttribute("rx") === "0.5"
      );
      expect(outline?.getAttribute("stroke-width")).toBe("0.1");
    });
  });
});

// ---------------------------------------------------------------------------
// downloadSvg tests
// ---------------------------------------------------------------------------

describe("downloadSvg", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates an anchor element and clicks it", async () => {
    const { downloadSvg } = await import("./svg");
    const clickMock = vi.fn();
    const revokeMock = vi.fn();

    vi.spyOn(document, "createElement").mockReturnValue({
      href: "",
      download: "",
      click: clickMock,
      style: { display: "" },
    } as unknown as HTMLAnchorElement);

    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake-url");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(revokeMock);
    vi.spyOn(document.body, "appendChild").mockImplementation((el) => el);
    vi.spyOn(document.body, "removeChild").mockImplementation((el) => el);

    downloadSvg("<svg/>", "test.svg");

    expect(clickMock).toHaveBeenCalledTimes(1);
  });

  it("uses default filename rackcut.svg when not specified", async () => {
    const { downloadSvg } = await import("./svg");
    let capturedDownload = "";
    const anchor = {
      href: "",
      get download() {
        return capturedDownload;
      },
      set download(v: string) {
        capturedDownload = v;
      },
      click: vi.fn(),
      style: { display: "" },
    };

    vi.spyOn(document, "createElement").mockReturnValue(anchor as unknown as HTMLAnchorElement);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake-url");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(document.body, "appendChild").mockImplementation((el) => el);
    vi.spyOn(document.body, "removeChild").mockImplementation((el) => el);

    downloadSvg("<svg/>");

    expect(capturedDownload).toBe("rackcut.svg");
  });

  it("uses custom filename when provided", async () => {
    const { downloadSvg } = await import("./svg");
    let capturedDownload = "";
    const anchor = {
      href: "",
      get download() {
        return capturedDownload;
      },
      set download(v: string) {
        capturedDownload = v;
      },
      click: vi.fn(),
      style: { display: "" },
    };

    vi.spyOn(document, "createElement").mockReturnValue(anchor as unknown as HTMLAnchorElement);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake-url");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(document.body, "appendChild").mockImplementation((el) => el);
    vi.spyOn(document.body, "removeChild").mockImplementation((el) => el);

    downloadSvg("<svg/>", "custom-output.svg");

    expect(capturedDownload).toBe("custom-output.svg");
  });

  it("revokes the object URL after click", async () => {
    const { downloadSvg } = await import("./svg");
    const revokeMock = vi.fn();

    vi.spyOn(document, "createElement").mockReturnValue({
      href: "",
      download: "",
      click: vi.fn(),
      style: { display: "" },
    } as unknown as HTMLAnchorElement);

    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake-url");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(revokeMock);
    vi.spyOn(document.body, "appendChild").mockImplementation((el) => el);
    vi.spyOn(document.body, "removeChild").mockImplementation((el) => el);

    downloadSvg("<svg/>");

    expect(revokeMock).toHaveBeenCalledWith("blob:fake-url");
  });
});
