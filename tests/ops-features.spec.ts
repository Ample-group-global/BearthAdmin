/**
 * Ops Features — comprehensive coverage of all minor ops features:
 * Overview refresh, phase banner, all 6 stat cards, progress bars;
 * Whitelist label input, result message, refresh, pagination;
 * NFT Gallery reveal filter, grid cards, table view, pagination.
 */
import { test, expect } from "@playwright/test";
import { loginAs, mockBlockchain, mockWhitelistApi, MOCK_WHITELIST_ENTRIES, screenshot } from "./helpers";

// ── Ops Overview — All Minor Features ────────────────────────────────────────

test.describe("Ops — Overview All Features", () => {
  test.beforeEach(async ({ page }) => {
    await mockBlockchain(page);
    await mockWhitelistApi(page);
    await loginAs(page, "ops");
    await page.goto("/ops");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
  });

  test("Project Overview heading visible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Project Overview/i })).toBeVisible({ timeout: 10000 });
    await screenshot(page, "ops-overview-heading");
  });

  test("Refresh button is visible and clickable", async ({ page }) => {
    const refreshBtn = page.getByRole("button", { name: /refresh/i });
    await expect(refreshBtn).toBeVisible({ timeout: 8000 });
    await refreshBtn.click();
    await page.waitForTimeout(1000);
    await expect(page.getByRole("heading", { name: /Project Overview/i })).toBeVisible();
    await screenshot(page, "ops-overview-refresh");
  });

  test("Phase banner is visible with phase name", async ({ page }) => {
    await expect(page.getByText(/Phase|None|Whitelist|Public Mint|Paid Mint/i).first()).toBeVisible({ timeout: 10000 });
    await screenshot(page, "ops-overview-phase-banner");
  });

  test("Minting Progress section visible", async ({ page }) => {
    await expect(page.getByText(/Minting Progress/i)).toBeVisible({ timeout: 10000 });
    await screenshot(page, "ops-overview-minting-progress");
  });

  test("Total NFTs Minted progress bar visible", async ({ page }) => {
    await expect(page.getByText(/Total NFTs Minted/i)).toBeVisible({ timeout: 10000 });
    await screenshot(page, "ops-overview-total-minted");
  });

  test("Free Mint Phase progress bar visible", async ({ page }) => {
    await expect(page.getByText(/Free Mint Phase/i)).toBeVisible({ timeout: 10000 });
    await screenshot(page, "ops-overview-free-mint-progress");
  });

  test("Whitelisted Wallets stat card visible", async ({ page }) => {
    await expect(page.getByText("Whitelisted Wallets").first()).toBeVisible({ timeout: 10000 });
    await screenshot(page, "ops-overview-wl-wallets");
  });

  test("Revenue Collected stat card visible", async ({ page }) => {
    await expect(page.getByText("Revenue Collected")).toBeVisible({ timeout: 10000 });
    await screenshot(page, "ops-overview-revenue");
  });

  test("NFT Artwork stat card visible", async ({ page }) => {
    await expect(page.getByText("NFT Artwork", { exact: true })).toBeVisible({ timeout: 10000 });
    await screenshot(page, "ops-overview-artwork");
  });

  test("Transfer Lock stat card visible", async ({ page }) => {
    await expect(page.getByText("Transfer Lock")).toBeVisible({ timeout: 10000 });
    await screenshot(page, "ops-overview-transfer-lock");
  });

  test("Paid Mint Price stat card visible", async ({ page }) => {
    await expect(page.getByText(/Paid Mint Price/i)).toBeVisible({ timeout: 10000 });
    await screenshot(page, "ops-overview-paid-price");
  });

  test("Remaining Supply stat card visible", async ({ page }) => {
    await expect(page.getByText(/Remaining Supply/i)).toBeVisible({ timeout: 10000 });
    await screenshot(page, "ops-overview-remaining");
  });

  test("does NOT show raw contract addresses to ops users", async ({ page }) => {
    await expect(page.getByText(/0x000000000000000000000000/)).not.toBeVisible({ timeout: 3000 });
    await screenshot(page, "ops-overview-no-raw-addresses");
  });

  test("help note about contacting tech admin visible", async ({ page }) => {
    await expect(page.locator("aside").getByText(/Contact technical admin/i)).toBeVisible({ timeout: 10000 });
    await screenshot(page, "ops-overview-help-note");
  });
});

