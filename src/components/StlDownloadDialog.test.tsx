import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import StlDownloadDialog from "./StlDownloadDialog";
import { computePanel } from "@/lib/panel";
import type { PatternType, PlacedPanel } from "@/lib/types";

function panelsOf(...patterns: PatternType[]): PlacedPanel[] {
  return patterns.map((pattern, i) => ({
    spec: computePanel(4, "3u", "slot"),
    x: i * 25,
    y: 0,
    label: "4HP 3U",
    pattern,
    patternSeed: i,
  }));
}

async function openDialog(...patterns: PatternType[]) {
  const user = userEvent.setup();
  render(<StlDownloadDialog panels={panelsOf(...patterns)} engraveMode="extrude" />);
  await user.click(screen.getByRole("button", { name: "Download STL" }));
  return user;
}

describe("StlDownloadDialog", () => {
  it("asks for thickness and pattern height for line patterns, as before", async () => {
    await openDialog("waveform", "none");
    expect(screen.getByLabelText("Panel thickness (mm)")).toBeInTheDocument();
    expect(screen.getByLabelText("Pattern extrusion height (mm)")).toHaveValue(0.6);
    expect(screen.queryByLabelText("Relief height (mm)")).not.toBeInTheDocument();
    expect(screen.queryByText(/switch filament/i)).not.toBeInTheDocument();
  });

  it("adds a relief height when a relief panel is on the sheet", async () => {
    await openDialog("waveform", "relief-damascus");
    expect(screen.getByLabelText("Pattern extrusion height (mm)")).toBeInTheDocument();
    expect(screen.getByLabelText("Relief height (mm)")).toHaveValue(1);
  });

  it("drops the pattern height when relief is the only pattern", async () => {
    await openDialog("relief-damascus", "relief-cells", "none");
    expect(screen.getByLabelText("Relief height (mm)")).toBeInTheDocument();
    expect(screen.queryByLabelText("Pattern extrusion height (mm)")).not.toBeInTheDocument();
  });

  it("counts the layer steps a relief height prints in", async () => {
    const user = await openDialog("relief-topo");
    expect(screen.getByText(/5 at 0\.2 mm layers/)).toBeInTheDocument();
    // The field ignores an empty value, so replace the selection instead of clearing first
    await user.tripleClick(screen.getByLabelText("Relief height (mm)"));
    await user.keyboard("1.6");
    expect(screen.getByText(/8 at 0\.2 mm layers/)).toBeInTheDocument();
  });

  it("says where to switch filament for two-tone bands", async () => {
    const user = await openDialog("bands-marble");
    expect(screen.getByText(/switch filament at the first layer above 2 mm/i)).toBeInTheDocument();
    await user.tripleClick(screen.getByLabelText("Panel thickness (mm)"));
    await user.keyboard("3");
    expect(screen.getByText(/switch filament at the first layer above 3 mm/i)).toBeInTheDocument();
  });

  // Real module panels are 2 mm aluminium (Doepfer A-100), or 1.6 mm when made as a PCB.
  describe("panel thickness", () => {
    const preset = (name: RegExp) => screen.getByRole("button", { name });
    const pressed = () =>
      screen
        .getAllByRole("button", { pressed: true })
        .map((button) => button.textContent);

    it("starts at the Eurorack standard, 2 mm", async () => {
      await openDialog("none");
      expect(screen.getByLabelText("Panel thickness (mm)")).toHaveValue(2);
      expect(pressed()).toEqual([expect.stringMatching(/^2 mm.*standard/i)]);
    });

    it("offers the PCB and sturdy thicknesses as presets", async () => {
      const user = await openDialog("none");
      await user.click(preset(/^1\.6 mm/));
      expect(screen.getByLabelText("Panel thickness (mm)")).toHaveValue(1.6);
      expect(pressed()).toEqual([expect.stringMatching(/^1\.6 mm/)]);

      await user.click(preset(/^3 mm/));
      expect(screen.getByLabelText("Panel thickness (mm)")).toHaveValue(3);
      expect(pressed()).toEqual([expect.stringMatching(/^3 mm/)]);
    });

    it("shows no preset as selected for a custom thickness", async () => {
      const user = await openDialog("none");
      await user.tripleClick(screen.getByLabelText("Panel thickness (mm)"));
      await user.keyboard("2.5");
      expect(screen.getByLabelText("Panel thickness (mm)")).toHaveValue(2.5);
      expect(screen.queryAllByRole("button", { pressed: true })).toHaveLength(0);
    });
  });

  // What the print will measure at its thickest: panel plus whatever is raised on it
  describe("highest point of the print", () => {
    it("adds the relief height to the panel thickness", async () => {
      const user = await openDialog("relief-topo");
      expect(screen.getByText(/highest point of the print: 3 mm/i)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /^3 mm/ }));
      expect(screen.getByText(/highest point of the print: 4 mm/i)).toBeInTheDocument();
    });

    it("adds the pattern height for bands and raised lines", async () => {
      await openDialog("bands-marble", "waveform");
      expect(screen.getByText(/highest point of the print: 2\.6 mm/i)).toBeInTheDocument();
    });

    it("uses the taller of relief and pattern height on a mixed sheet", async () => {
      await openDialog("bands-marble", "relief-cells");
      expect(screen.getByText(/highest point of the print: 3 mm/i)).toBeInTheDocument();
    });

    it("says nothing when no panel has a raised pattern", async () => {
      await openDialog("none", "none");
      expect(screen.queryByText(/highest point of the print/i)).not.toBeInTheDocument();
    });
  });
});
