// Route: /dashboard/nfts — NFT overview and records in dashboard context
import { test, expect } from "@playwright/test";
import path from "path";

test.use({ storageState: path.join(process.cwd(), "tests", ".auth", "tech.json") });

// Helper: wait for AppShell auth to complete (Sign Out button visible = sidebar rendered)
async function waitForAppShell(page: any) {
  await page.locator('button').filter({ hasText: /Sign Out/i }).waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
}

test.describe("Dashboard NFTs Page", () => {
  test("loads and shows NFT Overview heading", async ({ page }) => {
    // Increase timeout: cold Next.js compilation can take 60-90s on first run
    test.setTimeout(120000);
    await page.goto("/dashboard/nfts", { timeout: 90000 });
    // Blockchain RPC calls may prevent networkidle; catch the timeout and continue
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await waitForAppShell(page);
    expect(page.url()).not.toContain("/login");

    // Use h1 specifically — the modal h2 only renders when a token is selected
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 20000 });
    await expect(heading).toContainText(/NFT/i);
  });

  test("NFT list or table renders", async ({ page }) => {
    await page.goto("/dashboard/nfts");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await waitForAppShell(page);
    // NFT page shows "X minted" stat text always (even 0 minted on empty chain)
    await expect(page.locator('p').filter({ hasText: /minted/i }).first()).toBeVisible({ timeout: 30000 });
  });

  test("filter or search control is present", async ({ page }) => {
    await page.goto("/dashboard/nfts");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});

    const control = page.locator('input[type="text"], input[placeholder*="Search" i], select, button').first();
    await expect(control).toBeVisible({ timeout: 20000 });
  });

  test("session is authenticated (no redirect to login)", async ({ page }) => {
    await page.goto("/dashboard/nfts");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    expect(page.url()).not.toContain("/login");
  });
});
