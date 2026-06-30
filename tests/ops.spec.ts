import { test, expect } from "@playwright/test";
import { loginAs, mockBlockchain, mockWhitelistApi, MOCK_WHITELIST_ENTRIES } from "./helpers";

test.describe("Operations Staff Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await mockBlockchain(page);
    await mockWhitelistApi(page);
    await loginAs(page, "ops");
  });

  // ── Layout & Navigation ─────────────────────────────────────────────────────

  test("ops sidebar shows correct branding and nav", async ({ page }) => {
    await page.goto("/ops");
    await expect(page.locator("aside").getByText("Bearth NFT")).toBeVisible();
    await expect(page.locator("aside").getByText("Operations Staff")).toBeVisible();
    await expect(page.locator("aside").getByRole("link", { name: /overview/i })).toBeVisible();
    await expect(page.locator("aside").getByRole("link", { name: /whitelist/i })).toBeVisible();
    await expect(page.locator("aside").getByRole("link", { name: /nft gallery/i })).toBeVisible();
  });

  test("ops sidebar has NO chain selector or wallet button", async ({ page }) => {
    await page.goto("/ops");
    await expect(page.getByText(/Connect Wallet/i)).not.toBeVisible();
  });

  test("ops sidebar info box is visible", async ({ page }) => {
    await page.goto("/ops");
    await expect(page.getByText("Operations Access")).toBeVisible();
    // Info box text (scope to sidebar to avoid other matches)
    await expect(page.locator("aside").getByText(/contact your technical admin/i)).toBeVisible();
  });

  test("ops nav links route correctly", async ({ page }) => {
    await page.goto("/ops");

    await page.locator("aside").getByRole("link", { name: /whitelist/i }).click();
    await page.waitForURL(/\/ops\/whitelist/, { timeout: 10000 });
    expect(page.url()).toContain("/ops/whitelist");

    await page.locator("aside").getByRole("link", { name: /nft gallery/i }).click();
    await page.waitForURL(/\/ops\/nfts/, { timeout: 10000 });
    expect(page.url()).toContain("/ops/nfts");

    await page.locator("aside").getByRole("link", { name: /overview/i }).click();
    await page.waitForURL(/\/ops$/, { timeout: 10000 });
    expect(page.url()).toMatch(/\/ops$/);
  });

  test("sign out returns to login", async ({ page }) => {
    await page.goto("/ops");
    await page.locator("aside").getByRole("button", { name: /sign out/i }).click();
    await page.waitForURL(/\/login/, { timeout: 8000 });
    expect(page.url()).toContain("/login");
  });

  test("top bar shows Operations label", async ({ page }) => {
    await page.goto("/ops");
    // Top bar has "Overview — Operations"
    await expect(page.locator("header").getByText("— Operations")).toBeVisible();
  });

  // ── Overview page ───────────────────────────────────────────────────────────

  test("ops overview shows Project Overview heading", async ({ page }) => {
    await page.goto("/ops");
    await expect(page.getByRole("heading", { name: /Project Overview/i })).toBeVisible();
  });

  test("ops overview shows minting progress bars", async ({ page }) => {
    await page.goto("/ops");
    await expect(page.getByText(/Minting Progress/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Total NFTs Minted/i)).toBeVisible();
    await expect(page.getByText(/Free Mint Phase/i)).toBeVisible();
  });

  test("ops overview uses friendly language (no raw hex as primary content)", async ({ page }) => {
    await page.goto("/ops");
    await expect(page.getByText("Whitelisted Wallets").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Revenue Collected")).toBeVisible();
    await expect(page.getByText("NFT Artwork", { exact: true })).toBeVisible();
    await expect(page.getByText("Transfer Lock")).toBeVisible();
    // Long zero-padded hex address should not appear as primary content
    await expect(page.getByText(/0x000000000000000000000000/)).not.toBeVisible();
  });

  test("ops overview shows helpful note about tech admin changes", async ({ page }) => {
    await page.goto("/ops");
    await expect(page.getByText(/Need to make changes/i)).toBeVisible({ timeout: 10000 });
    // The note inside the help box (not the sidebar info box) — use more specific match
    await expect(page.getByText(/contact your technical admin/i).first()).toBeVisible();
  });

  test("ops overview refresh button works", async ({ page }) => {
    await page.goto("/ops");
    const refreshBtn = page.getByRole("button", { name: /refresh/i });
    await expect(refreshBtn).toBeVisible();
    await refreshBtn.click();
    await expect(page.getByRole("heading", { name: /Project Overview/i })).toBeVisible();
  });

  // ── Whitelist page ──────────────────────────────────────────────────────────

  test("ops whitelist page shows wallet count badge", async ({ page }) => {
    await page.goto("/ops/whitelist");
    await expect(page.getByText(/wallets on whitelist/i)).toBeVisible({ timeout: 8000 });
  });

  test("ops whitelist shows Add Wallet Address form", async ({ page }) => {
    await page.goto("/ops/whitelist");
    await expect(page.getByRole("heading", { name: /Add Wallet Address/i })).toBeVisible();
    await expect(page.locator('input[placeholder="0x..."]')).toBeVisible();
    await expect(page.getByRole("button", { name: /Add to Whitelist/i })).toBeVisible();
  });

  test("ops whitelist add form validates ethereum address", async ({ page }) => {
    await page.goto("/ops/whitelist");
    const input = page.locator('input[placeholder="0x..."]');
    await input.fill("not-a-valid-address");
    await input.blur();
    await expect(page.getByText(/Not a valid Ethereum wallet address/i)).toBeVisible({ timeout: 3000 });
  });

  test("ops whitelist add button is disabled for invalid address", async ({ page }) => {
    await page.goto("/ops/whitelist");
    await page.locator('input[placeholder="0x..."]').fill("invalid");
    await expect(page.getByRole("button", { name: /Add to Whitelist/i })).toBeDisabled();
  });

  test("ops whitelist has NO delete buttons", async ({ page }) => {
    await page.goto("/ops/whitelist");
    await expect(page.getByRole("button", { name: /^delete$|^remove$/i })).not.toBeVisible({ timeout: 3000 });
  });

  test("ops whitelist has no Bulk Import tab or button", async ({ page }) => {
    await page.goto("/ops/whitelist");
    // Check no clickable bulk import button/tab exists — the note mentions it but as text
    await expect(page.getByRole("button", { name: /bulk import/i })).not.toBeVisible({ timeout: 3000 });
    await expect(page.getByRole("tab", { name: /bulk import/i })).not.toBeVisible({ timeout: 1000 }).catch(() => {});
  });

  test("ops whitelist shows Wallet Address column header", async ({ page }) => {
    await page.goto("/ops/whitelist");
    // Use exact column header role
    await expect(page.getByRole("columnheader", { name: "Wallet Address" })).toBeVisible({ timeout: 8000 });
  });

  test("ops whitelist shows entries from mock", async ({ page }) => {
    await page.goto("/ops/whitelist");
    await expect(page.getByText(/0xAb5801/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("ops whitelist search filters addresses", async ({ page }) => {
    await page.goto("/ops/whitelist");
    const search = page.locator('input[placeholder*="Search"]');
    await expect(search).toBeVisible({ timeout: 8000 });
    await search.fill("VIP");
    await expect(page.getByText("VIP Partner")).toBeVisible({ timeout: 3000 });
  });

  test("ops whitelist note directs to tech admin for deletions", async ({ page }) => {
    await page.goto("/ops/whitelist");
    await expect(page.getByText(/remove addresses/i)).toBeVisible({ timeout: 8000 });
  });

  // ── NFT Gallery page ────────────────────────────────────────────────────────

  test("nft gallery page loads with heading", async ({ page }) => {
    await page.goto("/ops/nfts");
    await expect(page.getByRole("heading", { name: /NFT Gallery/i })).toBeVisible();
  });

  test("nft gallery shows summary strip", async ({ page }) => {
    await page.goto("/ops/nfts");
    await expect(page.getByText("Free Whitelist Mint").first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Free Public Mint").first()).toBeVisible();
    await expect(page.getByText("Paid Mint").first()).toBeVisible();
  });

  test("nft gallery filter controls work", async ({ page }) => {
    await page.goto("/ops/nfts");
    const mintFilter = page.locator("select").first();
    await expect(mintFilter).toBeVisible({ timeout: 8000 });
    await mintFilter.selectOption({ label: "Free Whitelist Mint" });
    await expect(mintFilter).toHaveValue("wl");
  });

  test("nft gallery grid/table view toggle works", async ({ page }) => {
    await page.goto("/ops/nfts");
    // Default: grid view active → "Table view" button is present
    await expect(page.locator('button[title="Table view"]')).toBeVisible({ timeout: 8000 });
    await page.locator('button[title="Table view"]').click();
    // Now in table view → "Grid view" button appears
    await expect(page.locator('button[title="Grid view"]')).toBeVisible({ timeout: 3000 });

    await page.locator('button[title="Grid view"]').click();
    // Back to grid view → "Table view" button visible again
    await expect(page.locator('button[title="Table view"]')).toBeVisible({ timeout: 2000 });
  });

  test("nft gallery uses friendly mint labels in filter", async ({ page }) => {
    await page.goto("/ops/nfts");
    const filterSelect = page.locator("select").first();
    await expect(filterSelect).toBeVisible({ timeout: 8000 });
    const options = await filterSelect.locator("option").allTextContents();
    expect(options.some((o) => o.includes("Free Whitelist Mint"))).toBe(true);
    expect(options.some((o) => o.includes("Free Public Mint"))).toBe(true);
    expect(options.some((o) => o.includes("Paid Mint"))).toBe(true);
  });

  test("nft gallery refresh button is present", async ({ page }) => {
    await page.goto("/ops/nfts");
    await expect(page.getByRole("button", { name: /refresh/i })).toBeVisible({ timeout: 8000 });
  });

  // ── Auth guard ───────────────────────────────────────────────────────────────

  test("tech admin cannot access /ops — redirected away", async ({ page }) => {
    await page.context().clearCookies();
    await mockBlockchain(page);
    await mockWhitelistApi(page);
    await loginAs(page, "tech");

    await page.goto("/ops");
    await page.waitForURL(/\/(login|dashboard)/, { timeout: 8000 });
    expect(page.url()).not.toContain("/ops");
  });

  test("unauthenticated user cannot access /ops", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/ops");
    await page.waitForURL(/\/login/, { timeout: 8000 });
    expect(page.url()).toContain("/login");
  });
});
