// Route: /dashboard/whitelist — Whitelist management page
import { test, expect } from "@playwright/test";
import path from "path";

test.use({ storageState: path.join(process.cwd(), "tests", ".auth", "tech.json") });

// Helper: wait for AppShell auth to complete (Sign Out button visible = sidebar rendered)
async function waitForAppShell(page: any) {
  await page.locator('button').filter({ hasText: /Sign Out/i }).waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
}

test.describe("Dashboard Whitelist Page", () => {
  test("loads and shows Whitelist Management heading", async ({ page }) => {
    // Increase timeout: cold Next.js compilation can take 60-90s on first run
    test.setTimeout(120000);
    await page.goto("/dashboard/whitelist", { timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await waitForAppShell(page);
    expect(page.url()).not.toContain("/login");

    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 20000 });
    await expect(heading).toContainText(/Whitelist/i);
  });

  test("whitelist content area loads", async ({ page }) => {
    await page.goto("/dashboard/whitelist");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await waitForAppShell(page);
    // Whitelist page always shows stat cards (Total Addresses, Merkle Root, etc.)
    const content = page.locator('text=/Total Addresses/i').first();
    await expect(content).toBeVisible({ timeout: 20000 });
  });

  test("search or add control is present", async ({ page }) => {
    await page.goto("/dashboard/whitelist");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await waitForAppShell(page);
    // Whitelist page has tab bar buttons (All Addresses, Add Single, Bulk Import, etc.)
    const control = page.locator('button').filter({ hasText: /All Addresses|Add Single|Bulk Import/i }).first();
    await expect(control).toBeVisible({ timeout: 20000 });
  });

  test("session is authenticated (no redirect to login)", async ({ page }) => {
    await page.goto("/dashboard/whitelist");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    expect(page.url()).not.toContain("/login");
  });
});
