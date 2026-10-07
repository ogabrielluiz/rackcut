import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { boundsOf, readTriangles, unzipStored } from "../src/lib/renderers/stl-test-utils";

test.describe("3D print surfaces", () => {
  async function addPanel(page: import("@playwright/test").Page, pattern: string, hp: number) {
    await page.getByLabel("Default pattern").selectOption(pattern);
    await page.getByLabel(/^HP$/i).fill(String(hp));
    await page.getByRole("button", { name: /^add$/i }).click();
  }

  const modeSelect = (page: import("@playwright/test").Page) =>
    page.locator("select").filter({ has: page.locator('option[value="3d-print"]') });

  test("relief panel: print preview, settings and STL download", async ({ page }) => {
    await page.goto("/");
    await addPanel(page, "relief-damascus", 2);
    await modeSelect(page).selectOption("3d-print");

    // The sheet shows the relief as it prints, not as engrave strokes
    const image = page.locator("svg.max-w-full image");
    await expect(image).toBeVisible();
    expect(await image.getAttribute("href")).toMatch(/^data:image\/bmp;base64,/);
    await expect(page.locator("svg.max-w-full polyline")).toHaveCount(0);

    await page.getByRole("button", { name: "Download STL" }).click();
    await expect(page.getByLabel("Relief height (mm)")).toHaveValue("1");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /generate & download zip/i }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("rackcut-panels.zip");
  });

  test("bands panel: accent filament appears only when bands are on the sheet", async ({ page }) => {
    await page.goto("/");
    await addPanel(page, "waveform", 4);
    await modeSelect(page).selectOption("3d-print");
    await expect(page.getByLabel("Bands:")).toHaveCount(0);

    await addPanel(page, "bands-marble", 4);
    await expect(page.getByLabel("Bands:")).toBeVisible();
    await expect(page.locator("svg.max-w-full image")).toHaveCount(1);

    await page.getByRole("button", { name: "Download STL" }).click();
    await expect(page.getByText(/switch filament at the first layer above 2 mm/i)).toBeVisible();
  });

  /** Height of the tallest point of the first STL in a downloaded ZIP, in mm */
  async function downloadedHeight(page: import("@playwright/test").Page) {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /generate & download zip/i }).click(),
    ]);
    const zip = new Blob([await readFile(await download.path())]);
    const [stl] = [...(await unzipStored(zip)).values()];
    return boundsOf(readTriangles(stl)).max[2];
  }

  test("a plain panel downloads 2 mm thick by default, the Eurorack standard", async ({ page }) => {
    await page.goto("/");
    await addPanel(page, "none", 4);
    await modeSelect(page).selectOption("3d-print");
    await page.getByRole("button", { name: "Download STL" }).click();
    expect(await downloadedHeight(page)).toBeCloseTo(2, 5);
  });

  test("a thickness preset is what gets exported", async ({ page }) => {
    await page.goto("/");
    await addPanel(page, "none", 4);
    await modeSelect(page).selectOption("3d-print");
    await page.getByRole("button", { name: "Download STL" }).click();
    await page.getByRole("button", { name: /^1\.6 mm/ }).click();
    expect(await downloadedHeight(page)).toBeCloseTo(1.6, 5);
  });

  test("the same pattern engraves as outlines in laser mode", async ({ page }) => {
    await page.goto("/");
    await addPanel(page, "bands-cells", 4);
    await expect(page.locator("svg.max-w-full image")).toHaveCount(0);
    expect(await page.locator("svg.max-w-full polyline").count()).toBeGreaterThan(3);
  });
});
