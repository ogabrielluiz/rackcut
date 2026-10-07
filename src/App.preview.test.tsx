import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import App from "./App";

// The 3D tab builds a mesh with manifold-3d and draws it with WebGL, neither of
// which runs in jsdom. Stand in for the two mesh builders and check what the
// app asks them for: the preview has to show the panel a default export gives.
const emptyStl = () => Promise.resolve(new ArrayBuffer(84));
const generatePanelStl = vi.fn(emptyStl);
const generateSurfacePanelStl = vi.fn(emptyStl);

vi.mock("@/lib/renderers/stl-renderer", () => ({
  generatePanelStl: (...args: unknown[]) => generatePanelStl(...(args as [])),
  generateAllPanelsStlZip: vi.fn(),
}));
vi.mock("@/lib/renderers/surface-stl-renderer", () => ({
  generateSurfacePanelStl: (...args: unknown[]) => generateSurfacePanelStl(...(args as [])),
}));
// The viewer itself needs a WebGL canvas; what it is given is not the subject here.
vi.mock("@/components/StlViewer", () => ({ default: () => null }));

beforeEach(() => {
  generatePanelStl.mockClear();
  generateSurfacePanelStl.mockClear();
});

async function previewIn3d(pattern: string, mode: "laser-cut" | "3d-print") {
  const user = userEvent.setup();
  render(<App />);
  await user.selectOptions(screen.getByLabelText("Default pattern"), pattern);
  await user.click(screen.getByRole("button", { name: /^add$/i }));
  await user.selectOptions(screen.getByDisplayValue("Laser Cut (SVG)"), mode);
  await user.click(screen.getByRole("button", { name: "3D Panel" }));
}

/** [thickness, pattern height] the app asked a mesh builder for */
const lastCall = (mock: typeof generatePanelStl) => (mock.mock.lastCall as unknown as unknown[]).slice(1, 3);

test("a printed line pattern is previewed at the standard 2 mm panel with 0.6 mm lines", async () => {
  await previewIn3d("waveform", "3d-print");
  await waitFor(() => expect(generatePanelStl).toHaveBeenCalled());
  expect(lastCall(generatePanelStl)).toEqual([2, 0.6]);
  expect((generatePanelStl.mock.lastCall as unknown as unknown[])[4]).toBe("extrude");
});

test("printed relief is previewed at the standard 2 mm panel with 1 mm of relief", async () => {
  await previewIn3d("relief-damascus", "3d-print");
  await waitFor(() => expect(generateSurfacePanelStl).toHaveBeenCalled());
  expect(lastCall(generateSurfacePanelStl)).toEqual([2, 1]);
});

test("printed bands are previewed at the standard 2 mm panel with 0.6 mm bands", async () => {
  await previewIn3d("bands-marble", "3d-print");
  await waitFor(() => expect(generateSurfacePanelStl).toHaveBeenCalled());
  expect(lastCall(generateSurfacePanelStl)).toEqual([2, 0.6]);
});

test("a laser-cut panel is still previewed as 3 mm sheet with a 0.5 mm engraving", async () => {
  await previewIn3d("waveform", "laser-cut");
  await waitFor(() => expect(generatePanelStl).toHaveBeenCalled());
  expect(lastCall(generatePanelStl)).toEqual([3, 0.5]);
  expect((generatePanelStl.mock.lastCall as unknown as unknown[])[4]).toBe("recess");
});
