import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import SvgPreview from "./SvgPreview";
import { computePanel } from "@/lib/panel";
import type { PlacedPanel } from "@/lib/types";

function makePlaced(overrides: Partial<PlacedPanel> & { spec: PlacedPanel["spec"] }): PlacedPanel {
  return {
    x: 0,
    y: 0,
    label: "8HP 3U",
    pattern: "none",
    patternSeed: 0,
    ...overrides,
  };
}

describe("SvgPreview", () => {
  it("shows empty state message when no panels", () => {
    render(<SvgPreview placed={[]} sheetWidth={200} sheetHeight={100} material="mdf" />);
    expect(
      screen.getByText(/add panels to preview your cut sheet/i)
    ).toBeInTheDocument();
  });

  it("renders SVG element when panels exist", () => {
    const spec = computePanel(8, "3u", "slot");
    const placed = [makePlaced({ spec })];

    const { container } = render(
      <SvgPreview placed={placed} sheetWidth={200} sheetHeight={100} material="mdf" />
    );

    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("does not show empty state message when panels exist", () => {
    const spec = computePanel(8, "3u", "slot");
    const placed = [makePlaced({ spec })];

    render(<SvgPreview placed={placed} sheetWidth={200} sheetHeight={100} material="mdf" />);

    expect(
      screen.queryByText(/add panels to preview your cut sheet/i)
    ).not.toBeInTheDocument();
  });

  it("updates SVG when panels change (more panels produce more panel groups)", () => {
    const spec8 = computePanel(8, "3u", "slot");
    const initialPlaced = [makePlaced({ spec: spec8 })];

    const { container, rerender } = render(
      <SvgPreview placed={initialPlaced} sheetWidth={300} sheetHeight={100} material="mdf" />
    );

    const initialGroups = container.querySelectorAll("g[transform]").length;

    const spec4 = computePanel(4, "3u", "slot");
    const updatedPlaced = [
      makePlaced({ spec: spec8 }),
      makePlaced({ spec: spec4, x: 50, label: "4HP 3U" }),
    ];

    rerender(
      <SvgPreview placed={updatedPlaced} sheetWidth={300} sheetHeight={100} material="mdf" />
    );

    const updatedGroups = container.querySelectorAll("g[transform]").length;
    expect(updatedGroups).toBeGreaterThan(initialGroups);
  });

  describe("surface patterns", () => {
    const spec = computePanel(4, "3u", "slot");
    const sheet = (pattern: PlacedPanel["pattern"], props: { material?: "mdf"; printColor?: string; accentColor?: string }) =>
      render(
        <SvgPreview placed={[makePlaced({ spec, pattern, patternSeed: 7 })]} sheetWidth={100} sheetHeight={130} {...props} />
      ).container;

    it("shows a relief pattern as a lit image in print mode", () => {
      const container = sheet("relief-damascus", { printColor: "#cccccc" });
      const image = container.querySelector("image");
      expect(image).toBeInTheDocument();
      expect(image!.getAttribute("href")).toMatch(/^data:image\/bmp;base64,/);
      expect(Number(image!.getAttribute("width"))).toBeCloseTo(spec.width);
      expect(Number(image!.getAttribute("height"))).toBeCloseTo(spec.height);
      // and not as engrave strokes on top
      expect(container.querySelector("polyline")).not.toBeInTheDocument();
    });

    it("colours two-tone bands with the accent filament", () => {
      const href = (accentColor: string) =>
        sheet("bands-marble", { printColor: "#cccccc", accentColor }).querySelector("image")!.getAttribute("href");
      expect(href("#2a2a2a")).not.toBe(href("#cc3333"));
    });

    it("engraves the band outlines in laser mode", () => {
      const container = sheet("bands-marble", { material: "mdf" });
      expect(container.querySelector("image")).not.toBeInTheDocument();
      expect(container.querySelectorAll("polyline").length).toBeGreaterThan(3);
    });

    it("keeps line patterns as strokes in print mode", () => {
      const container = sheet("waveform", { printColor: "#cccccc" });
      expect(container.querySelector("image")).not.toBeInTheDocument();
      expect(container.querySelectorAll("polyline").length).toBeGreaterThan(0);
    });
  });
});