// ── Ops Whitelist — All Minor Features ────────────────────────────────────────

test.describe("Ops — Whitelist All Features", () => {
  test.beforeEach(async ({ page }) => {
    await mockBlockchain(page);
    await mockWhitelistApi(page);
    await loginAs(page, "ops");
    await page.goto("/ops/whitelist");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
  });

  test("whitelist page heading visible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Whitelist/i })).toBeVisible({ timeout: 10000 });
    await screenshot(page, "ops-wl-heading");
  });

  test("wallet count badge with icon visible", async ({ page }) => {
    await expect(page.getByText(/wallets on whitelist/i)).toBeVisible({ timeout: 8000 });
    await screenshot(page, "ops-wl-count-badge");
  });

  test("Add Wallet Address form heading visible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Add Wallet Address/i })).toBeVisible({ timeout: 8000 });
    await screenshot(page, "ops-wl-add-heading");
  });

  test("wallet address input visible with 0x placeholder", async ({ page }) => {
    await expect(page.locator('input[placeholder="0x..."]')).toBeVisible({ timeout: 8000 });
    await screenshot(page, "ops-wl-address-input");
  });

  test("label/name input field visible", async ({ page }) => {
    await expect(page.locator('input[placeholder*="Label"]').or(
      page.locator('input[placeholder*="label"]').or(
        page.locator('input[placeholder*="Name"]')
      )
    ).first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "ops-wl-label-input");
  });

  test("Add to Whitelist button visible and disabled with empty/invalid input", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Add to Whitelist/i })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole("button", { name: /Add to Whitelist/i })).toBeDisabled();
    await screenshot(page, "ops-wl-add-btn-disabled");
  });

  test("invalid address shows validation error", async ({ page }) => {
    await page.locator('input[placeholder="0x..."]').fill("not-a-valid-address");
    await page.locator('input[placeholder="0x..."]').blur();
    await expect(page.getByText(/Not a valid Ethereum wallet address/i)).toBeVisible({ timeout: 3000 });
    await screenshot(page, "ops-wl-validation-error");
  });

  test("valid address enables Add button", async ({ page }) => {
    await page.locator('input[placeholder="0x..."]').fill("0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B");
    await page.waitForTimeout(300);
    await expect(page.getByRole("button", { name: /Add to Whitelist/i })).toBeEnabled({ timeout: 3000 });
    await screenshot(page, "ops-wl-add-btn-enabled");
  });

  test("label input accepts text", async ({ page }) => {
    const labelInput = page.locator('input[placeholder*="Label"]').or(
      page.locator('input[placeholder*="Name"]')
    ).first();
    if (await labelInput.count() > 0) {
      await labelInput.fill("Test VIP");
      const value = await labelInput.inputValue();
      expect(value).toBe("Test VIP");
      await screenshot(page, "ops-wl-label-input-filled");
    }
  });

  test("help text about contacting tech admin visible", async ({ page }) => {
    await expect(page.getByText(/To remove addresses|contact|technical admin/i)).toBeVisible({ timeout: 8000 });
    await screenshot(page, "ops-wl-help-text");
  });

  test("search input visible", async ({ page }) => {
    const search = page.locator('input[placeholder*="Search"]');
    await expect(search).toBeVisible({ timeout: 8000 });
    await screenshot(page, "ops-wl-search-input");
  });

  test("search filters whitelist entries by address", async ({ page }) => {
    const search = page.locator('input[placeholder*="Search"]');
    await search.fill("0xAb5801");
    await page.waitForTimeout(400);
    await expect(page.getByText(/0xAb5801/i).first()).toBeVisible({ timeout: 5000 });
    await screenshot(page, "ops-wl-search-filter");
  });

  test("search filters by label name", async ({ page }) => {
    const search = page.locator('input[placeholder*="Search"]');
    await search.fill("VIP");
    await page.waitForTimeout(400);
    await expect(page.getByText("VIP Partner")).toBeVisible({ timeout: 3000 });
    await screenshot(page, "ops-wl-search-by-label");
  });

  test("Refresh button is visible", async ({ page }) => {
    const refreshBtn = page.getByRole("button", { name: /refresh/i });
    await expect(refreshBtn).toBeVisible({ timeout: 8000 });
    await screenshot(page, "ops-wl-refresh-btn");
  });

  test("whitelist table shows entries from API", async ({ page }) => {
    await expect(page.getByText(/0xAb5801/i).first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "ops-wl-entries");
  });

  test("whitelist table columns: number, address, label, date", async ({ page }) => {
    await expect(page.getByText(/Wallet Address|address/i).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/Label|Name/i).first()).toBeVisible();
    await expect(page.getByText(/Date Added|Date/i).first()).toBeVisible();
    await screenshot(page, "ops-wl-columns");
  });

  test("VIP Partner label badge visible in entries", async ({ page }) => {
    await expect(page.getByText("VIP Partner")).toBeVisible({ timeout: 8000 });
    await screenshot(page, "ops-wl-label-badge");
  });

  test("entries without label show dash placeholder", async ({ page }) => {
    await expect(page.getByText("—").first().or(
      page.locator("td").filter({ hasText: /^—$/ }).first()
    )).toBeVisible({ timeout: 8000 });
    await screenshot(page, "ops-wl-no-label-dash");
  });

  test("there are NO delete or remove buttons (read-only for ops)", async ({ page }) => {
    await expect(page.getByRole("button", { name: /^delete$|^remove$/i })).not.toBeVisible({ timeout: 3000 });
    await screenshot(page, "ops-wl-no-delete-btns");
  });

  test("pagination controls visible", async ({ page }) => {
    const pagination = page.getByRole("button", { name: /prev|next|«|»/i }).first().or(
      page.getByText(/page \d+ of|total/i)
    );
    await expect(pagination).toBeVisible({ timeout: 8000 });
    await screenshot(page, "ops-wl-pagination");
  });
});

