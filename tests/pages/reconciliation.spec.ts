// Route: /reconciliation — Reconciliation entries page
import { test, expect } from "@playwright/test";
import path from "path";

test.use({ storageState: path.join(process.cwd(), "tests", ".auth", "admin.json") });

// Helper: wait for AppShell auth to complete (Sign Out button visible = sidebar rendered)
async function waitForAppShell(page: any) {
  await page.locator('text=Verifying access').waitFor({ state: 'detached', timeout: 60000 }).catch(() => {});
  await page.locator('button').filter({ hasText: /Sign Out/i }).waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
}

test.describe("Presale Reconciliation Page", () => {
  test("loads and shows heading", async ({ page }) => {
    // Increase timeout: cold Next.js compilation can take 60-90s on first run
    test.setTimeout(120000);
    await page.goto("/reconciliation", { timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await waitForAppShell(page);
    expect(page.url()).not.toContain("/login");

    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 30000 });
    await expect(heading).toContainText(/Reconciliation/i);
  });

  test("content area loads (table or empty state)", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/reconciliation", { timeout: 90000 });
    await waitForAppShell(page);
    // Wait for loading spinner to clear
    await page.locator('svg.animate-spin').waitFor({ state: 'detached', timeout: 60000 }).catch(() => {});
    // Custom table: shows <table> when data exists, or h-48 div with "No reconciliation entries found"
    const content = page.locator('table').or(page.locator('p').filter({ hasText: /No reconciliation/i }));
    await expect(content.first()).toBeVisible({ timeout: 30000 });
  });

  test("session is authenticated (no redirect to login)", async ({ page }) => {
    await page.goto("/reconciliation");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    expect(page.url()).not.toContain("/login");
  });
});
