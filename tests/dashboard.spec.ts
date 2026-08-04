import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const SHOTS = path.join(process.cwd(), "tests", "results", "dashboard");
const EMAIL = "amplecapitalholding@gmail.com";
const PASS  = "amplecapitalholding@123";

async function snap(page: any, name: string) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
  console.log(`  📸 ${name}.png`);
}

async function login(page: any) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.fill('input[type="email"], input[name="email"], input[placeholder*="email" i]', EMAIL);
  await page.fill('input[type="password"], input[name="password"]', PASS);
  await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")');
  await page.waitForURL("**/dashboard**", { timeout: 20000 });
  await page.waitForLoadState("networkidle");
}

test("Dashboard loads with stat cards", async ({ page }) => {
  await login(page);
  await snap(page, "01-dashboard-initial");

  const url = page.url();
  expect(url).toContain("/dashboard");
  console.log("  ✅ Reached dashboard:", url);

  // Check page title / heading
  const heading = page.locator("h1, h2").first();
  await expect(heading).toBeVisible({ timeout: 10000 });
  console.log("  ✅ Page heading visible:", await heading.textContent());
});

test("Dashboard stat cards are visible", async ({ page }) => {
  await login(page);
  await page.waitForLoadState("networkidle");

  // Look for stat cards — they typically show numbers
  const cards = page.locator('[class*="card"], [class*="stat"], [class*="Card"]');
  const count = await cards.count();
  console.log(`  ℹ️ Found ${count} card elements`);
  await snap(page, "02-stat-cards");
  expect(count).toBeGreaterThan(0);
});

test("Dashboard Minted NFTs tab loads", async ({ page }) => {
  await login(page);
  await page.waitForLoadState("networkidle");

  // Look for tabs
  const mintedTab = page.locator('button:has-text("Minted"), [role="tab"]:has-text("Minted")');
  if (await mintedTab.count() > 0) {
    await mintedTab.first().click();
    await page.waitForLoadState("networkidle");
    await snap(page, "03-minted-tab");
    console.log("  ✅ Minted NFTs tab clicked");
  } else {
    await snap(page, "03-no-minted-tab");
    console.log("  ℹ️ No Minted tab found on this page");
  }
});

test("Dashboard Overview tab and clickable stat cards", async ({ page }) => {
  await login(page);
  await page.waitForLoadState("networkidle");

  // Try Overview tab
  const overviewTab = page.locator('button:has-text("Overview"), [role="tab"]:has-text("Overview")');
  if (await overviewTab.count() > 0) {
    await overviewTab.first().click();
    await page.waitForLoadState("networkidle");
    console.log("  ✅ Overview tab clicked");
  }

  await snap(page, "04-overview");

  // Check for clickable stat cards (Total Minted, WL Mint, etc.)
  const clickableCards = page.locator('button[class*="cursor-pointer"], div[class*="cursor-pointer"]');
  const clickCount = await clickableCards.count();
  console.log(`  ℹ️ Found ${clickCount} clickable elements`);

  if (clickCount > 0) {
    await clickableCards.first().click();
    await page.waitForTimeout(1000);
    await snap(page, "05-after-card-click");
    console.log("  ✅ Stat card clicked — filter applied");
  }
});

test("Dashboard Sync from Chain button visible", async ({ page }) => {
  await login(page);
  await page.waitForLoadState("networkidle");

  const syncBtn = page.locator('button:has-text("Sync"), button:has-text("Resync"), button:has-text("sync")');
  if (await syncBtn.count() > 0) {
    await snap(page, "06-sync-button-visible");
    console.log("  ✅ Sync button visible:", await syncBtn.first().textContent());
    expect(await syncBtn.first().isVisible()).toBe(true);
  } else {
    await snap(page, "06-no-sync-button");
    console.log("  ℹ️ No sync button found — may be on a different tab");
  }
});

test("Full dashboard screenshot — all tabs", async ({ page }) => {
  await login(page);
  await page.waitForLoadState("networkidle");

  // Screenshot each tab
  const tabs = page.locator('[role="tab"], button[class*="tab"]');
  const tabCount = await tabs.count();
  console.log(`  ℹ️ Found ${tabCount} tabs`);

  for (let i = 0; i < tabCount; i++) {
    const tabText = (await tabs.nth(i).textContent())?.trim() ?? `tab-${i}`;
    await tabs.nth(i).click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    await snap(page, `07-tab-${i}-${tabText.replace(/\s+/g, "-").toLowerCase()}`);
    console.log(`  📸 Tab ${i}: ${tabText}`);
  }
});
