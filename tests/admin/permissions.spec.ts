// Route: /admin/permissions — Permission registry page
import { test, expect } from "@playwright/test";
import path from "path";

test.use({ storageState: path.join(process.cwd(), "tests", ".auth", "admin.json") });

test.describe("Admin Permissions Page", () => {
  test("loads and shows Permission Registry heading", async ({ page }) => {
    await page.goto("/admin/permissions");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    expect(page.url()).not.toContain("/login");

    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 20000 });
    await expect(heading).toContainText(/Permission/i);
  });

  test("permissions list loads", async ({ page }) => {
    await page.goto("/admin/permissions");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    // Wait for loading spinner to clear
    await page.locator('svg.animate-spin').waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
    // Permissions page renders group h3 headers or empty state div with py-10
    const content = page.locator('h3').or(page.locator('div.py-10'));
    await expect(content.first()).toBeVisible({ timeout: 15000 });
  });

  test("session is authenticated (no redirect to login)", async ({ page }) => {
    await page.goto("/admin/permissions");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    expect(page.url()).not.toContain("/login");
  });
});
