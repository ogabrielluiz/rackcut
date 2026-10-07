import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import App from "./App";

/** Open the app again, as a page reload would: a new App over the same browser storage */
function reload(unmount: () => void) {
  unmount();
  return render(<App />);
}

async function addPanel(user: ReturnType<typeof userEvent.setup>, pattern: string, hp: number) {
  await user.selectOptions(screen.getByLabelText("Default pattern"), pattern);
  // Each row of the panel list has its own "HP" field; the add form's comes first
  const hpInput = screen.getAllByLabelText("HP")[0];
  await user.clear(hpInput);
  await user.type(hpInput, String(hp));
  await user.click(screen.getByRole("button", { name: /^add$/i }));
}

test("the panels on the sheet are still there after a reload", async () => {
  const user = userEvent.setup();
  const { unmount } = render(<App />);
  await addPanel(user, "relief-damascus", 4);
  await addPanel(user, "waveform", 12);
  const seedsBefore = screen.getAllByTitle(/^Pattern seed/).map((input) => (input as HTMLInputElement).value);

  reload(unmount);

  expect(screen.getAllByLabelText(/^HP for /i).map((input) => (input as HTMLInputElement).value)).toEqual(["4", "12"]);
  expect(screen.getAllByLabelText(/^Pattern for /i).map((select) => (select as HTMLSelectElement).value)).toEqual([
    "relief-damascus",
    "waveform",
  ]);
  // Same seeds, so the same art
  expect(screen.getAllByTitle(/^Pattern seed/).map((input) => (input as HTMLInputElement).value)).toEqual(seedsBefore);
  expect(screen.queryByText("Add panels to preview your cut sheet")).not.toBeInTheDocument();
});

test("edits made in the panel list are remembered", async () => {
  const user = userEvent.setup();
  const { unmount } = render(<App />);
  await addPanel(user, "none", 8);
  await user.click(screen.getByRole("button", { name: /^Increase quantity/ }));
  await user.selectOptions(screen.getByLabelText(/^Pattern for /i), "bands-cells");

  reload(unmount);

  expect(screen.getByLabelText(/^Pattern for /i)).toHaveValue("bands-cells");
  expect(screen.getByText(/1 panel, 2 total on sheet/)).toBeInTheDocument();
});

test("the output mode and default pattern come back too", async () => {
  const user = userEvent.setup();
  const { unmount } = render(<App />);
  await addPanel(user, "bands-marble", 4);
  await user.selectOptions(screen.getByDisplayValue("Laser Cut (SVG)"), "3d-print");

  reload(unmount);

  expect(screen.getByDisplayValue("3D Print (STL)")).toBeInTheDocument();
  expect(screen.getByLabelText("Default pattern")).toHaveValue("bands-marble");
  expect(screen.getByRole("button", { name: "Download STL" })).toBeInTheDocument();
});

test("a cleared sheet stays cleared", async () => {
  const user = userEvent.setup();
  const { unmount } = render(<App />);
  await addPanel(user, "waveform", 6);
  await user.click(screen.getByRole("button", { name: "Clear all panels" }));

  reload(unmount);

  expect(screen.getByText("Add panels to preview your cut sheet")).toBeInTheDocument();
  expect(screen.queryAllByLabelText(/^HP for /i)).toHaveLength(0);
});
