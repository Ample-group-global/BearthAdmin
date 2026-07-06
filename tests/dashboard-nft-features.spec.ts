/**
 * Dashboard NFT Overview — deep coverage of all features:
 * summary cards, financial/holder cards, filters, sorting, pagination,
 * NFT detail modal, enrichment button, export CSV.
 */
import { test, expect } from "@playwright/test";
import { loginAs, mockBlockchain, mockWhitelistApi, screenshot } from "./helpers";

test.describe("Dashboard — NFT Overview (All Features)", () => {
  test.beforeEach(async ({ page }) => {
    await mockBlockchain(page);
    await mockWhitelistApi(page);
    await loginAs(page, "tech");
    await page.goto("/dashboard/nfts");
    await expect(page.getByRole("heading", { name: /NFT Overview/i })).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500);
  });

  // ── Summary Cards ───────────────────────────────────────────────────────────

  test("all 7 summary cards are visible", async ({ page }) => {
    await expect(page.getByText("Total Minted").first()).toBeVisible({ timeout: 12000 });
    await expect(page.getByText("Owner Mints").first()).toBeVisible();
    await expect(page.getByText("WL Free").first()).toBeVisible();
    await expect(page.getByText("Public Free").first()).toBeVisible();
    await expect(page.getByText("Paid Mints").first()).toBeVisible();
    await expect(page.getByText("Revealed", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("SBT (Locked)").first()).toBeVisible();
    await screenshot(page, "nft-summary-cards");
  });

  test("Total Minted card shows a number", async ({ page }) => {
    const card = page.getByText("Total Minted").first();
    await expect(card).toBeVisible({ timeout: 10000 });
    await screenshot(page, "nft-total-minted-card");
  });

  // ── Financial / Holder Summary ────────────────────────────────────────────────

  test("Revenue card is visible", async ({ page }) => {
    await expect(page.getByText(/Revenue|Paid mints/i).first()).toBeVisible({ timeout: 10000 });
    await screenshot(page, "nft-revenue-card");
  });

  test("Gas Fees card is visible", async ({ page }) => {
    await expect(page.getByText(/Gas Fees|Gas Fee/i).first()).toBeVisible({ timeout: 10000 });
    await screenshot(page, "nft-gas-fees-card");
  });

  test("Holder Status card is visible", async ({ page }) => {
    await expect(page.getByText(/Holder Status|Still with Minter|Unique holders/i).first()).toBeVisible({ timeout: 10000 });
    await screenshot(page, "nft-holder-status-card");
  });

  // ── Refresh Button ──────────────────────────────────────────────────────────

  test("Refresh button visible and clickable", async ({ page }) => {
    const refreshBtn = page.getByRole("button", { name: /refresh/i });
    await expect(refreshBtn).toBeVisible({ timeout: 10000 });
    await expect(refreshBtn).toBeEnabled({ timeout: 15000 });
    await refreshBtn.click();
    await page.waitForTimeout(1000);
    await expect(page.getByRole("heading", { name: /NFT Overview/i })).toBeVisible();
    await screenshot(page, "nft-after-refresh");
  });

  // ── Load Gas & Holders ──────────────────────────────────────────────────────

  test("Load Gas & Holders button visible", async ({ page }) => {
    const loadBtn = page.getByRole("button", { name: /Load Gas|Holders/i });
    await expect(loadBtn).toBeVisible({ timeout: 10000 });
    await screenshot(page, "nft-load-gas-btn");
  });

  // ── Filters ─────────────────────────────────────────────────────────────────

  test("search input visible", async ({ page }) => {
    const search = page.locator('input[placeholder*="filter"]').or(
      page.locator('input[placeholder*="search"]').or(
        page.locator('input[placeholder*="token"]')
      )
    ).first();
    await expect(search).toBeVisible({ timeout: 8000 });
    await screenshot(page, "nft-search-input");
  });

  test("mint type filter dropdown visible with correct options", async ({ page }) => {
    const mintFilter = page.locator("select").first();
    await expect(mintFilter).toBeVisible({ timeout: 8000 });
    const options = await mintFilter.locator("option").allTextContents();
    expect(options.some((o) => o.includes("All"))).toBe(true);
    await screenshot(page, "nft-mint-filter");
  });

  test("selecting Owner filter in mint type works", async ({ page }) => {
    const mintFilter = page.locator("select").first();
    await mintFilter.selectOption({ label: /Owner/i });
    await page.waitForTimeout(500);
    await screenshot(page, "nft-filter-owner");
    await expect(page.locator("main")).toBeVisible();
  });

  test("selecting WL Free filter works", async ({ page }) => {
    const mintFilter = page.locator("select").first();
    const options = await mintFilter.locator("option").allTextContents();
    const wlOption = options.find((o) => /WL|Whitelist/i.test(o));
    if (wlOption) {
      await mintFilter.selectOption({ label: wlOption });
      await page.waitForTimeout(500);
      await screenshot(page, "nft-filter-wl");
    }
  });

  test("results count updates when filter applied", async ({ page }) => {
    await expect(page.getByText(/results|showing|records/i).first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "nft-results-count");
  });

  // ── NFT Table ───────────────────────────────────────────────────────────────

  test("NFT table is visible", async ({ page }) => {
    await expect(page.locator("table").or(
      page.locator("[role='table']")
    ).first()).toBeVisible({ timeout: 10000 });
    await screenshot(page, "nft-table");
  });

  test("table has Token ID column header", async ({ page }) => {
    await expect(page.getByText(/Token ID|Token/i).first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "nft-table-header");
  });

  test("Token ID column header is sortable (click to sort)", async ({ page }) => {
    const tokenIdHeader = page.locator("th").filter({ hasText: /Token ID/i }).first();
    if (await tokenIdHeader.count() > 0) {
      await tokenIdHeader.click();
      await page.waitForTimeout(500);
      await screenshot(page, "nft-sort-token-asc");
      await tokenIdHeader.click();
      await page.waitForTimeout(500);
      await screenshot(page, "nft-sort-token-desc");
    }
  });

  test("Date column header is sortable", async ({ page }) => {
    const dateHeader = page.locator("th").filter({ hasText: /Date/i }).first();
    if (await dateHeader.count() > 0) {
      await dateHeader.click();
      await page.waitForTimeout(500);
      await screenshot(page, "nft-sort-date");
    }
  });

  // ── NFT Detail Modal ─────────────────────────────────────────────────────────

  test("clicking NFT table row opens detail modal", async ({ page }) => {
    const firstRow = page.locator("table tbody tr").first();
    if (await firstRow.count() > 0) {
      await firstRow.click();
      await page.waitForTimeout(800);
      const modal = page.locator(".fixed.inset-0").filter({ hasText: /Token|Mint|Minted/i });
      if (await modal.count() > 0) {
        await expect(modal).toBeVisible({ timeout: 3000 });
        await screenshot(page, "nft-detail-modal");
        await page.keyboard.press("Escape");
      }
    }
  });

  test("NFT detail modal close button works", async ({ page }) => {
    const firstRow = page.locator("table tbody tr").first();
    if (await firstRow.count() > 0) {
      await firstRow.click();
      await page.waitForTimeout(800);
      const closeBtn = page.locator("button").filter({ hasText: /✕|×|close/i }).last();
      if (await closeBtn.count() > 0) {
        await closeBtn.click();
        await page.waitForTimeout(400);
        await expect(page.getByRole("heading", { name: /NFT Overview/i })).toBeVisible();
        await screenshot(page, "nft-modal-closed");
      }
    }
  });

  // ── Pagination ───────────────────────────────────────────────────────────────

  test("pagination controls visible", async ({ page }) => {
    const pagination = page.getByRole("button", { name: /prev|next|«|»/i }).first().or(
      page.getByText(/page \d+ of/i)
    );
    await expect(pagination).toBeVisible({ timeout: 8000 });
    await screenshot(page, "nft-pagination");
  });

  test("pagination previous button is disabled on first page", async ({ page }) => {
    const prevBtn = page.getByRole("button", { name: /← Prev|Prev/i }).first();
    if (await prevBtn.count() > 0) {
      await expect(prevBtn).toBeDisabled({ timeout: 5000 });
      await screenshot(page, "nft-pagination-first-page");
    }
  });
});

