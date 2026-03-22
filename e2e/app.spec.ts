import { test, expect } from "@playwright/test";

test.describe("rackcut", () => {
  test("shows empty state on load", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("rackcut")).toBeVisible();
    await expect(page.getByText(/add panels to preview/i)).toBeVisible();
  });

  test("full workflow: add panels, preview, download", async ({ page }) => {
    await page.goto("/");

    // Add an 8HP 3U panel
    await page.getByLabel(/^HP$/i).fill("8");
    await page.getByRole("button", { name: /^add$/i }).click();

    // Panel appears in list
    await expect(page.getByText("8HP", { exact: true })).toBeVisible();

    // SVG preview appears
    await expect(page.locator("svg")).toBeVisible();
    await expect(page.getByText(/add panels to preview/i)).not.toBeVisible();

    // Download button appears (enabled)
    const downloadButton = page.getByRole("button", { name: /download/i });
    await expect(downloadButton).toBeVisible();
    await expect(downloadButton).toBeEnabled();

    // Trigger download and verify filename
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      downloadButton.click(),
    ]);
    expect(download.suggestedFilename()).toBe("rackcut.svg");
  });

  test("add and remove panels", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel(/^HP$/i).fill("10");
    await page.getByRole("button", { name: /^add$/i }).click();

    await expect(page.getByText("10HP", { exact: true })).toBeVisible();

    // Remove
    await page.getByRole("button", { name: /remove/i }).click();
    await expect(page.getByText(/add panels to preview/i)).toBeVisible();
  });

  test("quantity adjustment", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel(/^HP$/i).fill("8");
    await page.getByRole("button", { name: /^add$/i }).click();

    await expect(page.getByText(/×1/)).toBeVisible();

    await page.getByRole("button", { name: /increase/i }).click();
    await expect(page.getByText(/×2/)).toBeVisible();

    await page.getByRole("button", { name: /decrease/i }).click();
    await expect(page.getByText(/×1/)).toBeVisible();
  });
});
