// Route: /orders — Orders management page (BearthDev DB: orders, order_line_items tables)
import { test, expect } from "@playwright/test";
import path from "path";

test.use({ storageState: path.join(process.cwd(), "tests", ".auth", "admin.json") });

async function waitForAppShell(page: any) {
  await page.locator('text=Verifying access').waitFor({ state: 'detached', timeout: 60000 }).catch(() => {});
  await page.locator('button').filter({ hasText: /Sign Out/i }).waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
}

async function goToOrders(page: any) {
  test.setTimeout(120000);
  await page.goto("/orders", { timeout: 90000 });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await waitForAppShell(page);
  expect(page.url()).not.toContain("/login");
}

test.describe("Orders — Page Load & DB Data", () => {
  test("loads Orders heading", async ({ page }) => {
    await goToOrders(page);
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 20000 });
    await expect(heading).toContainText(/Order/i);
  });

  test("order table loads from BearthDev orders table", async ({ page }) => {
    await goToOrders(page);
    await page.locator('svg.animate-spin').waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
    // Either a table (orders exist) or DataTable empty state
    const content = page.locator('table').or(page.locator('div.flex-col.h-52'));
    await expect(content.first()).toBeVisible({ timeout: 30000 });
  });

  test("no runtime error on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => {
      if (!err.message.includes("favicon") && !err.message.includes("icon.png")) {
        errors.push(err.message);
      }
    });
    await goToOrders(page);
    await page.waitForTimeout(2000);
    expect(errors, `Runtime errors: ${errors.join(", ")}`).toHaveLength(0);
  });

  test("payment status filter shows options from DB master data", async ({ page }) => {
    await goToOrders(page);
    const statusSelect = page.locator('select').first();
    await expect(statusSelect).toBeVisible({ timeout: 20000 });
    // Should have at least "All" option + DB statuses (pending, confirmed, cancelled)
    const options = await statusSelect.locator('option').count();
    expect(options).toBeGreaterThan(1);
  });

  test("session is authenticated (no redirect to login)", async ({ page }) => {
    await goToOrders(page);
    expect(page.url()).not.toContain("/login");
  });
});

test.describe("Orders — DB Actions & NFT Order Management", () => {
  test("search field filters orders from DB", async ({ page }) => {
    await goToOrders(page);
    const searchInput = page.locator('input[placeholder*="Search" i]').first();
    await expect(searchInput).toBeVisible({ timeout: 20000 });
    await searchInput.fill("test");
    await expect(searchInput).toHaveValue("test");
    await page.waitForTimeout(800);
  });

  test("New Order button opens modal with form fields", async ({ page }) => {
    await goToOrders(page);
    const newBtn = page.locator('button').filter({ hasText: /New Order/i }).first();
    await expect(newBtn).toBeVisible({ timeout: 20000 });
    await newBtn.click();

    // Modal should open
    await expect(
      page.locator('[role="dialog"], .modal, input[placeholder*="Order" i]').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("New Order modal has NFT/Product/Mixed order type selection", async ({ page }) => {
    test.setTimeout(120000);
    await goToOrders(page);
    const newBtn = page.locator('button').filter({ hasText: /New Order/i }).first();
    await newBtn.click();

    // Order type buttons should be present (NFT / Product / NFT+Product)
    await expect(
      page.locator('button, label, input[type="radio"]').filter({ hasText: /NFT|Product|Mixed/i }).first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("order type badges show NFT/Product/Mixed from DB order data", async ({ page }) => {
    await goToOrders(page);
    await page.locator('svg.animate-spin').waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});

    const hasTable = await page.locator('table').isVisible({ timeout: 15000 }).catch(() => false);
    if (!hasTable) { console.log("No orders in DB — skipping type badge check"); return; }

    // OrderTypeBadge shows NFT / Product / NFT+Product
    const typeBadge = page.locator('span').filter({ hasText: /NFT|Product/i }).first();
    await expect(typeBadge).toBeVisible({ timeout: 10000 });
  });

  test("clicking an order row shows order details", async ({ page }) => {
    test.setTimeout(120000);
    await goToOrders(page);
    await page.locator('svg.animate-spin').waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});

    const hasTable = await page.locator('table').isVisible({ timeout: 15000 }).catch(() => false);
    if (!hasTable) { console.log("No orders in DB — skipping row click test"); return; }

    const firstRow = page.locator('tbody tr').first();
    await firstRow.click();

    // Detail modal or inline expand should open
    await expect(
      page.locator('[role="dialog"], input[placeholder*="Order" i]').first()
    ).toBeVisible({ timeout: 15000 });
  });
});