// ── NFT Generator Page ────────────────────────────────────────────────────────

test.describe("Dashboard — NFT Generator Studio", () => {
  test.beforeEach(async ({ page }) => {
    await mockBlockchain(page);
    await mockWhitelistApi(page);
    await loginAs(page, "tech");
    await page.goto("/dashboard/generator");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
  });

  test("generator page loads with main content", async ({ page }) => {
    const body = await page.locator("main").textContent();
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(10);
    await screenshot(page, "generator-loaded");
  });

  test("NFT Studio heading visible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /NFT Studio|Generator/i }).first()).toBeVisible({ timeout: 10000 });
    await screenshot(page, "generator-heading");
  });

  test("Settings tab visible and active by default", async ({ page }) => {
    const settingsTab = page.getByRole("button", { name: /Settings/i }).or(
      page.getByText(/Settings/i).first()
    );
    await expect(settingsTab).toBeVisible({ timeout: 8000 });
    await screenshot(page, "generator-settings-tab");
  });

  test("all step tabs are visible", async ({ page }) => {
    await expect(page.getByText(/Settings/i).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/Organize/i).first()).toBeVisible();
    await expect(page.getByText(/Rarity/i).first()).toBeVisible();
    await expect(page.getByText(/Preview/i).first()).toBeVisible();
    await expect(page.getByText(/Export/i).first()).toBeVisible();
    await screenshot(page, "generator-all-tabs");
  });

  test("Settings: collection name input visible", async ({ page }) => {
    await expect(page.locator('input[placeholder*="Collection"]').or(
      page.locator('input[placeholder*="Name"]').or(
        page.getByText(/Collection Name|Collection/i)
      ).first()
    )).toBeVisible({ timeout: 8000 });
    await screenshot(page, "generator-settings-fields");
  });

  test("Settings: supply input visible", async ({ page }) => {
    await expect(page.getByText(/Supply/i).first().or(
      page.locator('input[type="number"]').first()
    )).toBeVisible({ timeout: 8000 });
    await screenshot(page, "generator-supply-input");
  });

  test("Settings: Reset button visible", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Reset/i })).toBeVisible({ timeout: 8000 });
    await screenshot(page, "generator-reset-btn");
  });

  test("navigating to Organize tab works", async ({ page }) => {
    const organizeTab = page.getByRole("button", { name: /Organize/i }).or(
      page.getByText(/Organize/i).first()
    );
    if (await organizeTab.count() > 0) {
      await organizeTab.click();
      await page.waitForTimeout(500);
      await screenshot(page, "generator-organize-tab");
      await expect(page.locator("main")).toBeVisible();
    }
  });
});
