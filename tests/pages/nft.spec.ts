// Route: /nft/records — NFT records management page
import { test, expect } from "@playwright/test";
import path from "path";

test.use({ storageState: path.join(process.cwd(), "tests", ".auth", "admin.json") });

// Helper: wait for AppShell auth to complete (Sign Out button visible = sidebar rendered)
async function waitForAppShell(page: any) {
  await page.locator('button').filter({ hasText: /Sign Out/i }).waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
}

test.describe("Presale NFT Records Page", () => {
  test("loads and shows NFT heading", async ({ page }) => {
    // Increase timeout: cold Next.js compilation can take 60-90s on first run
    test.setTimeout(120000);
    await page.goto("/nft/records", { timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await waitForAppShell(page);
    expect(page.url()).not.toContain("/login");

    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 30000 });
    await expect(heading).toContainText(/NFT/i);
  });

  test("table or empty state renders", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/nft/records", { timeout: 90000 });
    await waitForAppShell(page);
    // DataTable shows <table> when data exists, or div.flex-col.h-52 (empty state)
    const content = page.locator('table').or(page.locator('div.flex-col.h-52'));
    await expect(content.first()).toBeVisible({ timeout: 60000 });
  });

  test("search or filter control is present", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/nft/records", { timeout: 90000 });
    await waitForAppShell(page);

    const filterControl = page.locator('input[type="text"], input[placeholder*="Search" i], select').first();
    await expect(filterControl).toBeVisible({ timeout: 30000 });
  });

  test("session is authenticated (no redirect to login)", async ({ page }) => {
    await page.goto("/nft/records");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    expect(page.url()).not.toContain("/login");
  });
});
