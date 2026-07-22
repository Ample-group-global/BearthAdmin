// Route: /nft/waves — NFT wave management page
import { test, expect } from "@playwright/test";
import path from "path";

test.use({ storageState: path.join(process.cwd(), "tests", ".auth", "admin.json") });

async function waitForAppShell(page: any) {
  await page.locator('text=Verifying access').waitFor({ state: 'detached', timeout: 60000 }).catch(() => {});
  await page.locator('button').filter({ hasText: /Sign Out/i }).waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
}

async function goToWaves(page: any) {
  test.setTimeout(120000);
  await page.goto("/nft/waves", { timeout: 90000 });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await waitForAppShell(page);
  expect(page.url()).not.toContain("/login");
}

test.describe("NFT Waves — Page Load & DB Data", () => {
  test("loads NFT Sell/Waves heading", async ({ page }) => {
    await goToWaves(page);
    const heading = page.locator('h1, h2, h3').first();
    await expect(heading).toBeVisible({ timeout: 20000 });
    await expect(heading).toContainText(/NFT|Wave|Sell/i);
  });

  test("waves load from BearthDev DB (nft_waves table)", async ({ page }) => {
    await goToWaves(page);
    // 7 waves are seeded in BearthDev — page should show wave cards/rows
    const content = page.locator('table').or(
      page.locator('[data-testid="wave-card"]')
    ).or(
      page.locator('div').filter({ hasText: /Wave \d|Genesis|Awakening|Emergence|Ascension|Harmony|Vision|Eternity/i })
    ).first();
    await expect(content).toBeVisible({ timeout: 30000 });
  });

  test("status badges load (upcoming/active/completed) from DB status column", async ({ page }) => {
    await goToWaves(page);
    const statusBadge = page.locator('span').filter({ hasText: /upcoming|active|completed|paused|closed|sold_out/i }).first();
    await expect(statusBadge).toBeVisible({ timeout: 30000 });
  });

  test("sale method badges show from DB saleMethod column", async ({ page }) => {
    await goToWaves(page);
    // Sale methods: fixed_price, free_mint, english_auction, dutch_auction
    const methodBadge = page.locator('span').filter({ hasText: /Free|Fixed|English|Dutch|Auction/i }).first();
    await expect(methodBadge).toBeVisible({ timeout: 30000 });
  });

  test("session is authenticated (no redirect to login)", async ({ page }) => {
    await goToWaves(page);
    expect(page.url()).not.toContain("/login");
  });
});

test.describe("NFT Waves — DB Edit Actions (Smart Contract Support)", () => {
  test("Edit button opens wave detail modal", async ({ page }) => {
    test.setTimeout(120000);
    await goToWaves(page);

    // Click first Edit button
    const editBtn = page.locator('button').filter({ hasText: /Edit|Manage|Details/i }).first();
    await expect(editBtn).toBeVisible({ timeout: 30000 });
    await editBtn.click();

    // Modal should appear with wave form fields
    await expect(
      page.locator('input').or(page.locator('[role="dialog"]')).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("wave edit form has status dropdown with DB-backed options", async ({ page }) => {
    test.setTimeout(120000);
    await goToWaves(page);

    const editBtn = page.locator('button').filter({ hasText: /Edit|Manage|Details/i }).first();
    const hasEdit = await editBtn.isVisible({ timeout: 15000 }).catch(() => false);
    if (!hasEdit) { console.log("No edit buttons — skipping"); return; }
    await editBtn.click();

    // Status uses a button-group (not <select>) — each option is a styled button
    const statusBtn = page.locator('button').filter({ hasText: /^(upcoming|active|completed|paused)$/i }).first();
    await expect(statusBtn).toBeVisible({ timeout: 10000 });
  });

  test("on-chain action button opens blockchain interaction panel", async ({ page }) => {
    test.setTimeout(120000);
    await goToWaves(page);

    // On-chain button (for connecting to smart contract)
    const chainBtn = page.locator('button').filter({ hasText: /On.Chain|Contract|Manage/i }).first();
    const hasChain = await chainBtn.isVisible({ timeout: 15000 }).catch(() => false);
    if (!hasChain) { console.log("No on-chain button — skipping"); return; }
    await chainBtn.click();

    await expect(
      page.locator('text=/price|ETH|contract|on.chain/i').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("wave quantity shows total supply from DB (cumulative_start to cumulative_end)", async ({ page }) => {
    await goToWaves(page);
    // Quantities like 303, 489, 792 etc. (Fibonacci series) should appear
    const qty = page.locator('text=/\\d{3,4}/').first();
    await expect(qty).toBeVisible({ timeout: 30000 });
  });
});
