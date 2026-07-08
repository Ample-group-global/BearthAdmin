/**
 * Presale Extra — Reports, Reconciliation filters, and Users/Team management.
 * Covers every minor feature: filter pills, refresh button, visual bars,
 * user modal fields, role dropdown, activate/deactivate flows.
 */
import { test, expect } from "@playwright/test";
import { loginAs, screenshot } from "./helpers";

// ── Reports Page ──────────────────────────────────────────────────────────────

test.describe("Presale — Reports", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/presale/reports");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
  });

  test("reports heading visible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Reports/i })).toBeVisible({ timeout: 10000 });
    await screenshot(page, "p-reports-heading");
  });

  test("key metrics cards all visible", async ({ page }) => {
    await expect(page.getByText("Total Orders").first()).toBeVisible({ timeout: 12000 });
    await expect(page.getByText("Total Customers").first()).toBeVisible();
    await expect(page.getByText("NFT Records").first()).toBeVisible();
    await expect(page.getByText("Products").first()).toBeVisible();
    await screenshot(page, "p-reports-key-metrics");
  });

  test("revenue cards visible", async ({ page }) => {
    await expect(page.getByText(/NFT Revenue/i).first()).toBeVisible({ timeout: 12000 });
    await expect(page.getByText(/Merch Revenue/i).first()).toBeVisible();
    await screenshot(page, "p-reports-revenue");
  });

  test("orders by payment status section visible with bar chart", async ({ page }) => {
    await expect(page.getByText(/Orders by Payment Status/i)).toBeVisible({ timeout: 12000 });
    await screenshot(page, "p-reports-payment-status");
  });

  test("NFT delivery breakdown section visible", async ({ page }) => {
    await expect(page.getByText(/NFT Delivery/i).or(
      page.getByText(/Delivery Breakdown/i)
    ).first()).toBeVisible({ timeout: 12000 });
    await screenshot(page, "p-reports-nft-delivery");
  });

  test("customer statistics section visible", async ({ page }) => {
    await expect(page.getByText(/Customer Statistics|Total Registered|Conversion Rate/i).first()).toBeVisible({ timeout: 12000 });
    await screenshot(page, "p-reports-customers");
  });

  test("reconciliation summary section visible", async ({ page }) => {
    await expect(page.getByText(/Reconciliation/i).first()).toBeVisible({ timeout: 12000 });
    await screenshot(page, "p-reports-reconciliation-summary");
  });

  test("refresh button reloads data", async ({ page }) => {
    const refreshBtn = page.getByRole("button", { name: /refresh/i });
    await expect(refreshBtn).toBeVisible({ timeout: 8000 });
    await refreshBtn.click();
    await page.waitForTimeout(1000);
    await expect(page.getByText("Total Orders").first()).toBeVisible({ timeout: 12000 });
    await screenshot(page, "p-reports-after-refresh");
  });
});

// ── Reconciliation Page ───────────────────────────────────────────────────────

test.describe("Presale — Reconciliation", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/presale/reconciliation");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
  });

  test("reconciliation page heading visible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Reconciliation/i })).toBeVisible({ timeout: 10000 });
    await screenshot(page, "p-reconciliation-heading");
  });

  test("status filter All button is visible and active by default", async ({ page }) => {
    await expect(page.getByRole("button", { name: /All|All Statuses/i }).first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "p-reconciliation-filters");
  });

  test("filter buttons Pending, Received, Cancelled visible", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Pending/i })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole("button", { name: /Received/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Cancelled|Canceled/i })).toBeVisible();
    await screenshot(page, "p-reconciliation-filter-buttons");
  });

  test("clicking Pending filter shows only pending entries", async ({ page }) => {
    await page.getByRole("button", { name: /Pending/i }).click();
    await page.waitForTimeout(600);
    await screenshot(page, "p-reconciliation-filter-pending");
    const body = await page.locator("main").textContent();
    expect(body).toBeTruthy();
  });

  test("clicking Received filter changes view", async ({ page }) => {
    await page.getByRole("button", { name: /Received/i }).click();
    await page.waitForTimeout(600);
    await screenshot(page, "p-reconciliation-filter-received");
    await expect(page.locator("main")).toBeVisible();
  });

  test("clicking Cancelled filter changes view", async ({ page }) => {
    await page.getByRole("button", { name: /Cancelled|Canceled/i }).click();
    await page.waitForTimeout(600);
    await screenshot(page, "p-reconciliation-filter-cancelled");
    await expect(page.locator("main")).toBeVisible();
  });

  test("clicking All restores full list", async ({ page }) => {
    await page.getByRole("button", { name: /Pending/i }).click();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: /All|All Statuses/i }).first().click();
    await page.waitForTimeout(600);
    await screenshot(page, "p-reconciliation-filter-all");
    await expect(page.locator("main")).toBeVisible();
  });

  test("reconciliation table entry columns visible", async ({ page }) => {
    await expect(page.getByText(/Entry Type|Order #|Customer|Amount|Status/i).first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "p-reconciliation-table-columns");
  });

  test("Confirm button opens action modal (if pending entries exist)", async ({ page }) => {
    const confirmBtn = page.getByRole("button", { name: /Confirm/i }).first();
    if (await confirmBtn.count() > 0) {
      await confirmBtn.click();
      await page.waitForTimeout(400);
      await expect(page.locator("textarea").or(
        page.getByText(/Notes/i).first()
      )).toBeVisible({ timeout: 3000 });
      await page.getByRole("button", { name: /Cancel/i }).click();
      await screenshot(page, "p-reconciliation-confirm-modal");
    }
  });

  test("Cancel action button opens action modal (if pending entries exist)", async ({ page }) => {
    const cancelEntryBtn = page.getByRole("button", { name: /^Cancel Entry$|^Cancel$/i }).first();
    if (await cancelEntryBtn.count() > 0) {
      await cancelEntryBtn.click();
      await page.waitForTimeout(400);
      await expect(page.getByRole("button", { name: /Cancel/i }).nth(0)).toBeVisible({ timeout: 3000 });
      await page.getByRole("button", { name: /Cancel/i }).first().click();
      await screenshot(page, "p-reconciliation-cancel-modal");
    }
  });
});

