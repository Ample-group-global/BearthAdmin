// Route: /products — Products management page
import { test, expect } from "@playwright/test";
import path from "path";

test.use({ storageState: path.join(process.cwd(), "tests", ".auth", "admin.json") });

// Helper: wait for AppShell auth to complete (Sign Out button visible = sidebar rendered)
async function waitForAppShell(page: any) {
  await page.locator('button').filter({ hasText: /Sign Out/i }).waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
}

test.describe("Presale Products Page", () => {
  test("loads and shows heading", async ({ page }) => {
    // Increase timeout: cold Next.js compilation can take 60-90s on first run
    test.setTimeout(120000);
    await page.goto("/products", { timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await waitForAppShell(page);
    expect(page.url()).not.toContain("/login");

    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 30000 });
    await expect(heading).toContainText(/Product/i);
  });

  test("summary stat cards are visible", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/products", { timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await waitForAppShell(page);

    // StatCards render with labels: Total Products, Active, Low Stock, Out of Stock
    const statsArea = page.locator('text=/Total Products|Active|Low Stock|Out of Stock/i').first();
    await expect(statsArea).toBeVisible({ timeout: 30000 });
  });

  test("search field accepts input", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/products", { timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await waitForAppShell(page);

    const searchInput = page.locator('input[placeholder*="Search" i]').first();
    await expect(searchInput).toBeVisible({ timeout: 30000 });
    await searchInput.fill("bearth");
    await expect(searchInput).toHaveValue("bearth");
  });

  test("Add Product button is visible", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/products", { timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await waitForAppShell(page);

    const addBtn = page.locator('button:has-text("Add Product")');
    await expect(addBtn).toBeVisible({ timeout: 30000 });
  });

  test("table or empty state renders", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/products", { timeout: 90000 });
    await waitForAppShell(page);
    // DataTable shows <table> when data exists, or div.flex-col.h-52 (empty state)
    const content = page.locator('table').or(page.locator('div.flex-col.h-52'));
    await expect(content.first()).toBeVisible({ timeout: 60000 });
  });
});
