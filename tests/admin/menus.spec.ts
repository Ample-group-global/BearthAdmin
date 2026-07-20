// Route: /admin/menus — Menu registry page
import { test, expect } from "@playwright/test";
import path from "path";

test.use({ storageState: path.join(process.cwd(), "tests", ".auth", "admin.json") });

test.describe("Admin Menus Page", () => {
  test("loads and shows Menu Registry heading", async ({ page }) => {
    await page.goto("/admin/menus");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    expect(page.url()).not.toContain("/login");

    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 20000 });
    await expect(heading).toContainText(/Menu/i);
  });

  test("menu structure or list is visible", async ({ page }) => {
    await page.goto("/admin/menus");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    // Wait for loading spinner to clear
    await page.locator('svg.animate-spin').waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
    // Menus page renders h3 module labels (Presale Management, Technical Dashboard, etc.)
    const content = page.locator('h3').or(page.locator('div.space-y-4'));
    await expect(content.first()).toBeVisible({ timeout: 15000 });
  });

  test("session is authenticated (no redirect to login)", async ({ page }) => {
    await page.goto("/admin/menus");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    expect(page.url()).not.toContain("/login");
  });
});
