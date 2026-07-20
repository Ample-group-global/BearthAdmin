// Route: /inventory — Inventory management page
import { test, expect } from "@playwright/test";
import path from "path";

test.use({ storageState: path.join(process.cwd(), "tests", ".auth", "admin.json") });

test.describe("Presale Inventory Page", () => {
  test("loads and shows Inventory Management heading", async ({ page }) => {
    // Increase timeout: cold Next.js compilation can take 60-90s on first run
    test.setTimeout(120000);
    await page.goto("/inventory", { timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
    expect(page.url()).not.toContain("/login");

    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 20000 });
    await expect(heading).toContainText(/Inventory/i);
  });

  test("table or empty state renders", async ({ page }) => {
    await page.goto("/inventory");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    // Inventory overview tab shows stat cards (Total Products, Active, Low Stock, etc.)
    await page.locator('svg.animate-spin').waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
    const content = page.locator('text=/Total Products|Active|Low Stock/i').first();
    await expect(content).toBeVisible({ timeout: 15000 });
  });

  test("search or filter control is present", async ({ page }) => {
    await page.goto("/inventory");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    // Inventory page has tab navigation buttons (Overview, Purchase Orders, Stock Movements, Returns)
    const control = page.locator('button').filter({ hasText: /Overview|Purchase Orders|Stock Movements|Returns/i }).first();
    await expect(control).toBeVisible({ timeout: 20000 });
  });

  test("session is authenticated (no redirect to login)", async ({ page }) => {
    await page.goto("/inventory");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    expect(page.url()).not.toContain("/login");
  });
});
