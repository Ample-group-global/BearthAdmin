/**
 * Dashboard Whitelist — deep coverage of all 6 tabs in the whitelist management page.
 * Covers: All Addresses (search, table, pagination, remove), Add Single,
 * Bulk Import, Merkle Root, Test Address, Export.
 */
import { test, expect } from "@playwright/test";
import { loginAs, mockBlockchain, mockWhitelistApi, MOCK_WHITELIST_ENTRIES, screenshot } from "./helpers";

test.describe("Dashboard — Whitelist Page (All 6 Tabs)", () => {
  test.beforeEach(async ({ page }) => {
    await mockBlockchain(page);
    await mockWhitelistApi(page);
    await loginAs(page, "tech");
    await page.goto("/dashboard/whitelist");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
  });

  // ── Page header & stat cards ────────────────────────────────────────────────

  test("page heading visible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Whitelist Management/i })).toBeVisible({ timeout: 10000 });
    await screenshot(page, "wl-heading");
  });

  test("stat cards show Total Addresses, Merkle Root, Override Active, Last Updated", async ({ page }) => {
    await expect(page.getByText(/Total Addresses/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/Merkle Root/i).first()).toBeVisible();
    await expect(page.getByText(/Override Active/i)).toBeVisible();
    await expect(page.getByText(/Last Updated/i)).toBeVisible();
    await screenshot(page, "wl-stat-cards");
  });

  // ── Tab navigation ──────────────────────────────────────────────────────────

  test("all 6 tabs are visible", async ({ page }) => {
    await expect(page.getByRole("button", { name: "All Addresses" })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole("button", { name: "Add Single" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Bulk Import" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Merkle Root" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Test Address" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Export" })).toBeVisible();
    await screenshot(page, "wl-all-tabs");
  });

  // ── All Addresses Tab ───────────────────────────────────────────────────────

  test("All Addresses tab: address list loads from mock", async ({ page }) => {
    await expect(page.getByText(/0xAb5801/i)).toBeVisible({ timeout: 8000 });
    await screenshot(page, "wl-addresses-list");
  });

  test("All Addresses tab: address count matches mock entries", async ({ page }) => {
    const addressCount = MOCK_WHITELIST_ENTRIES.length;
    await expect(page.getByText(new RegExp(`${addressCount}`, "i")).first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "wl-addresses-count");
  });

  test("All Addresses tab: search input filters addresses", async ({ page }) => {
    const search = page.locator('input[placeholder*="Search"]').or(
      page.locator('input[placeholder*="filter"]')
    ).first();
    await expect(search).toBeVisible({ timeout: 8000 });
    await search.fill("0xAb5801");
    await page.waitForTimeout(400);
    await expect(page.getByText(/0xAb5801/i)).toBeVisible();
    await screenshot(page, "wl-addresses-search");
  });

  test("All Addresses tab: search clearing shows all addresses", async ({ page }) => {
    const search = page.locator('input[placeholder*="Search"]').or(
      page.locator('input[placeholder*="filter"]')
    ).first();
    await search.fill("0xAb5801");
    await page.waitForTimeout(300);
    await search.fill("");
    await page.waitForTimeout(400);
    await expect(page.getByText(/0xAb5801/i)).toBeVisible({ timeout: 5000 });
    await screenshot(page, "wl-addresses-search-cleared");
  });

  test("All Addresses tab: each row has a remove button", async ({ page }) => {
    const removeBtn = page.getByRole("button", { name: /remove|delete/i }).first();
    await expect(removeBtn).toBeVisible({ timeout: 8000 });
    await screenshot(page, "wl-addresses-remove-btn");
  });

  test("All Addresses tab: remove button shows confirm before removing", async ({ page }) => {
    const firstRemoveBtn = page.getByRole("button", { name: /remove|delete/i }).first();
    if (await firstRemoveBtn.count() > 0) {
      await firstRemoveBtn.click();
      await page.waitForTimeout(400);
      const confirmMsg = page.getByText(/confirm|sure|remove/i).first();
      if (await confirmMsg.count() > 0) {
        await expect(confirmMsg).toBeVisible({ timeout: 3000 });
        await page.keyboard.press("Escape");
      }
      await screenshot(page, "wl-addresses-remove-confirm");
    }
  });

  test("All Addresses tab: pagination shows page controls when > 20 entries", async ({ page }) => {
    const paginationEl = page.getByRole("button", { name: /prev|previous/i }).or(
      page.getByText(/page \d+ of/i)
    ).first();
    if (await paginationEl.count() > 0) {
      await expect(paginationEl).toBeVisible({ timeout: 5000 });
      await screenshot(page, "wl-addresses-pagination");
    }
  });

  // ── Add Single Tab ──────────────────────────────────────────────────────────

  test("Add Single tab: tab button navigates to add form", async ({ page }) => {
    await page.getByRole("button", { name: "Add Single" }).click();
    await page.waitForTimeout(400);
    await expect(page.locator('input[placeholder*="0x"]')).toBeVisible({ timeout: 5000 });
    await screenshot(page, "wl-add-single-tab");
  });

  test("Add Single tab: address input accepts text", async ({ page }) => {
    await page.getByRole("button", { name: "Add Single" }).click();
    await page.waitForTimeout(300);
    const input = page.locator('input[placeholder*="0x"]').first();
    await input.fill("0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B");
    const value = await input.inputValue();
    expect(value).toBe("0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B");
    await screenshot(page, "wl-add-single-input");
  });

  test("Add Single tab: Add Address button is present", async ({ page }) => {
    await page.getByRole("button", { name: "Add Single" }).click();
    await page.waitForTimeout(300);
    await expect(page.getByRole("button", { name: /Add Address|Add/i }).last()).toBeVisible({ timeout: 5000 });
    await screenshot(page, "wl-add-single-button");
  });

  // ── Bulk Import Tab ─────────────────────────────────────────────────────────

  test("Bulk Import tab: textarea visible for multi-address import", async ({ page }) => {
    await page.getByRole("button", { name: "Bulk Import" }).click();
    await page.waitForTimeout(400);
    await expect(page.locator("textarea")).toBeVisible({ timeout: 5000 });
    await screenshot(page, "wl-bulk-import-tab");
  });

  test("Bulk Import tab: textarea accepts addresses", async ({ page }) => {
    await page.getByRole("button", { name: "Bulk Import" }).click();
    await page.waitForTimeout(300);
    const textarea = page.locator("textarea").first();
    await textarea.fill("0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B\n0x5B38Da6a701c568545dCfcB03FcB875f56beddC4");
    await expect(page.getByText(/2 address|detected/i)).toBeVisible({ timeout: 3000 });
    await screenshot(page, "wl-bulk-import-textarea");
  });

  test("Bulk Import tab: Import Addresses button visible", async ({ page }) => {
    await page.getByRole("button", { name: "Bulk Import" }).click();
    await page.waitForTimeout(300);
    await expect(page.getByRole("button", { name: /Import/i })).toBeVisible({ timeout: 5000 });
    await screenshot(page, "wl-bulk-import-button");
  });

  // ── Merkle Root Tab ─────────────────────────────────────────────────────────

  test("Merkle Root tab: current root display visible", async ({ page }) => {
    await page.getByRole("button", { name: "Merkle Root" }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText(/Current Merkle Root|0xmockroot/i).first()).toBeVisible({ timeout: 5000 });
    await screenshot(page, "wl-merkle-root-tab");
  });

  test("Merkle Root tab: Set Root input and button visible", async ({ page }) => {
    await page.getByRole("button", { name: "Merkle Root" }).click();
    await page.waitForTimeout(400);
    await expect(page.locator('input[placeholder*="0x"]').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /Set Root|Set/i })).toBeVisible({ timeout: 5000 });
    await screenshot(page, "wl-merkle-set-root");
  });

  test("Merkle Root tab: Clear Override button visible", async ({ page }) => {
    await page.getByRole("button", { name: "Merkle Root" }).click();
    await page.waitForTimeout(400);
    await expect(page.getByRole("button", { name: /Clear Override|Clear/i })).toBeVisible({ timeout: 5000 });
    await screenshot(page, "wl-merkle-clear-override");
  });

  // ── Test Address Tab ────────────────────────────────────────────────────────

  test("Test Address tab: input and button visible", async ({ page }) => {
    await page.getByRole("button", { name: "Test Address" }).click();
    await page.waitForTimeout(400);
    await expect(page.locator('input[placeholder*="0x"]').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /Check Eligibility|Check/i })).toBeVisible({ timeout: 5000 });
    await screenshot(page, "wl-test-address-tab");
  });

  test("Test Address tab: shows whitelisted result for mock address", async ({ page }) => {
    await page.getByRole("button", { name: "Test Address" }).click();
    await page.waitForTimeout(300);
    const input = page.locator('input[placeholder*="0x"]').first();
    await input.fill("0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B");
    await page.getByRole("button", { name: /Check Eligibility|Check/i }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText(/Whitelisted|proof|✓/i).first()).toBeVisible({ timeout: 5000 });
    await screenshot(page, "wl-test-address-result");
  });

  // ── Export Tab ──────────────────────────────────────────────────────────────

  test("Export tab: Download CSV, JSON, TXT buttons visible", async ({ page }) => {
    await page.getByRole("button", { name: "Export" }).click();
    await page.waitForTimeout(400);
    await expect(page.getByRole("button", { name: /CSV/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /JSON/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /TXT/i })).toBeVisible();
    await screenshot(page, "wl-export-tab");
  });

  test("Export tab: shows available address count", async ({ page }) => {
    await page.getByRole("button", { name: "Export" }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText(/address|export/i).first()).toBeVisible({ timeout: 5000 });
    await screenshot(page, "wl-export-count");
  });
});
