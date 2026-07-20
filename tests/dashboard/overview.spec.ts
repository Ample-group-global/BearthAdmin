// Route: /dashboard — Main dashboard overview page
import { test, expect } from "@playwright/test";
import path from "path";

test.use({ storageState: path.join(process.cwd(), "tests", ".auth", "tech.json") });

// Helper: wait for AppShell auth to complete (Sign Out button visible = sidebar rendered)
async function waitForAppShell(page: any) {
  await page.locator('button').filter({ hasText: /Sign Out/i }).waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
}

test.describe("Dashboard Overview Page", () => {
  test("loads and shows Overview heading", async ({ page }) => {
    // Increase timeout: cold Next.js compilation can take 60-90s on first run
    test.setTimeout(120000);
    await page.goto("/dashboard", { timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await waitForAppShell(page);
    expect(page.url()).not.toContain("/login");

    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 20000 });
    await expect(heading).toContainText(/Overview/i);
  });

  test("Quick Actions section is visible", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await waitForAppShell(page);

    // "Quick Actions" is an h2 — always rendered regardless of contract data
    const quickActions = page.locator('h2').filter({ hasText: /Quick Actions/i }).first();
    await expect(quickActions).toBeVisible({ timeout: 20000 });
  });

  test("page renders main content (not blank)", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});

    const contentEl = page.locator('a, button, [class*="card"]').first();
    await expect(contentEl).toBeVisible({ timeout: 20000 });
  });

  test("session is authenticated (no redirect to login)", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    expect(page.url()).not.toContain("/login");
  });
});
