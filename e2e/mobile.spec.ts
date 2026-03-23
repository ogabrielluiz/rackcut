import { test, expect, devices } from "@playwright/test";

const iPhone = devices["iPhone 14"];
test.use({ ...iPhone });

test.describe("mobile (iPhone 14)", () => {

  test("no horizontal scroll on load", async ({ page }) => {
    await page.goto("/");
    const body = page.locator("body");
    const scrollWidth = await body.evaluate((el) => el.scrollWidth);
    const clientWidth = await body.evaluate((el) => el.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  test("no horizontal scroll with panels added", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel(/^HP$/i).fill("8");
    await page.getByRole("button", { name: /^add$/i }).click();

    // Wait for panel to appear
    await expect(page.getByLabel(/^HP for /i).first()).toBeVisible();

    const body = page.locator("body");
    const scrollWidth = await body.evaluate((el) => el.scrollWidth);
    const clientWidth = await body.evaluate((el) => el.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  test("can add and remove panels", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel(/^HP$/i).fill("12");
    await page.getByRole("button", { name: /^add$/i }).click();

    // Panel appears
    await expect(page.getByLabel(/^HP for /i).first()).toBeVisible();

    // Remove it
    await page.getByRole("button", { name: /remove/i }).click();
    await expect(page.getByText(/add panels to preview/i)).toBeVisible();
  });

  test("all sections are visible", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("1. Add Panels")).toBeVisible();
    await expect(page.getByText("2. Configure")).toBeVisible();
    await expect(page.getByText("3. Your Panels")).toBeVisible();
    await expect(page.getByText(/4\. Preview/)).toBeVisible();
  });

  test("can change pattern on a panel", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: /^add$/i }).click();

    // Pattern dropdown should be visible
    const patternSelect = page.getByLabel(/^Pattern for /i).first();
    await expect(patternSelect).toBeVisible();

    await patternSelect.selectOption("spirograph");
    await expect(patternSelect).toHaveValue("spirograph");
  });

  test("download button is tappable", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: /^add$/i }).click();

    const downloadButton = page.getByRole("button", { name: /download/i });
    await expect(downloadButton).toBeVisible();
    await expect(downloadButton).toBeEnabled();

    // Verify it's large enough to tap (at least 36px)
    const box = await downloadButton.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThanOrEqual(36);
  });

  test("panel list buttons are tappable size", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: /^add$/i }).click();

    // Check duplicate button has a reasonable tap target
    const dupButton = page.getByRole("button", { name: /duplicate/i }).first();
    await expect(dupButton).toBeVisible();
    const box = await dupButton.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThanOrEqual(28);
    expect(box!.width).toBeGreaterThanOrEqual(28);
  });

  test("preview section shows material dropdown", async ({ page }) => {
    await page.goto("/");
    const materialSelect = page.locator("#material");
    await expect(materialSelect).toBeVisible();
  });
});
