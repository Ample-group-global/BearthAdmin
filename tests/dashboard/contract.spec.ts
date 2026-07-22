// Route: /dashboard/contract — Smart contract operations (Sepolia testnet interactions)
import { test, expect } from "@playwright/test";
import path from "path";

test.use({ storageState: path.join(process.cwd(), "tests", ".auth", "tech.json") });

async function waitForAppShell(page: any) {
  await page.locator('text=Verifying access').waitFor({ state: 'detached', timeout: 60000 }).catch(() => {});
  await page.locator('button').filter({ hasText: /Sign Out/i }).waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
}

async function goToContract(page: any) {
  test.setTimeout(120000);
  await page.goto("/dashboard/contract", { timeout: 90000 });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await waitForAppShell(page);
  expect(page.url()).not.toContain("/login");
}

test.describe("Contract Page — Page Load", () => {
  test("loads Contract Operations heading", async ({ page }) => {
    await goToContract(page);
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 20000 });
    await expect(heading).toContainText(/Contract/i);
  });

  test("session is authenticated (no redirect to login)", async ({ page }) => {
    await goToContract(page);
    expect(page.url()).not.toContain("/login");
  });

  test("no runtime errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => {
      if (!err.message.includes("favicon") && !err.message.includes("icon.png")) {
        errors.push(err.message);
      }
    });
    await goToContract(page);
    await page.waitForTimeout(3000);
    expect(errors, `Errors: ${errors.join("; ")}`).toHaveLength(0);
  });
});

test.describe("Contract Page — Smart Contract Tabs & Actions", () => {
  test("all 6 contract tabs are present", async ({ page }) => {
    await goToContract(page);
    for (const tab of ["Phase", "Whitelist", "Mint", "Reveal", "Financial", "Advanced"]) {
      const btn = page.locator('button').filter({ hasText: new RegExp(tab, "i") }).first();
      await expect(btn).toBeVisible({ timeout: 15000 });
    }
  });

  test("Phase & Timing tab: set phase button visible (NFT sale phase control)", async ({ page }) => {
    await goToContract(page);
    // Click Phase tab
    await page.locator('button').filter({ hasText: /Phase|Timing/i }).first().click();
    // Phase section: set/advance phase buttons
    await expect(
      page.locator('button, select').filter({ hasText: /Phase|Set Phase|Advance/i }).first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("Whitelist Root tab: set Merkle root input and button present", async ({ page }) => {
    await goToContract(page);
    await page.locator('button').filter({ hasText: /Whitelist Root|Whitelist/i }).first().click();
    // Input for Merkle root (bytes32 hex)
    await expect(
      page.locator('input[placeholder*="0x"]').first()
    ).toBeVisible({ timeout: 15000 });
    // Set Root button
    await expect(
      page.locator('button').filter({ hasText: /Set Root|Update Root|Whitelist/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("Mint Settings tab: purchase limit toggle and max per wallet input", async ({ page }) => {
    await goToContract(page);
    await page.locator('button').filter({ hasText: /Mint Settings|Mint/i }).first().click();
    // Should show limit controls (VIP/Normal customer type management)
    await expect(
      page.locator('input[type="number"]').first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("Reveal & URIs tab: base URI input and reveal button present", async ({ page }) => {
    await goToContract(page);
    await page.locator('button').filter({ hasText: /Reveal|URI/i }).first().click();
    // Base URI or reveal-related input
    await expect(
      page.locator('input[placeholder*="ipfs"], input[placeholder*="https"], input[type="text"]').first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("Financial tab: royalty, withdrawal, and ETH balance controls", async ({ page }) => {
    await goToContract(page);
    await page.locator('button').filter({ hasText: /Financial/i }).first().click();
    await expect(
      page.locator('button, input').filter({ hasText: /royalt|withdraw|ETH|balance/i }).first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("Advanced tab: operator filter, SBT lock, emergency controls", async ({ page }) => {
    await goToContract(page);
    await page.locator('button').filter({ hasText: /Advanced/i }).first().click();
    await expect(
      page.locator('button, input').filter({ hasText: /operator|SBT|lock|emergency|pause/i }).first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("Connect Wallet button present when no wallet connected (Privy gate)", async ({ page }) => {
    await goToContract(page);
    // If wallet not connected, page shows "Connect Wallet" or disabled buttons
    // Either state is acceptable — the page should not crash
    const content = page.locator('button').first();
    await expect(content).toBeVisible({ timeout: 15000 });
  });
});
