// Route: /nft/waves — NFT waves management page (presale context)
import { test, expect } from "@playwright/test";
import path from "path";

test.use({ storageState: path.join(process.cwd(), "tests", ".auth", "admin.json") });

// Helper: wait for AppShell auth to complete (Sign Out button visible = sidebar rendered)
async function waitForAppShell(page: any) {
  await page.locator('button').filter({ hasText: /Sign Out/i }).waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
}

test.describe("Presale NFT Waves Page", () => {
  test("loads and shows NFT Sell heading", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/nft/waves", { timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await waitForAppShell(page);
    expect(page.url()).not.toContain("/login");

    // Page heading is "NFT Sell"
    const heading = page.locator('h1, h2, h3').first();
    await expect(heading).toBeVisible({ timeout: 30000 });
    await expect(heading).toContainText(/NFT|Wave|Sell/i);
  });

  test("wave list or content area is visible", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/nft/waves", { timeout: 90000 });
    await waitForAppShell(page);

    // Look for table or any wave-related content
    const content = page.locator('table').or(
      page.locator('h1, h2, h3').filter({ hasText: /Wave/i })
    ).first();
    await expect(content).toBeVisible({ timeout: 60000 });
  });

  test("session is authenticated (no redirect to login)", async ({ page }) => {
    await page.goto("/nft/waves");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    expect(page.url()).not.toContain("/login");
  });
});