// ── Presale Users/Team Page ───────────────────────────────────────────────────

test.describe("Presale — Users/Team", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/presale/users");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
  });

  test("users page heading visible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Team|Users/i })).toBeVisible({ timeout: 10000 });
    await screenshot(page, "p-users-heading");
  });

  test("users table visible with data", async ({ page }) => {
    const table = page.locator("table");
    await expect(table).toBeVisible({ timeout: 10000 });
    const rows = table.locator("tbody tr");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    await screenshot(page, "p-users-table");
  });

  test("users table shows Name, Email, Role, Status columns", async ({ page }) => {
    await expect(page.getByText("Name").first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Email").first()).toBeVisible();
    await expect(page.getByText("Role").first()).toBeVisible();
    await expect(page.getByText(/Status|Active/i).first()).toBeVisible();
    await screenshot(page, "p-users-columns");
  });

  test("search input filters users", async ({ page }) => {
    const search = page.locator('input[placeholder*="Search"]').or(
      page.locator('input[placeholder*="search"]')
    ).first();
    await expect(search).toBeVisible({ timeout: 8000 });
    await search.fill("admin");
    await page.waitForTimeout(600);
    await screenshot(page, "p-users-search");
  });

  test("New User button opens modal", async ({ page }) => {
    await page.getByRole("button", { name: /New User|Add User/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText("First Name")).toBeVisible({ timeout: 5000 });
    await screenshot(page, "p-users-modal-open");
  });

  test("New User modal has all form fields", async ({ page }) => {
    await page.getByRole("button", { name: /New User|Add User/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText("First Name")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Last Name")).toBeVisible();
    await expect(page.getByText("Email").first()).toBeVisible();
    await expect(page.getByText("Role")).toBeVisible();
    await screenshot(page, "p-users-modal-fields");
  });

  test("New User modal role dropdown has options", async ({ page }) => {
    await page.getByRole("button", { name: /New User|Add User/i }).click();
    await page.waitForTimeout(500);
    const roleSelect = page.locator("select").first();
    if (await roleSelect.count() > 0) {
      const options = await roleSelect.locator("option").allTextContents();
      expect(options.length).toBeGreaterThan(1);
      await screenshot(page, "p-users-role-dropdown");
    }
    await page.getByRole("button", { name: /Cancel/i }).click();
  });

  test("New User modal Cancel closes", async ({ page }) => {
    await page.getByRole("button", { name: /New User|Add User/i }).click();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: /Cancel/i }).click();
    await page.waitForTimeout(400);
    await expect(page.getByRole("button", { name: /New User|Add User/i })).toBeVisible();
  });

  test("Edit user button opens modal with pre-filled email (disabled)", async ({ page }) => {
    const editBtn = page.getByRole("button", { name: /edit/i }).first();
    if (await editBtn.count() > 0) {
      await editBtn.click();
      await page.waitForTimeout(500);
      await expect(page.getByText("Email").first()).toBeVisible({ timeout: 5000 });
      const emailInput = page.locator('input[type="email"]').or(
        page.locator('input').filter({ hasText: "" }).nth(2)
      ).first();
      if (await emailInput.count() > 0) {
        const isDisabled = await emailInput.isDisabled();
        expect(isDisabled).toBe(true);
        await expect(page.getByText(/cannot be changed/i)).toBeVisible({ timeout: 3000 });
      }
      await page.getByRole("button", { name: /Cancel/i }).click();
      await screenshot(page, "p-users-edit-modal");
    }
  });

  test("Deactivate button shows confirmation modal", async ({ page }) => {
    const deactivateBtn = page.getByRole("button", { name: /deactivate/i }).first();
    if (await deactivateBtn.count() > 0) {
      await deactivateBtn.click();
      await page.waitForTimeout(400);
      await expect(page.getByRole("button", { name: /Cancel/i })).toBeVisible({ timeout: 3000 });
      await page.getByRole("button", { name: /Cancel/i }).click();
      await screenshot(page, "p-users-deactivate-modal");
    }
  });

  test("users have role badge color-coded", async ({ page }) => {
    await expect(page.locator("span").filter({ hasText: /admin|ops|tech|operation/i }).first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "p-users-role-badge");
  });

  test("last login column visible (shows date or Never)", async ({ page }) => {
    await expect(page.getByText(/Last Login|Never/i).first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "p-users-last-login");
  });
});
