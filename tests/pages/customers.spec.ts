// Route: /customers — Customer management page
import { test, expect } from "@playwright/test";
import path from "path";

test.use({ storageState: path.join(process.cwd(), "tests", ".auth", "admin.json") });

test.describe("Presale Customers Page", () => {
  test("loads and shows heading", async ({ page }) => {
    await page.goto("/customers");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    expect(page.url()).not.toContain("/login");

    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 20000 });
    await expect(heading).toContainText(/Customer/i);
  });

  test("table or empty state renders", async ({ page }) => {
    await page.goto("/customers");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    // Wait for DataTable loading spinner to clear
    await page.locator('svg.animate-spin').waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
    // DataTable shows <table> when data exists, or div.flex-col.h-52 (empty state)
    const content = page.locator('table').or(page.locator('div.flex-col.h-52'));
    await expect(content.first()).toBeVisible({ timeout: 15000 });
  });

  test("search field accepts input", async ({ page }) => {
    await page.goto("/customers");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});

    const searchInput = page.locator('input[placeholder*="Search" i]').first();
    await expect(searchInput).toBeVisible({ timeout: 20000 });
    await searchInput.fill("test");
    await expect(searchInput).toHaveValue("test");
  });

  test("New Customer button is visible", async ({ page }) => {
    await page.goto("/customers");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});

    const newBtn = page.locator('button:has-text("New Customer")');
    await expect(newBtn).toBeVisible({ timeout: 20000 });
  });
});
