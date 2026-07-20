// Route: /settings/payment-methods — Settings / Payment Methods page
import { test, expect } from "@playwright/test";
import path from "path";

test.use({ storageState: path.join(process.cwd(), "tests", ".auth", "admin.json") });

// Helper: wait for AppShell auth to complete (Sign Out button visible = sidebar rendered)
async function waitForAppShell(page: any) {
  await page.locator('button').filter({ hasText: /Sign Out/i }).waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
}

test.describe("Presale Settings Page", () => {
  test("loads without redirecting to login", async ({ page }) => {
    await page.goto("/settings/payment-methods");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    expect(page.url()).not.toContain("/login");
  });

  test("shows Payment Methods heading", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/settings/payment-methods", { timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await waitForAppShell(page);

    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 30000 });
    await expect(heading).toContainText(/Payment|Settings/i);
  });

  test("payment method list or form is visible", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/settings/payment-methods", { timeout: 90000 });
    await waitForAppShell(page);

    // Look for table, form, or "Payment Method" heading text
    const content = page.locator('table').or(
      page.locator('form').or(
        page.locator('h1, h2, h3').filter({ hasText: /Payment Method/i })
      )
    ).first();
    await expect(content).toBeVisible({ timeout: 30000 });
  });
});
