import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import SvgPreview from "./SvgPreview";
import { computePanel } from "@/lib/panel";
import type { PlacedPanel } from "@/lib/types";

describe("SvgPreview", () => {
  it("shows empty state message when no panels", () => {
    render(<SvgPreview placed={[]} sheetWidth={200} sheetHeight={100} />);
    expect(
      screen.getByText(/add panels to preview your cut sheet/i)
    ).toBeInTheDocument();
  });

  it("renders SVG element when panels exist", () => {
    const spec = computePanel(8, "3u", "slot");
    const placed: PlacedPanel[] = [{ spec, x: 0, y: 0, label: "8HP 3U" }];

    const { container } = render(
      <SvgPreview placed={placed} sheetWidth={200} sheetHeight={100} />
    );

    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("does not show empty state message when panels exist", () => {
    const spec = computePanel(8, "3u", "slot");
    const placed: PlacedPanel[] = [{ spec, x: 0, y: 0, label: "8HP 3U" }];

    render(<SvgPreview placed={placed} sheetWidth={200} sheetHeight={100} />);

    expect(
      screen.queryByText(/add panels to preview your cut sheet/i)
    ).not.toBeInTheDocument();
  });

  it("updates SVG when panels change (more panels produce more panel groups)", () => {
    const spec8 = computePanel(8, "3u", "slot");
    const initialPlaced: PlacedPanel[] = [
      { spec: spec8, x: 0, y: 0, label: "8HP 3U" },
    ];

    const { container, rerender } = render(
      <SvgPreview placed={initialPlaced} sheetWidth={300} sheetHeight={100} />
    );

    const initialGroups = container.querySelectorAll("g[transform]").length;

    const spec4 = computePanel(4, "3u", "slot");
    const updatedPlaced: PlacedPanel[] = [
      { spec: spec8, x: 0, y: 0, label: "8HP 3U" },
      { spec: spec4, x: 50, y: 0, label: "4HP 3U" },
    ];

    rerender(
      <SvgPreview placed={updatedPlaced} sheetWidth={300} sheetHeight={100} />
    );

    const updatedGroups = container.querySelectorAll("g[transform]").length;
    expect(updatedGroups).toBeGreaterThan(initialGroups);
  });
});
