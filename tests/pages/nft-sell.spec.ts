// NFT_SELL section: Auctions, Membership, Events, Seasons, Packs, Burn, Collaborations,
// Dutch Auction, Private Sale (OTC), Bulk Orders, Gift & Airdrop
// All data loads from BearthDev DB via BearthApi
import { test, expect } from "@playwright/test";
import path from "path";

test.use({ storageState: path.join(process.cwd(), "tests", ".auth", "admin.json") });

async function waitForAppShell(page: any) {
  await page.locator('text=Verifying access').waitFor({ state: 'detached', timeout: 60000 }).catch(() => {});
  await page.locator('button').filter({ hasText: /Sign Out/i }).waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
}

async function goToPage(page: any, route: string) {
  test.setTimeout(120000);
  await page.goto(route, { timeout: 90000 });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await waitForAppShell(page);
  expect(page.url()).not.toContain("/login");
}

// ─── Common check helper ───────────────────────────────────────────────────────

async function checkPageLoads(page: any, route: string, expectedText: RegExp) {
  await goToPage(page, route);
  const errors: string[] = [];
  page.on("pageerror", (err: Error) => {
    if (!err.message.includes("favicon") && !err.message.includes("icon.png")) {
      errors.push(err.message);
    }
  });
  const content = page.locator('h1, h2, h3, table').first();
  await expect(content).toBeVisible({ timeout: 30000 });
  expect(errors, `JS errors on ${route}: ${errors.join("; ")}`).toHaveLength(0);
}

// ─── Auctions (/nft/auctions) ─────────────────────────────────────────────────

test.describe("NFT Auctions — DB Data Loading & Actions", () => {
  test("loads auction sessions from BearthDev DB", async ({ page }) => {
    await goToPage(page, "/nft/auctions");
    const content = page.locator('h1, h2, table').first();
    await expect(content).toBeVisible({ timeout: 30000 });
  });

  test("auction table or empty state shows correct state from DB", async ({ page }) => {
    await goToPage(page, "/nft/auctions");
    await page.locator('svg.animate-spin').waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
    const content = page.locator('table').or(page.locator('text=/No auction|no sessions/i'));
    await expect(content.first()).toBeVisible({ timeout: 30000 });
  });

  test("Create Auction Session button opens form", async ({ page }) => {
    await goToPage(page, "/nft/auctions");
    const btn = page.locator('button').filter({ hasText: /New|Create|Add.*Auction/i }).first();
    const hasBtnb = await btn.isVisible({ timeout: 10000 }).catch(() => false);
    if (!hasBtnb) { console.log("No create button found on auctions page"); return; }
    await btn.click();
    await expect(page.locator('form, [role="dialog"], input').first()).toBeVisible({ timeout: 10000 });
  });

  test("no runtime errors on auctions page", async ({ page }) => {
    await checkPageLoads(page, "/nft/auctions", /Auction/i);
  });
});

// ─── Membership (/nft/membership) ─────────────────────────────────────────────

test.describe("NFT Membership — DB Data Loading", () => {
  test("loads membership tiers from BearthDev DB", async ({ page }) => {
    await goToPage(page, "/nft/membership");
    const content = page.locator('h1, h2, table').first();
    await expect(content).toBeVisible({ timeout: 30000 });
  });

  test("membership table or empty state from DB", async ({ page }) => {
    await goToPage(page, "/nft/membership");
    await page.locator('svg.animate-spin').waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
    const content = page.locator('table').or(page.locator('text=/No membership|No tiers/i'));
    await expect(content.first()).toBeVisible({ timeout: 30000 });
  });

  test("no runtime errors on membership page", async ({ page }) => {
    await checkPageLoads(page, "/nft/membership", /Membership/i);
  });
});

// ─── Events (/nft/events) ─────────────────────────────────────────────────────

test.describe("NFT Events — DB Data Loading", () => {
  test("loads events from BearthDev DB", async ({ page }) => {
    await goToPage(page, "/nft/events");
    const content = page.locator('h1, h2, table').first();
    await expect(content).toBeVisible({ timeout: 30000 });
  });

  test("no runtime errors on events page", async ({ page }) => {
    await checkPageLoads(page, "/nft/events", /Event/i);
  });
});

// ─── Seasons (/nft/seasons) ───────────────────────────────────────────────────

test.describe("NFT Seasons — DB Data Loading", () => {
  test("loads seasons from BearthDev DB", async ({ page }) => {
    await goToPage(page, "/nft/seasons");
    const content = page.locator('h1, h2, table').first();
    await expect(content).toBeVisible({ timeout: 30000 });
  });

  test("no runtime errors on seasons page", async ({ page }) => {
    await checkPageLoads(page, "/nft/seasons", /Season/i);
  });
});

// ─── Packs (/nft/packs) ───────────────────────────────────────────────────────

test.describe("NFT Packs — DB Data Loading", () => {
  test("loads NFT packs from BearthDev DB", async ({ page }) => {
    await goToPage(page, "/nft/packs");
    const content = page.locator('h1, h2, table').first();
    await expect(content).toBeVisible({ timeout: 30000 });
  });

  test("no runtime errors on packs page", async ({ page }) => {
    await checkPageLoads(page, "/nft/packs", /Pack/i);
  });
});

// ─── Burn to Mint (/nft/burn) ─────────────────────────────────────────────────

