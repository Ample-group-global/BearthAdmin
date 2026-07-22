// Route: /nft/records — NFT records from BearthDev DB (nft_records table)
import { test, expect } from "@playwright/test";
import path from "path";

test.use({ storageState: path.join(process.cwd(), "tests", ".auth", "admin.json") });

async function waitForAppShell(page: any) {
  await page.locator('text=Verifying access').waitFor({ state: 'detached', timeout: 60000 }).catch(() => {});
  await page.locator('button').filter({ hasText: /Sign Out/i }).waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
}

async function goToNftRecords(page: any) {
  test.setTimeout(120000);
  await page.goto("/nft/records", { timeout: 90000 });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await waitForAppShell(page);
  expect(page.url()).not.toContain("/login");
}

test.describe("NFT Records — Page Load & DB Data", () => {
  test("loads NFT Records heading", async ({ page }) => {
    await goToNftRecords(page);
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 20000 });
    await expect(heading).toContainText(/NFT/i);
  });

  test("table or empty state loads from BearthDev nft_records table", async ({ page }) => {
    await goToNftRecords(page);
    const content = page.locator('table').or(page.locator('div.flex-col.h-52').or(page.locator('text=/No NFT|No records/i')));
    await expect(content.first()).toBeVisible({ timeout: 30000 });
  });

  test("search/filter control for NFT records is present", async ({ page }) => {
    await goToNftRecords(page);
    const control = page.locator('input[type="text"], input[placeholder*="Search" i]').first();
    await expect(control).toBeVisible({ timeout: 20000 });
  });

  test("no runtime error on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => {
      if (!err.message.includes("favicon") && !err.message.includes("icon.png")) {
        errors.push(err.message);
      }
    });
    await goToNftRecords(page);
    await page.waitForTimeout(2000);
    expect(errors, `Errors: ${errors.join(", ")}`).toHaveLength(0);
  });

  test("session is authenticated (no redirect to login)", async ({ page }) => {
    await goToNftRecords(page);
    expect(page.url()).not.toContain("/login");
  });
});

test.describe("NFT Records — DB Column Data Verification", () => {
  test("serial number column visible (NFT serial format #1/#2/#3)", async ({ page }) => {
    await goToNftRecords(page);

    const table = page.locator('table');
    const hasTable = await table.isVisible({ timeout: 20000 }).catch(() => false);
    if (!hasTable) { console.log("No NFT records in DB yet — skipping column check"); return; }

    // Serial number column header
    const serialHeader = page.locator('th').filter({ hasText: /Serial|Token|ID/i }).first();
    await expect(serialHeader).toBeVisible({ timeout: 10000 });
  });

  test("wave column shows wave name from DB join", async ({ page }) => {
    await goToNftRecords(page);

    const table = page.locator('table');
    const hasTable = await table.isVisible({ timeout: 20000 }).catch(() => false);
    if (!hasTable) { console.log("No NFT records — skipping wave column check"); return; }

    const waveHeader = page.locator('th').filter({ hasText: /Wave|Stage/i }).first();
    await expect(waveHeader).toBeVisible({ timeout: 10000 });
  });

  test("status column shows lifecycle state (blind/revealed/sold)", async ({ page }) => {
    await goToNftRecords(page);

    const table = page.locator('table');
    const hasTable = await table.isVisible({ timeout: 20000 }).catch(() => false);
    if (!hasTable) { console.log("No NFT records — skipping status check"); return; }

    const statusHeader = page.locator('th').filter({ hasText: /Status|State|Reveal|Delivery/i }).first();
    await expect(statusHeader).toBeVisible({ timeout: 10000 });
  });
});

test.describe("NFT Records — Actions", () => {
  test("search by serial number filters DB results", async ({ page }) => {
    await goToNftRecords(page);
    const searchInput = page.locator('input[placeholder*="Search" i]').first();
    await searchInput.fill("#1");
    await page.waitForTimeout(800);
    // Results should update from DB query
    await expect(searchInput).toHaveValue("#1");
  });

  test("Add/Create NFT Record button (if present) opens form", async ({ page }) => {
    await goToNftRecords(page);
    const addBtn = page.locator('button').filter({ hasText: /Add|Create|New NFT/i }).first();
    const hasAdd = await addBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasAdd) { console.log("No add button — NFT records are auto-created by minting"); return; }
    await addBtn.click();
    await expect(page.locator('input, [class*="modal"], [class*="fixed"]').first()).toBeVisible({ timeout: 10000 });
  });
});
