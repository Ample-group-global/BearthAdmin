// Route: /fulfillment — Order fulfillment tracking page
import { test, expect } from "@playwright/test";
import path from "path";

test.use({ storageState: path.join(process.cwd(), "tests", ".auth", "admin.json") });

test.describe("Presale Fulfillment Page", () => {
  test("loads and shows heading", async ({ page }) => {
    // Increase timeout: cold Next.js compilation can take 60-90s on first run
    test.setTimeout(120000);
    await page.goto("/fulfillment", { timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
    expect(page.url()).not.toContain("/login");

    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 20000 });
    await expect(heading).toContainText(/Fulfillment/i);
  });

  test("table or empty state renders", async ({ page }) => {
    await page.goto("/fulfillment");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    // Wait for DataTable loading spinner to clear
    await page.locator('svg.animate-spin').waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
    // Table when data exists; fulfillment empty state is a p element with "No fulfillment"
    const content = page.locator('table').or(
      page.locator('p').filter({ hasText: /No fulfillment/i })
    );
    await expect(content.first()).toBeVisible({ timeout: 15000 });
  });

  test("search or filter control is present", async ({ page }) => {
    await page.goto("/fulfillment");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});

    const control = page.locator('input[type="text"], input[placeholder*="Search" i], select').first();
    await expect(control).toBeVisible({ timeout: 20000 });
  });

  test("session is authenticated (no redirect to login)", async ({ page }) => {
    await page.goto("/fulfillment");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    expect(page.url()).not.toContain("/login");
  });
});
