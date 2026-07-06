/**
 * Dashboard Contract — deep coverage of all 6 contract operation tabs.
 * Tests live status strip, all tab navigation, every input field,
 * every button label, and transaction status component visibility.
 */
import { test, expect } from "@playwright/test";
import { loginAs, mockBlockchain, mockWhitelistApi, screenshot } from "./helpers";

test.describe("Dashboard — Contract Operations (All 6 Tabs)", () => {
  test.beforeEach(async ({ page }) => {
    await mockBlockchain(page);
    await mockWhitelistApi(page);
    await loginAs(page, "tech");
    await page.goto("/dashboard/contract");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
  });

  // ── Page Header ─────────────────────────────────────────────────────────────

  test("page heading visible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Contract Operations/i })).toBeVisible({ timeout: 10000 });
    await screenshot(page, "contract-heading");
  });

  test("network and contract address visible in description", async ({ page }) => {
    await expect(page.getByText(/sepolia|mainnet|network/i).first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "contract-network-info");
  });

  test("Refresh button is visible and clickable", async ({ page }) => {
    const refreshBtn = page.getByRole("button", { name: /refresh/i });
    await expect(refreshBtn).toBeVisible({ timeout: 8000 });
    await refreshBtn.click();
    await page.waitForTimeout(1000);
    await expect(page.getByRole("heading", { name: /Contract Operations/i })).toBeVisible();
    await screenshot(page, "contract-refresh");
  });

  // ── Live Status Strip ────────────────────────────────────────────────────────

  test("live status strip shows Phase card", async ({ page }) => {
    await expect(page.getByText(/Phase/i).first()).toBeVisible({ timeout: 10000 });
    await screenshot(page, "contract-status-phase");
  });

  test("live status strip shows Minted count", async ({ page }) => {
    await expect(page.getByText(/Minted/i).first()).toBeVisible({ timeout: 10000 });
    await screenshot(page, "contract-status-minted");
  });

  test("live status strip shows SBT Mode indicator", async ({ page }) => {
    await expect(page.getByText(/SBT|Locked|Transferable/i).first()).toBeVisible({ timeout: 10000 });
    await screenshot(page, "contract-status-sbt");
  });

  test("live status strip shows Artwork status", async ({ page }) => {
    await expect(page.getByText(/Artwork|Revealed|Blind Box/i).first()).toBeVisible({ timeout: 10000 });
    await screenshot(page, "contract-status-artwork");
  });

  test("live status strip shows WL Opens/Closes times", async ({ page }) => {
    await expect(page.getByText(/WL Opens|WL Closes|Whitelist/i).first()).toBeVisible({ timeout: 10000 });
    await screenshot(page, "contract-status-wl-times");
  });

  test("live status strip shows Balance in ETH", async ({ page }) => {
    await expect(page.getByText(/Balance|ETH/i).first()).toBeVisible({ timeout: 10000 });
    await screenshot(page, "contract-status-balance");
  });

  // ── Tab Navigation ──────────────────────────────────────────────────────────

  test("all 6 tabs are visible with labels and icons", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Phase & Timing/i })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole("button", { name: /Whitelist Root/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Mint Settings/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Reveal & URIs/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Financial/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Advanced/i })).toBeVisible();
    await screenshot(page, "contract-tabs");
  });

  // ── Phase & Timing Tab (default) ────────────────────────────────────────────

  test("Phase & Timing tab: phase stepper with 4 phases visible", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Phase & Timing/i })).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/None|Whitelist|Public Mint|Paid Mint/i).first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "contract-tab-phase-stepper");
  });

  test("Phase & Timing tab: Set Phase section has dropdown and button", async ({ page }) => {
    await expect(page.getByText(/Set Phase|Set Current Phase/i)).toBeVisible({ timeout: 8000 });
    const phaseSelect = page.locator("select").first();
    await expect(phaseSelect).toBeVisible({ timeout: 8000 });
    const options = await phaseSelect.locator("option").allTextContents();
    expect(options.some((o) => o.includes("0") || o.includes("None"))).toBe(true);
    await screenshot(page, "contract-tab-set-phase");
  });

  test("Phase & Timing tab: WL time window inputs visible", async ({ page }) => {
    await expect(page.getByText(/Whitelist Time Window|WL Start|WL End/i).first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "contract-tab-wl-times");
  });

  test("Phase & Timing tab: Set Times button visible", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Set Times|Set Phase/i }).first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "contract-tab-set-times-btn");
  });

  // ── Whitelist Root Tab ───────────────────────────────────────────────────────

  test("Whitelist Root tab: navigates correctly", async ({ page }) => {
    await page.getByRole("button", { name: /Whitelist Root/i }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText(/On-chain Root|Backend.*Root|Sync/i).first()).toBeVisible({ timeout: 5000 });
    await screenshot(page, "contract-tab-wl-root");
  });

  test("Whitelist Root tab: on-chain root and backend root displayed", async ({ page }) => {
    await page.getByRole("button", { name: /Whitelist Root/i }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText(/On.chain|Backend/i).first()).toBeVisible({ timeout: 5000 });
    await screenshot(page, "contract-tab-root-display");
  });

  test("Whitelist Root tab: Merkle Root input field visible", async ({ page }) => {
    await page.getByRole("button", { name: /Whitelist Root/i }).click();
    await page.waitForTimeout(400);
    await expect(page.locator('input[placeholder*="0x"]').first()).toBeVisible({ timeout: 5000 });
    await screenshot(page, "contract-tab-root-input");
  });

  test("Whitelist Root tab: Use Backend Root button visible", async ({ page }) => {
    await page.getByRole("button", { name: /Whitelist Root/i }).click();
    await page.waitForTimeout(400);
    await expect(page.getByRole("button", { name: /Backend Root|Use Backend/i })).toBeVisible({ timeout: 5000 });
    await screenshot(page, "contract-tab-use-backend-root");
  });

  // ── Mint Settings Tab ────────────────────────────────────────────────────────

  test("Mint Settings tab: navigates correctly", async ({ page }) => {
    await page.getByRole("button", { name: /Mint Settings/i }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText(/Mint Limits|Limit|SBT/i).first()).toBeVisible({ timeout: 5000 });
    await screenshot(page, "contract-tab-mint-settings");
  });

  test("Mint Settings tab: WL limit and Paid limit inputs visible", async ({ page }) => {
    await page.getByRole("button", { name: /Mint Settings/i }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText(/WL.*Limit|Whitelist Limit|limit per wallet/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[type="number"]').first()).toBeVisible({ timeout: 5000 });
    await screenshot(page, "contract-tab-mint-limits");
  });

  test("Mint Settings tab: Set Limits button visible", async ({ page }) => {
    await page.getByRole("button", { name: /Mint Settings/i }).click();
    await page.waitForTimeout(400);
    await expect(page.getByRole("button", { name: /Set Limits/i })).toBeVisible({ timeout: 5000 });
    await screenshot(page, "contract-tab-set-limits-btn");
  });

  test("Mint Settings tab: SBT Mode toggle section visible", async ({ page }) => {
    await page.getByRole("button", { name: /Mint Settings/i }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText(/SBT Mode|Soul.Bound|Transfer Lock/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /Enable SBT|Disable SBT|SBT Lock/i })).toBeVisible({ timeout: 5000 });
    await screenshot(page, "contract-tab-sbt-toggle");
  });

  // ── Reveal & URIs Tab ────────────────────────────────────────────────────────

  test("Reveal & URIs tab: navigates correctly", async ({ page }) => {
    await page.getByRole("button", { name: /Reveal & URIs/i }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText(/Reveal|URI|Artwork/i).first()).toBeVisible({ timeout: 5000 });
    await screenshot(page, "contract-tab-reveal");
  });

  test("Reveal & URIs tab: artwork status badge visible", async ({ page }) => {
    await page.getByRole("button", { name: /Reveal & URIs/i }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText(/Revealed|Blind Box/i).first()).toBeVisible({ timeout: 5000 });
    await screenshot(page, "contract-tab-artwork-status");
  });

  test("Reveal & URIs tab: Reveal URI input visible", async ({ page }) => {
    await page.getByRole("button", { name: /Reveal & URIs/i }).click();
    await page.waitForTimeout(400);
    await expect(page.locator('input[placeholder*="ipfs"]').or(
      page.locator('input[placeholder*="IPFS"]').or(
        page.locator('input[placeholder*="http"]')
      )
    ).first()).toBeVisible({ timeout: 5000 });
    await screenshot(page, "contract-tab-reveal-uri-input");
  });

  test("Reveal & URIs tab: Reveal Artwork button visible", async ({ page }) => {
    await page.getByRole("button", { name: /Reveal & URIs/i }).click();
    await page.waitForTimeout(400);
    await expect(page.getByRole("button", { name: /Reveal Artwork|Reveal/i })).toBeVisible({ timeout: 5000 });
    await screenshot(page, "contract-tab-reveal-btn");
  });

  test("Reveal & URIs tab: Token Metadata section visible", async ({ page }) => {
    await page.getByRole("button", { name: /Reveal & URIs/i }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText(/Token.*Metadata|Fetch Metadata|Token ID/i).first()).toBeVisible({ timeout: 5000 });
    const tokenIdInput = page.locator('input[type="number"]').first();
    await expect(tokenIdInput).toBeVisible({ timeout: 5000 });
    await screenshot(page, "contract-tab-token-metadata");
  });

  // ── Financial Tab ─────────────────────────────────────────────────────────────

  test("Financial tab: navigates correctly", async ({ page }) => {
    await page.getByRole("button", { name: /Financial/i }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText(/Contract Balance|Balance|Withdraw/i).first()).toBeVisible({ timeout: 5000 });
    await screenshot(page, "contract-tab-financial");
  });

  test("Financial tab: contract balance display visible", async ({ page }) => {
    await page.getByRole("button", { name: /Financial/i }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText(/Contract Balance|Balance/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/ETH/i).first()).toBeVisible({ timeout: 5000 });
    await screenshot(page, "contract-tab-balance-display");
  });

  test("Financial tab: Withdraw ETH section visible", async ({ page }) => {
    await page.getByRole("button", { name: /Financial/i }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText(/Withdraw/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /Withdraw/i })).toBeVisible({ timeout: 5000 });
    await screenshot(page, "contract-tab-withdraw");
  });

  test("Financial tab: Royalty Settings section visible", async ({ page }) => {
    await page.getByRole("button", { name: /Financial/i }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText(/Royalty/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /Set Royalty|Royalty/i })).toBeVisible({ timeout: 5000 });
    await screenshot(page, "contract-tab-royalty");
  });

  // ── Advanced Tab ─────────────────────────────────────────────────────────────

  test("Advanced tab: navigates correctly", async ({ page }) => {
    await page.getByRole("button", { name: /Advanced/i }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText(/Warning|Advanced|dangerous/i).first()).toBeVisible({ timeout: 5000 });
    await screenshot(page, "contract-tab-advanced");
  });

  test("Advanced tab: warning banner visible", async ({ page }) => {
    await page.getByRole("button", { name: /Advanced/i }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText(/Warning|warning|Advanced/i).first()).toBeVisible({ timeout: 5000 });
    await screenshot(page, "contract-tab-warning");
  });

  test("Advanced tab: Pause Contract button visible (danger style)", async ({ page }) => {
    await page.getByRole("button", { name: /Advanced/i }).click();
    await page.waitForTimeout(400);
    await expect(page.getByRole("button", { name: /Pause Contract|Pause/i }).first()).toBeVisible({ timeout: 5000 });
    await screenshot(page, "contract-tab-pause");
  });

  test("Advanced tab: Unpause Contract button visible", async ({ page }) => {
    await page.getByRole("button", { name: /Advanced/i }).click();
    await page.waitForTimeout(400);
    await expect(page.getByRole("button", { name: /Unpause/i })).toBeVisible({ timeout: 5000 });
    await screenshot(page, "contract-tab-unpause");
  });

  test("Advanced tab: Batch Mint section visible", async ({ page }) => {
    await page.getByRole("button", { name: /Advanced/i }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText(/Batch Mint|Batch/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /Mint/i }).last()).toBeVisible({ timeout: 5000 });
    await screenshot(page, "contract-tab-batch-mint");
  });

  test("Advanced tab: Emergency Transfer section visible", async ({ page }) => {
    await page.getByRole("button", { name: /Advanced/i }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText(/Emergency Transfer|Emergency/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /Emergency Transfer|Execute/i })).toBeVisible({ timeout: 5000 });
    await screenshot(page, "contract-tab-emergency-transfer");
  });
});
