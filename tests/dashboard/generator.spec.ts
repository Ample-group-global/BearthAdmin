// Route: /dashboard/generator — NFT Generator page
import { test, expect } from "@playwright/test";
import path from "path";

test.use({ storageState: path.join(process.cwd(), "tests", ".auth", "tech.json") });

// Helper: wait for AppShell auth to complete (Sign Out button visible = sidebar rendered)
async function waitForAppShell(page: any) {
  await page.locator('text=Verifying access').waitFor({ state: 'detached', timeout: 60000 }).catch(() => {});
  await page.locator('button').filter({ hasText: /Sign Out/i }).waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
}

test.describe("Dashboard NFT Generator Page", () => {
  test("loads generator page without redirecting to login", async ({ page }) => {
    // Increase timeout: cold Next.js compilation can take 60-90s on first run
    test.setTimeout(120000);
    await page.goto("/dashboard/generator", { timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await waitForAppShell(page);
    expect(page.url()).not.toContain("/login");
  });

  test("step navigation is visible", async ({ page }) => {
    await page.goto("/dashboard/generator");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await waitForAppShell(page);

    // StepNav renders buttons: Settings, Organize, Preview, Export, Rarity
    const stepBtn = page.locator('text=/Settings|Organize|Preview|Export|Rarity/i').first();
    await expect(stepBtn).toBeVisible({ timeout: 20000 });
  });

  test("collection setup form is present", async ({ page }) => {
    await page.goto("/dashboard/generator");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await waitForAppShell(page);

    // CollectionSetup renders a div.setup-section-head with "Collection Settings"
    const setupSection = page.locator('.setup-section-head').first();
    await expect(setupSection).toBeVisible({ timeout: 20000 });
  });

  test("session is authenticated (no redirect to login)", async ({ page }) => {
    await page.goto("/dashboard/generator");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    expect(page.url()).not.toContain("/login");
  });
});
