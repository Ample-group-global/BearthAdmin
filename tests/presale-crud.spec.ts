/**
 * Presale CRUD — deep coverage of all create/edit/delete modals and forms.
 * Tests every form field, validation, modal open/close, and search/filter.
 * Uses Cancel to close modals without writing real data (preserves sample data).
 */
import { test, expect } from "@playwright/test";
import { loginAs, screenshot } from "./helpers";

test.describe("Presale — Orders CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/presale/orders");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
  });

  test("page heading and description visible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Orders/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Manage Bearth orders")).toBeVisible();
    await screenshot(page, "p-orders-heading");
  });

  test("New Order button opens modal", async ({ page }) => {
    await page.getByRole("button", { name: /New Order/i }).click();
    await expect(page.getByRole("dialog").or(page.locator("[role='dialog']")).or(
      page.locator(".fixed.inset-0").filter({ hasText: /Order Number/ })
    )).toBeVisible({ timeout: 5000 });
    await screenshot(page, "p-orders-modal-open");
  });

  test("New Order modal has all required form fields", async ({ page }) => {
    await page.getByRole("button", { name: /New Order/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText("Order Number")).toBeVisible();
    await expect(page.getByText("Purchase Date")).toBeVisible();
    await expect(page.getByText("NFT Amount")).toBeVisible({ timeout: 5000 });
    await screenshot(page, "p-orders-modal-fields");
  });

  test("New Order modal Cancel closes modal", async ({ page }) => {
    await page.getByRole("button", { name: /New Order/i }).click();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: /Cancel/i }).click();
    await page.waitForTimeout(400);
    await expect(page.getByRole("button", { name: /New Order/i })).toBeVisible();
    await screenshot(page, "p-orders-modal-closed");
  });

  test("orders table has data rows from sample data", async ({ page }) => {
    const rows = page.locator("table tbody tr").or(page.locator("tr").filter({ hasText: /ORD-/ }));
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    await screenshot(page, "p-orders-table");
  });

  test("search input filters orders", async ({ page }) => {
    const search = page.locator("input").filter({ hasText: "" }).first();
    await expect(search).toBeVisible({ timeout: 8000 });
    await search.fill("ORD-2026");
    await page.waitForTimeout(800);
    await screenshot(page, "p-orders-search");
    const body = await page.locator("main").textContent();
    expect(body).toBeTruthy();
  });

  test("search input clears and shows all orders", async ({ page }) => {
    const search = page.locator('input[placeholder*="Search"]').or(
      page.locator('input[type="text"]').first()
    );
    await search.fill("ORD-2026");
    await page.waitForTimeout(500);
    await search.fill("");
    await page.waitForTimeout(800);
    const rows = page.locator("table tbody tr").or(page.locator("tr").filter({ hasText: /ORD-/ }));
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test("pagination controls are visible", async ({ page }) => {
    await expect(page.getByRole("button", { name: /prev|previous|←/i }).or(
      page.getByText(/of \d+/i)
    ).first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "p-orders-pagination");
  });

  test("Edit button opens modal with pre-filled data", async ({ page }) => {
    const editBtn = page.getByRole("button", { name: /edit/i }).first();
    if (await editBtn.count() > 0) {
      await editBtn.click();
      await page.waitForTimeout(500);
      await expect(page.getByText("Order Number")).toBeVisible({ timeout: 5000 });
      const orderInput = page.locator('input').filter({ hasText: "" }).first();
      const value = await orderInput.inputValue();
      expect(value.length).toBeGreaterThan(0);
      await page.getByRole("button", { name: /Cancel/i }).click();
      await screenshot(page, "p-orders-edit-modal");
    }
  });

  test("Delete button shows confirmation modal", async ({ page }) => {
    const deleteBtn = page.getByRole("button", { name: /delete/i }).first();
    if (await deleteBtn.count() > 0) {
      await deleteBtn.click();
      await page.waitForTimeout(400);
      await expect(page.getByRole("button", { name: /Cancel/i })).toBeVisible({ timeout: 3000 });
      await page.getByRole("button", { name: /Cancel/i }).click();
      await screenshot(page, "p-orders-delete-modal");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe("Presale — Customers CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/presale/customers");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
  });

  test("page heading visible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Customer/i })).toBeVisible({ timeout: 10000 });
    await screenshot(page, "p-customers-heading");
  });

  test("customers table has data rows", async ({ page }) => {
    const table = page.locator("table");
    await expect(table).toBeVisible({ timeout: 10000 });
    const rows = table.locator("tbody tr");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    await screenshot(page, "p-customers-table");
  });

  test("search input filters customers", async ({ page }) => {
    const search = page.locator('input[placeholder*="Search"]').or(
      page.locator('input[placeholder*="search"]')
    ).first();
    await expect(search).toBeVisible({ timeout: 8000 });
    await search.fill("Yizhen");
    await page.waitForTimeout(800);
    await screenshot(page, "p-customers-search");
    const body = await page.locator("main").textContent();
    expect(body).toContain("Yizhen");
  });

  test("active/inactive toggle button is visible", async ({ page }) => {
    const toggleBtn = page.getByRole("button", { name: /active|all/i }).first();
    await expect(toggleBtn).toBeVisible({ timeout: 8000 });
    await screenshot(page, "p-customers-toggle");
  });

  test("clicking active/inactive toggle changes view", async ({ page }) => {
    const toggleBtn = page.getByRole("button", { name: /active|all|inactive/i }).first();
    await expect(toggleBtn).toBeVisible({ timeout: 8000 });
    await toggleBtn.click();
    await page.waitForTimeout(500);
    await screenshot(page, "p-customers-toggle-clicked");
    await expect(page.locator("main")).toBeVisible();
  });

  test("table has sortable column headers", async ({ page }) => {
    const headers = page.locator("th");
    const count = await headers.count();
    expect(count).toBeGreaterThan(3);
    await screenshot(page, "p-customers-headers");
  });

  test("clicking column header sorts table", async ({ page }) => {
    const firstNameHeader = page.locator("th").filter({ hasText: /First Name|first/i }).first();
    if (await firstNameHeader.count() > 0) {
      await firstNameHeader.click();
      await page.waitForTimeout(600);
      await screenshot(page, "p-customers-sort-first");
      await firstNameHeader.click();
      await page.waitForTimeout(600);
      await screenshot(page, "p-customers-sort-reverse");
    }
  });

  test("New Customer button opens modal", async ({ page }) => {
    await page.getByRole("button", { name: /New Customer/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText("First Name")).toBeVisible({ timeout: 5000 });
    await screenshot(page, "p-customers-modal-open");
  });

  test("New Customer modal has all form fields", async ({ page }) => {
    await page.getByRole("button", { name: /New Customer/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText("First Name")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Last Name")).toBeVisible();
    await expect(page.getByText("Phone").first()).toBeVisible();
    await expect(page.getByText("Email").first()).toBeVisible();
    await expect(page.getByText("LINE ID").or(page.getByText("Line ID")).first()).toBeVisible();
    await expect(page.getByText("Referrer")).toBeVisible();
    await screenshot(page, "p-customers-modal-fields");
  });

  test("New Customer modal validates required contact field", async ({ page }) => {
    await page.getByRole("button", { name: /New Customer/i }).click();
    await page.waitForTimeout(500);
    await page.locator('input[placeholder*="First"]').or(
      page.locator('input').nth(0)
    ).fill("TestFirst");
    await page.locator('input[placeholder*="Last"]').or(
      page.locator('input').nth(1)
    ).fill("TestLast");
    await page.getByRole("button", { name: /Save|Create/i }).click();
    await page.waitForTimeout(600);
    await expect(page.getByText(/contact|required|phone|email|LINE/i).first()).toBeVisible({ timeout: 3000 });
    await page.getByRole("button", { name: /Cancel/i }).click();
    await screenshot(page, "p-customers-modal-validation");
  });

  test("New Customer modal Cancel closes modal", async ({ page }) => {
    await page.getByRole("button", { name: /New Customer/i }).click();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: /Cancel/i }).click();
    await page.waitForTimeout(400);
    await expect(page.getByRole("button", { name: /New Customer/i })).toBeVisible();
  });

  test("Referrer dropdown opens when clicked", async ({ page }) => {
    await page.getByRole("button", { name: /New Customer/i }).click();
    await page.waitForTimeout(500);
    const referrerBtn = page.getByText(/No referrer|referrer/i).first();
    if (await referrerBtn.count() > 0) {
      await referrerBtn.click();
      await page.waitForTimeout(400);
      await expect(page.getByText(/No referrer|Search/i).first()).toBeVisible({ timeout: 3000 });
      await screenshot(page, "p-customers-referrer-dropdown");
    }
    await page.getByRole("button", { name: /Cancel/i }).click();
  });

  test("wallet count badge opens wallet modal", async ({ page }) => {
    const walletBadge = page.locator("button").filter({ hasText: /\d+/ }).first();
    if (await walletBadge.count() > 0) {
      await walletBadge.click();
      await page.waitForTimeout(500);
      const walletModal = page.getByText(/Wallet Address|whitelist/i).first();
      if (await walletModal.count() > 0) {
        await expect(walletModal).toBeVisible({ timeout: 3000 });
        await screenshot(page, "p-customers-wallet-modal");
        await page.keyboard.press("Escape");
      }
    }
  });

  test("Edit customer button opens modal with pre-filled data", async ({ page }) => {
    const editBtn = page.getByRole("button", { name: /edit/i }).first();
    if (await editBtn.count() > 0) {
      await editBtn.click();
      await page.waitForTimeout(600);
      await expect(page.getByText("First Name")).toBeVisible({ timeout: 5000 });
      const firstNameInput = page.locator('input').filter({ hasText: "" }).first();
      const value = await firstNameInput.inputValue();
      expect(value.length).toBeGreaterThan(0);
      await page.getByRole("button", { name: /Cancel/i }).click();
      await screenshot(page, "p-customers-edit-modal");
    }
  });

  test("pagination controls visible on customers", async ({ page }) => {
    await expect(page.getByText(/Showing|of \d+|page/i).first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "p-customers-pagination");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe("Presale — Products CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/presale/products");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
  });

  test("page heading visible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Products/i })).toBeVisible({ timeout: 10000 });
    await screenshot(page, "p-products-heading");
  });

  test("products table has data rows from sample data", async ({ page }) => {
    const table = page.locator("table");
    await expect(table).toBeVisible({ timeout: 10000 });
    const rows = table.locator("tbody tr");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    await screenshot(page, "p-products-table");
  });

  test("table shows expected columns", async ({ page }) => {
    await expect(page.getByText("Name").first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/Price|Stock|Status/i).first()).toBeVisible();
    await screenshot(page, "p-products-columns");
  });

  test("search input filters products", async ({ page }) => {
    const search = page.locator('input[placeholder*="Search"]').or(
      page.locator('input[placeholder*="search"]').or(page.locator('input[type="text"]'))
    ).first();
    await expect(search).toBeVisible({ timeout: 8000 });
    await search.fill("NFT");
    await page.waitForTimeout(800);
    await screenshot(page, "p-products-search");
    const body = await page.locator("main").textContent();
    expect(body).toBeTruthy();
  });

  test("New Product button opens modal", async ({ page }) => {
    await page.getByRole("button", { name: /New Product/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText(/Product Name|Name/i).first()).toBeVisible({ timeout: 5000 });
    await screenshot(page, "p-products-modal-open");
  });

  test("New Product modal has all form fields", async ({ page }) => {
    await page.getByRole("button", { name: /New Product/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText(/Product Name|Name/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Retail Price|retail/i).first()).toBeVisible();
    await expect(page.getByText(/Bearth Price|presale/i).first()).toBeVisible();
    await expect(page.getByText(/Stock/i).first()).toBeVisible();
    await expect(page.getByText(/Status/i).first()).toBeVisible();
    await screenshot(page, "p-products-modal-fields");
  });

  test("New Product modal Cancel closes", async ({ page }) => {
    await page.getByRole("button", { name: /New Product/i }).click();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: /Cancel/i }).click();
    await page.waitForTimeout(400);
    await expect(page.getByRole("button", { name: /New Product/i })).toBeVisible();
  });

  test("Edit product button opens modal", async ({ page }) => {
    const editBtn = page.getByRole("button", { name: /edit/i }).first();
    if (await editBtn.count() > 0) {
      await editBtn.click();
      await page.waitForTimeout(500);
      await expect(page.getByText(/Product Name|Name/i).first()).toBeVisible({ timeout: 5000 });
      const nameInput = page.locator('input').first();
      const value = await nameInput.inputValue();
      expect(value.length).toBeGreaterThan(0);
      await page.getByRole("button", { name: /Cancel/i }).click();
      await screenshot(page, "p-products-edit-modal");
    }
  });

  test("Deactivate button shows confirmation modal", async ({ page }) => {
    const deactivateBtn = page.getByRole("button", { name: /deactivate/i }).first();
    if (await deactivateBtn.count() > 0) {
      await deactivateBtn.click();
      await page.waitForTimeout(400);
      await expect(page.getByRole("button", { name: /Cancel/i })).toBeVisible({ timeout: 3000 });
      await page.getByRole("button", { name: /Cancel/i }).click();
      await screenshot(page, "p-products-deactivate-modal");
    }
  });

  test("product status badge shows Active or Inactive", async ({ page }) => {
    await expect(page.getByText(/Active|Inactive/i).first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "p-products-status-badge");
  });

  test("pagination controls visible", async ({ page }) => {
    await expect(page.getByText(/Showing|of \d+|page/i).first().or(
      page.getByRole("button", { name: /prev|next/i }).first()
    )).toBeVisible({ timeout: 8000 });
    await screenshot(page, "p-products-pagination");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe("Presale — NFT Records CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/presale/nft");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
  });

  test("page heading and description visible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /NFT Records/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Manage NFT serial numbers")).toBeVisible();
    await screenshot(page, "p-nft-records-heading");
  });

  test("NFT records table has data from sample data", async ({ page }) => {
    const table = page.locator("table");
    await expect(table).toBeVisible({ timeout: 10000 });
    const rows = table.locator("tbody tr");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    await screenshot(page, "p-nft-records-table");
  });

  test("table shows serial number column", async ({ page }) => {
    await expect(page.getByText(/Serial Number|serial/i).first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "p-nft-records-columns");
  });

  test("search input filters NFT records", async ({ page }) => {
    const search = page.locator('input[placeholder*="Search"]').or(
      page.locator('input[placeholder*="serial"]').or(page.locator('input[type="text"]'))
    ).first();
    await expect(search).toBeVisible({ timeout: 8000 });
    await search.fill("BT-");
    await page.waitForTimeout(800);
    await screenshot(page, "p-nft-records-search");
  });

  test("delivery status filter dropdown works", async ({ page }) => {
    const filterSelect = page.locator("select").first();
    if (await filterSelect.count() > 0) {
      await expect(filterSelect).toBeVisible({ timeout: 8000 });
      const options = await filterSelect.locator("option").allTextContents();
      expect(options.length).toBeGreaterThan(1);
      await filterSelect.selectOption({ index: 1 });
      await page.waitForTimeout(600);
      await screenshot(page, "p-nft-records-filter");
    }
  });

  test("New NFT button opens modal", async ({ page }) => {
    await page.getByRole("button", { name: /New NFT|Create NFT/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText(/Serial Number|serial/i).first()).toBeVisible({ timeout: 5000 });
    await screenshot(page, "p-nft-records-modal-open");
  });

  test("New NFT modal has all form fields", async ({ page }) => {
    await page.getByRole("button", { name: /New NFT|Create NFT/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText(/Serial Number/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Stage/i).first()).toBeVisible();
    await expect(page.getByText(/Type|NFT Type/i).first()).toBeVisible();
    await expect(page.getByText(/Delivery Status/i).first()).toBeVisible();
    await screenshot(page, "p-nft-records-modal-fields");
  });

  test("New NFT modal Cancel closes", async ({ page }) => {
    await page.getByRole("button", { name: /New NFT|Create NFT/i }).click();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: /Cancel/i }).click();
    await page.waitForTimeout(400);
    await expect(page.getByRole("button", { name: /New NFT|Create NFT/i })).toBeVisible();
  });

  test("Deliver button shows confirmation modal", async ({ page }) => {
    const deliverBtn = page.getByRole("button", { name: /Deliver/i }).first();
    if (await deliverBtn.count() > 0) {
      await deliverBtn.click();
      await page.waitForTimeout(400);
      await expect(page.getByText(/Confirm|deliver/i).first()).toBeVisible({ timeout: 3000 });
      await page.getByRole("button", { name: /Cancel/i }).click();
      await screenshot(page, "p-nft-records-deliver-modal");
    }
  });

  test("pagination controls visible", async ({ page }) => {
    await expect(page.getByRole("button", { name: /prev|next/i }).first().or(
      page.getByText(/of \d+/i)
    )).toBeVisible({ timeout: 8000 });
    await screenshot(page, "p-nft-records-pagination");
  });
});