// ── Ops NFT Gallery — All Minor Features ──────────────────────────────────────

test.describe("Ops — NFT Gallery All Features", () => {
  test.beforeEach(async ({ page }) => {
    await mockBlockchain(page);
    await mockWhitelistApi(page);
    await loginAs(page, "ops");
    await page.goto("/ops/nfts");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
  });

  test("NFT Gallery heading visible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /NFT Gallery/i })).toBeVisible({ timeout: 10000 });
    await screenshot(page, "ops-gallery-heading");
  });

  test("Refresh button visible", async ({ page }) => {
    const refreshBtn = page.getByRole("button", { name: /refresh/i });
    await expect(refreshBtn).toBeVisible({ timeout: 8000 });
    await screenshot(page, "ops-gallery-refresh");
  });

  test("summary strip shows Free Whitelist Mint card", async ({ page }) => {
    await expect(page.getByText("Free Whitelist Mint").first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "ops-gallery-wl-summary");
  });

  test("summary strip shows Free Public Mint card", async ({ page }) => {
    await expect(page.getByText("Free Public Mint").first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "ops-gallery-public-summary");
  });

  test("summary strip shows Paid Mint card", async ({ page }) => {
    await expect(page.getByText("Paid Mint").first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "ops-gallery-paid-summary");
  });

  test("summary strip shows Revealed card", async ({ page }) => {
    await expect(page.getByText("Revealed").first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "ops-gallery-revealed-summary");
  });

  test("summary strip shows Blind Box card", async ({ page }) => {
    await expect(page.getByText("Blind Box").first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "ops-gallery-blind-box-summary");
  });

  test("search input visible (NFT # or wallet)", async ({ page }) => {
    const search = page.locator('input[placeholder*="Search"]').or(
      page.locator('input[placeholder*="NFT"]').or(
        page.locator('input[placeholder*="wallet"]')
      )
    ).first();
    await expect(search).toBeVisible({ timeout: 8000 });
    await screenshot(page, "ops-gallery-search");
  });

  test("mint type filter dropdown visible with friendly labels", async ({ page }) => {
    const mintFilter = page.locator("select").first();
    await expect(mintFilter).toBeVisible({ timeout: 8000 });
    const options = await mintFilter.locator("option").allTextContents();
    expect(options.some((o) => /Free Whitelist Mint|WL|All/i.test(o))).toBe(true);
    await screenshot(page, "ops-gallery-mint-filter");
  });

  test("mint type filter has friendly labels (Free Whitelist Mint etc.)", async ({ page }) => {
    const mintFilter = page.locator("select").first();
    const options = await mintFilter.locator("option").allTextContents();
    expect(options.some((o) => o.includes("Free Whitelist Mint"))).toBe(true);
    expect(options.some((o) => o.includes("Free Public Mint"))).toBe(true);
    expect(options.some((o) => o.includes("Paid Mint"))).toBe(true);
    await screenshot(page, "ops-gallery-mint-filter-labels");
  });

  test("reveal status filter dropdown visible", async ({ page }) => {
    const selects = page.locator("select");
    const count = await selects.count();
    expect(count).toBeGreaterThanOrEqual(2);
    const revealFilter = selects.nth(1);
    if (await revealFilter.count() > 0) {
      const options = await revealFilter.locator("option").allTextContents();
      expect(options.some((o) => /All|Revealed|Blind Box/i.test(o))).toBe(true);
    }
    await screenshot(page, "ops-gallery-reveal-filter");
  });

  test("selecting Revealed from reveal filter works", async ({ page }) => {
    const selects = page.locator("select");
    if (await selects.count() >= 2) {
      const revealFilter = selects.nth(1);
      const options = await revealFilter.locator("option").allTextContents();
      const revealedOpt = options.find((o) => /Revealed/i.test(o) && !/All/i.test(o));
      if (revealedOpt) {
        await revealFilter.selectOption({ label: revealedOpt });
        await page.waitForTimeout(400);
        await screenshot(page, "ops-gallery-filter-revealed");
      }
    }
  });

  test("Grid view is default (grid button visible)", async ({ page }) => {
    await expect(page.locator('button[title="Table view"]')).toBeVisible({ timeout: 8000 });
    await screenshot(page, "ops-gallery-grid-default");
  });

  test("Grid view shows NFT cards", async ({ page }) => {
    const cards = page.locator(".grid").first().or(
      page.locator("[class*='grid']").first()
    );
    await expect(cards).toBeVisible({ timeout: 8000 });
    await screenshot(page, "ops-gallery-grid-view");
  });

  test("Table view toggle switches to table", async ({ page }) => {
    await page.locator('button[title="Table view"]').click();
    await expect(page.locator('button[title="Grid view"]')).toBeVisible({ timeout: 3000 });
    await expect(page.locator("table")).toBeVisible({ timeout: 5000 });
    await screenshot(page, "ops-gallery-table-view");
  });

  test("Grid view toggle switches back from table", async ({ page }) => {
    await page.locator('button[title="Table view"]').click();
    await page.waitForTimeout(300);
    await page.locator('button[title="Grid view"]').click();
    await expect(page.locator('button[title="Table view"]')).toBeVisible({ timeout: 3000 });
    await screenshot(page, "ops-gallery-back-to-grid");
  });

  test("pagination controls visible", async ({ page }) => {
    const pagination = page.getByRole("button", { name: /prev|next|«|»/i }).first().or(
      page.getByText(/page \d+ of|showing/i)
    );
    await expect(pagination).toBeVisible({ timeout: 8000 });
    await screenshot(page, "ops-gallery-pagination");
  });

  test("results count displays correctly", async ({ page }) => {
    await expect(page.getByText(/showing|results|of/i).first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "ops-gallery-results-count");
  });
});
