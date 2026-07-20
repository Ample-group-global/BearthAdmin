// Route: /orders — Orders management page
import { test, expect } from "@playwright/test";
import path from "path";

test.use({ storageState: path.join(process.cwd(), "tests", ".auth", "admin.json") });

// Helper: wait for AppShell auth to complete (Sign Out button visible = sidebar rendered)
async function waitForAppShell(page: any) {
  await page.locator('button').filter({ hasText: /Sign Out/i }).waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
}

test.describe("Presale Orders Page", () => {
  test("loads and shows heading", async ({ page }) => {
    // Increase timeout: cold Next.js compilation can take 60-90s on first run
    test.setTimeout(120000);
    await page.goto("/orders", { timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await waitForAppShell(page);
    expect(page.url()).not.toContain("/login");

    const heading = page.locator('h1, h2, [class*="heading"], [class*="title"]').first();
    await expect(heading).toBeVisible({ timeout: 30000 });
    await expect(heading).toContainText(/Order/i);
  });

  test("table renders with column headers", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/orders", { timeout: 90000 });
    await waitForAppShell(page);
    // DataTable shows <table> when data exists, or div.flex-col.h-52 (empty state)
    const content = page.locator('table').or(page.locator('div.flex-col.h-52'));
    await expect(content.first()).toBeVisible({ timeout: 60000 });
  });

  test("search field is present and accepts input", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/orders", { timeout: 90000 });
    await waitForAppShell(page);

    const searchInput = page.locator('input[placeholder*="Search" i]').first();
    await expect(searchInput).toBeVisible({ timeout: 30000 });
    await searchInput.fill("test");
    await expect(searchInput).toHaveValue("test");
  });

  test("New Order button is visible", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/orders", { timeout: 90000 });
    await waitForAppShell(page);

    const newBtn = page.locator('button:has-text("New Order")');
    await expect(newBtn).toBeVisible({ timeout: 30000 });
  });

  test("no error banner on load", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/orders", { timeout: 90000 });
    await waitForAppShell(page);
    // Wait for loading to settle
    await page.locator('svg.animate-spin').waitFor({ state: 'detached', timeout: 60000 }).catch(() => {});

    const errorBanner = page.locator('[style*="fef2f2"]:not([style*="none"])').first();
    await expect(errorBanner).not.toBeVisible();
  });
});