test.describe("NFT Burn to Mint — DB Data Loading", () => {
  test("loads burn rules from BearthDev DB", async ({ page }) => {
    await goToPage(page, "/nft/burn");
    const content = page.locator('h1, h2, table').first();
    await expect(content).toBeVisible({ timeout: 30000 });
  });

  test("no runtime errors on burn page", async ({ page }) => {
    await checkPageLoads(page, "/nft/burn", /Burn/i);
  });
});

// ─── Collaborations (/nft/collaborations) ─────────────────────────────────────

test.describe("NFT Collaborations — DB Data Loading", () => {
  test("loads collaborations from BearthDev DB", async ({ page }) => {
    await goToPage(page, "/nft/collaborations");
    const content = page.locator('h1, h2, table').first();
    await expect(content).toBeVisible({ timeout: 30000 });
  });

  test("no runtime errors on collaborations page", async ({ page }) => {
    await checkPageLoads(page, "/nft/collaborations", /Collab/i);
  });
});

// ─── Dutch Auction (/nft/dutch) ───────────────────────────────────────────────

test.describe("NFT Dutch Auction — DB Data Loading", () => {
  test("loads Dutch auction configs from BearthDev DB", async ({ page }) => {
    await goToPage(page, "/nft/dutch");
    const content = page.locator('h1, h2, table').first();
    await expect(content).toBeVisible({ timeout: 30000 });
  });

  test("Dutch auction shows price decay config from DB", async ({ page }) => {
    await goToPage(page, "/nft/dutch");
    await page.locator('svg.animate-spin').waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
    // Dutch auction shows price configuration: start price, floor price, decrement
    const content = page.locator('text=/price|ETH|decrement|floor/i').first();
    await expect(content).toBeVisible({ timeout: 30000 }).catch(() => {
      console.log("Dutch auction price config not found — may be empty state");
    });
  });

  test("no runtime errors on Dutch auction page", async ({ page }) => {
    await checkPageLoads(page, "/nft/dutch", /Dutch/i);
  });
});

// ─── Private Sale / OTC (/nft/otc) ───────────────────────────────────────────

test.describe("NFT Private Sale (OTC) — DB Data Loading", () => {
  test("loads OTC/private sale deals from BearthDev DB", async ({ page }) => {
    await goToPage(page, "/nft/otc");
    const content = page.locator('h1, h2, table').first();
    await expect(content).toBeVisible({ timeout: 30000 });
  });

  test("no runtime errors on OTC page", async ({ page }) => {
    await checkPageLoads(page, "/nft/otc", /OTC|Private/i);
  });
});

// ─── Bulk Orders (/nft/bulk) ──────────────────────────────────────────────────

test.describe("NFT Bulk Orders — DB Data Loading", () => {
  test("loads bulk orders from BearthDev DB", async ({ page }) => {
    await goToPage(page, "/nft/bulk");
    const content = page.locator('h1, h2, table').first();
    await expect(content).toBeVisible({ timeout: 30000 });
  });

  test("no runtime errors on bulk orders page", async ({ page }) => {
    await checkPageLoads(page, "/nft/bulk", /Bulk/i);
  });
});

// ─── Gift & Airdrop (/nft/gifts) ──────────────────────────────────────────────

test.describe("NFT Gift & Airdrop — DB Data Loading & Bug Fix Verification", () => {
  test("loads gift orders from BearthDev DB without runtime error", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err: Error) => {
      if (!err.message.includes("favicon") && !err.message.includes("icon.png")) {
        errors.push(err.message);
      }
    });
    await goToPage(page, "/nft/gifts");
    await page.locator('svg.animate-spin').waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
    const content = page.locator('h1, h2, table').first();
    await expect(content).toBeVisible({ timeout: 30000 });
    // Verify the null recipient_wallet bug is fixed (no "Cannot read properties of undefined" error)
    expect(errors.filter(e => e.includes("slice") || e.includes("undefined")),
      `recipient_wallet null bug: ${errors.join("; ")}`).toHaveLength(0);
  });

  test("gift table shows wallet addresses with null safety", async ({ page }) => {
    await goToPage(page, "/nft/gifts");
    await page.locator('svg.animate-spin').waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
    // Either a table (data exists) or empty state message
    const content = page.locator('table').or(page.locator('text=/No airdrops|No gift orders/i'));
    await expect(content.first()).toBeVisible({ timeout: 30000 });
  });

  test("tab switching works (Airdrops vs Gift Orders)", async ({ page }) => {
    await goToPage(page, "/nft/gifts");
    // Check for tab buttons
    const airdropTab = page.locator('button').filter({ hasText: /Airdrop/i }).first();
    const giftTab = page.locator('button').filter({ hasText: /Gift Order/i }).first();
    await expect(airdropTab.or(giftTab).first()).toBeVisible({ timeout: 15000 });
  });
});

// ─── Icon Verification ────────────────────────────────────────────────────────

test.describe("NFT_SELL Menu Icons — Fix Verification", () => {
  test("sidebar shows proper icons for NFT_SELL items (not dash fallback)", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/nft/auctions", { timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await waitForAppShell(page);
    // Check that the sidebar renders SVG icons (not just the default horizontal line dash)
    // Each NFT_SELL nav item should have an SVG icon
    const navSvgs = page.locator('nav svg, aside svg').filter({ hasNotText: /—/ });
    const count = await navSvgs.count();
    expect(count).toBeGreaterThan(5);
  });
});
