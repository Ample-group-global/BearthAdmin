// Route: /orders — Orders management page (main landing after login)
import { test, expect } from "@playwright/test";
import path from "path";

test.use({ storageState: path.join(process.cwd(), "tests", ".auth", "admin.json") });

async function waitForAppShell(page: any) {
  await page.locator('button').filter({ hasText: /Sign Out/i }).waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
}

test.describe("Orders Page (main landing)", () => {
  test("loads and shows overview heading or error state", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/orders", { timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await waitForAppShell(page);
    expect(page.url()).not.toContain("/login");
    const content = page.locator('h1').or(
      page.locator('div[style*="dc2626"]').or(page.locator('div[style*="fef2f2"]'))
    ).first();
    await expect(content).toBeVisible({ timeout: 30000 });
  });

  test("page renders meaningful content (table or empty state)", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/orders", { timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await waitForAppShell(page);
    const content = page.locator('text=/Order|New Order|Search/i').first();
    await expect(content).toBeVisible({ timeout: 30000 });
  });

  test("orders table or empty state is visible", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/orders", { timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await waitForAppShell(page);
    const content = page.locator('table').or(page.locator('div.flex-col.h-52')).or(
      page.locator('text=/New Order/i')
    ).first();
    await expect(content).toBeVisible({ timeout: 30000 });
  });

  test("session is authenticated (no redirect to login)", async ({ page }) => {
    await page.goto("/orders");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    expect(page.url()).not.toContain("/login");
  });
});
