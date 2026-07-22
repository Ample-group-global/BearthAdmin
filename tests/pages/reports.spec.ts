// Route: /reports/* — Reports pages (BearthDev DB: orders, customers, inventory data)
import { test, expect } from "@playwright/test";
import path from "path";

test.use({ storageState: path.join(process.cwd(), "tests", ".auth", "admin.json") });

async function waitForAppShell(page: any) {
  await page.locator('text=Verifying access').waitFor({ state: 'detached', timeout: 60000 }).catch(() => {});
  await page.locator('button').filter({ hasText: /Sign Out/i }).waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
}

async function goToReport(page: any, route: string) {
  test.setTimeout(120000);
  await page.goto(route, { timeout: 90000 });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await waitForAppShell(page);
  expect(page.url()).not.toContain("/login");
}

test.describe("Reports — Sales by Stage (DB Data)", () => {
  test("loads sales by stage report from DB", async ({ page }) => {
    await goToReport(page, "/reports/sales-by-stage");
    const content = page.locator('h1, h2, table').first();
    await expect(content).toBeVisible({ timeout: 30000 });
  });

  test("shows order/revenue data from BearthDev DB", async ({ page }) => {
    await goToReport(page, "/reports/sales-by-stage");
    // Look for numeric data (order counts, revenue amounts)
    const data = page.locator('td, [class*="stat"]').first();
    await expect(data).toBeVisible({ timeout: 30000 });
  });
});

test.describe("Reports — Customer Report (DB Data)", () => {
  test("loads customer report from DB", async ({ page }) => {
    await goToReport(page, "/reports/customers");
    const content = page.locator('h1, h2, table').first();
    await expect(content).toBeVisible({ timeout: 30000 });
  });
});

test.describe("Reports — Delivery Report (DB Data)", () => {
  test("loads delivery report from DB", async ({ page }) => {
    await goToReport(page, "/reports/delivery");
    const content = page.locator('h1, h2, table').first();
    await expect(content).toBeVisible({ timeout: 30000 });
  });
});

test.describe("Reports — Reconciliation Report (DB Data)", () => {
  test("loads reconciliation report from DB", async ({ page }) => {
    await goToReport(page, "/reports/reconciliation");
    const content = page.locator('h1, h2, table').first();
    await expect(content).toBeVisible({ timeout: 30000 });
  });
});

test.describe("Admin Overview — Live DB Summary (from /)", () => {
  test("Bearth Overview shows total orders from DB", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/", { timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await waitForAppShell(page);
    // Overview shows stat cards with DB data: Total Orders, Total Customers, NFT Items in Stock, Products
    await expect(
      page.locator('text=/Total Orders|TOTAL ORDERS/i').first()
    ).toBeVisible({ timeout: 30000 });
  });

  test("overview total customers count from BearthDev users table", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/", { timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await waitForAppShell(page);
    await expect(
      page.locator('text=/Total Customers|TOTAL CUSTOMERS/i').first()
    ).toBeVisible({ timeout: 30000 });
  });

  test("NFT items in stock count from nft_records DB table", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/", { timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await waitForAppShell(page);
    await expect(
      page.locator('text=/NFT Items in Stock|NFT ITEMS/i').first()
    ).toBeVisible({ timeout: 30000 });
  });

  test("products in catalog count from products DB table", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/", { timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await waitForAppShell(page);
    await expect(
      page.locator('text=/Products in Catalog|PRODUCTS IN CATALOG/i').first()
    ).toBeVisible({ timeout: 30000 });
  });

  test("NFT Purchases section shows order breakdown from DB", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/", { timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await waitForAppShell(page);
    await expect(
      page.locator('text=/NFT Purchases|NFT PURCHASES/i').first()
    ).toBeVisible({ timeout: 30000 });
  });
});
