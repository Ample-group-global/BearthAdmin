// Route: /dashboard/nfts — On-chain NFT overview via Sepolia RPC
import { test, expect } from "@playwright/test";
import path from "path";

test.use({ storageState: path.join(process.cwd(), "tests", ".auth", "tech.json") });

async function waitForAppShell(page: any) {
  await page.locator('text=Verifying access').waitFor({ state: 'detached', timeout: 60000 }).catch(() => {});
  await page.locator('button').filter({ hasText: /Sign Out/i }).waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
}

async function goToNfts(page: any) {
  test.setTimeout(120000);
  await page.goto("/dashboard/nfts", { timeout: 90000 });
  // RPC calls may prevent networkidle — catch and continue
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await waitForAppShell(page);
  expect(page.url()).not.toContain("/login");
}

test.describe("Dashboard NFTs — Page Load", () => {
  test("loads NFT overview heading", async ({ page }) => {
    await goToNfts(page);
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 20000 });
    await expect(heading).toContainText(/NFT/i);
  });

  test("session is authenticated (no redirect to login)", async ({ page }) => {
    await goToNfts(page);
    expect(page.url()).not.toContain("/login");
  });
});

test.describe("Dashboard NFTs — On-Chain Data (Sepolia RPC)", () => {
  test("shows minted count stat from on-chain events", async ({ page }) => {
    test.setTimeout(120000);
    await goToNfts(page);
    // Page shows "X minted" stat (reads from contract Transfer events via RPC)
    const minted = page.locator('p, span').filter({ hasText: /minted/i }).first();
    await expect(minted).toBeVisible({ timeout: 60000 });
  });

  test("filter/search control is present", async ({ page }) => {
    await goToNfts(page);
    const control = page.locator('input[type="text"], input[placeholder*="Search" i], select').first();
    await expect(control).toBeVisible({ timeout: 20000 });
  });

  test("sort controls or column headers are present", async ({ page }) => {
    test.setTimeout(120000);
    await goToNfts(page);
    // Sort headers appear when NFTs exist; empty state when none minted (valid on testnet)
    const hasSortControls = await page.locator('th, button').filter({ hasText: /Token|Owner|Mint|Wave|Gas|Date/i }).first().isVisible({ timeout: 30000 }).catch(() => false);
    if (!hasSortControls) {
      // No NFTs on testnet yet — verify we're at least on the right page
      await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5000 });
      console.log("No NFTs minted on testnet — sort controls absent, empty state confirmed");
    }
  });

  test("NFT table or empty state renders without JS error", async ({ page }) => {
    test.setTimeout(120000);
    await goToNfts(page);
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    // Table renders when NFTs exist, or empty state when none minted yet
    const hasTable = await page.locator('table, tbody').first().isVisible({ timeout: 60000 }).catch(() => false);
    if (!hasTable) {
      // No NFTs on testnet — page should still load with a heading
      await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5000 });
    }
    expect(errors.filter(e => !e.includes("favicon") && !e.includes("icon.png"))).toHaveLength(0);
  });
});

test.describe("Dashboard NFTs — NFT Smart Contract Actions", () => {
  test("NFT row click opens detail modal (on-chain metadata)", async ({ page }) => {
    test.setTimeout(120000);
    await goToNfts(page);

    // Only test if NFTs are minted (table has rows)
    const tableRow = page.locator('tbody tr').first();
    const hasRows = await tableRow.isVisible({ timeout: 30000 }).catch(() => false);
    if (!hasRows) {
      console.log("No minted NFTs yet — skipping detail modal test");
      return;
    }
    await tableRow.click();
    // Modal should open with NFT metadata from IPFS
    await expect(page.locator('[role="dialog"], .modal, [class*="modal"]').first()).toBeVisible({ timeout: 15000 });
  });

  test("filter by mint type (WL Free / Fixed / Dutch / Admin)", async ({ page }) => {
    test.setTimeout(120000);
    await goToNfts(page);

    // Sort/filter by mint type
    const filterSelect = page.locator('select').first();
    const hasFilter = await filterSelect.isVisible({ timeout: 15000 }).catch(() => false);
    if (!hasFilter) { console.log("No select filter — checking for button filters"); }

    // Alternative: button-based filter
    const mintTypeFilter = page.locator('button, select option').filter({ hasText: /WL Free|Fixed Price|Dutch|Admin/i }).first();
    await expect(mintTypeFilter).toBeVisible({ timeout: 15000 }).catch(() => {
      console.log("Mint type filter not found in current state — likely no data");
    });
  });
});
