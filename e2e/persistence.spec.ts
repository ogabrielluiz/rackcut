import { test, expect } from "@playwright/test";

test.describe("saved workspace", () => {
  async function addPanel(page: import("@playwright/test").Page, pattern: string, hp: number) {
    await page.getByLabel("Default pattern").selectOption(pattern);
    await page.getByLabel(/^HP$/i).fill(String(hp));
    await page.getByRole("button", { name: /^add$/i }).click();
  }

  test("panels, patterns and mode are still there after reloading the page", async ({ page }) => {
    await page.goto("/");
    await addPanel(page, "relief-damascus", 4);
    await addPanel(page, "bands-marble", 8);
    await page.locator("select").filter({ has: page.locator('option[value="3d-print"]') }).selectOption("3d-print");
    const seeds = await page.getByTitle(/^Pattern seed/).evaluateAll((inputs) => inputs.map((i) => (i as HTMLInputElement).value));

    await page.reload();

    await expect(page.getByLabel(/^HP for /i)).toHaveCount(2);
    await expect(page.getByLabel(/^Pattern for /i).nth(0)).toHaveValue("relief-damascus");
    await expect(page.getByLabel(/^Pattern for /i).nth(1)).toHaveValue("bands-marble");
    expect(await page.getByTitle(/^Pattern seed/).evaluateAll((inputs) => inputs.map((i) => (i as HTMLInputElement).value))).toEqual(seeds);
    // still in print mode, drawing both panels as they print
    await expect(page.getByRole("button", { name: "Download STL" })).toBeVisible();
    await expect(page.locator("svg.max-w-full image")).toHaveCount(2);
  });

  test("a cleared sheet stays cleared after reloading", async ({ page }) => {
    await page.goto("/");
    await addPanel(page, "waveform", 6);
    await expect(page.getByLabel(/^HP for /i)).toHaveCount(1);
    await page.getByRole("button", { name: "Clear all panels" }).click();

    await page.reload();

    await expect(page.getByText(/add panels to preview/i)).toBeVisible();
    await expect(page.getByLabel(/^HP for /i)).toHaveCount(0);
  });

  test("a damaged saved workspace does not break the page", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem(
        "rackcut:workspace",
        JSON.stringify({
          version: 1,
          panels: [
            { id: "x", hp: 4, format: "3u", holeStyle: "slot", quantity: 9999999, pattern: "gone", patternSeed: 1 },
            { id: "y", hp: -3, format: "3u" },
            "junk",
          ],
          gap: "wide",
          outputMode: "cnc",
        })
      );
    });

    await page.reload();

    // The one usable panel is kept, capped and without its unknown pattern
    await expect(page.getByLabel(/^HP for /i)).toHaveCount(1);
    await expect(page.getByLabel(/^Pattern for /i)).toHaveValue("none");
    await expect(page.getByText(/1 panel, 100 total on sheet/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Download SVG" })).toBeEnabled();
  });
});
