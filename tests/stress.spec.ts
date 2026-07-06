/**
 * Stress / Repeat Tests — 5 rounds for all roles and all key features.
 * Tests login→navigate→logout cycle multiple times to check for session
 * leaks, stale state, and UI regressions across repeated usage.
 */
import { test, expect } from "@playwright/test";
import { loginAs, mockBlockchain, mockWhitelistApi, screenshot } from "./helpers";

// ── Utility: full admin cycle (login → presale overview → logout) ─────────────

async function adminCycle(page: import("@playwright/test").Page, round: number) {
  await page.context().clearCookies();
  await loginAs(page, "admin");
  await page.goto("/presale");
  await page.waitForTimeout(2000);
  await screenshot(page, `stress-admin-round${round}-presale`);
  await expect(page.locator("aside")).toBeVisible({ timeout: 10000 });

  // Navigate through pages
  await page.goto("/presale/orders");
  await page.waitForTimeout(1000);
  await screenshot(page, `stress-admin-round${round}-orders`);

  await page.goto("/presale/customers");
  await page.waitForTimeout(1000);
  await screenshot(page, `stress-admin-round${round}-customers`);

  await page.goto("/presale/products");
  await page.waitForTimeout(1000);
  await screenshot(page, `stress-admin-round${round}-products`);

  // Logout
  await page.locator("aside").getByRole("button", { name: /sign out/i }).click();
  await page.waitForURL(/\/login/, { timeout: 8000 });
}

// ── Utility: full tech cycle ─────────────────────────────────────────────────

async function techCycle(page: import("@playwright/test").Page, round: number) {
  await mockBlockchain(page);
  await mockWhitelistApi(page);
  await page.context().clearCookies();
  await loginAs(page, "tech");
  await page.goto("/dashboard");
  await page.waitForTimeout(2000);
  await screenshot(page, `stress-tech-round${round}-dashboard`);
  await expect(page.locator("aside").getByText("Bearth NFT")).toBeVisible({ timeout: 10000 });

  await page.goto("/dashboard/whitelist");
  await page.waitForTimeout(1000);
  await screenshot(page, `stress-tech-round${round}-whitelist`);

  await page.goto("/dashboard/nfts");
  await page.waitForTimeout(2000);
  await screenshot(page, `stress-tech-round${round}-nfts`);

  await page.locator("aside").getByRole("button", { name: /sign out/i }).click();
  await page.waitForURL(/\/login/, { timeout: 8000 });
}

// ── Utility: full ops cycle ──────────────────────────────────────────────────

async function opsCycle(page: import("@playwright/test").Page, round: number) {
  await mockBlockchain(page);
  await mockWhitelistApi(page);
  await page.context().clearCookies();
  await loginAs(page, "ops");
  await page.goto("/ops");
  await page.waitForTimeout(2000);
  await screenshot(page, `stress-ops-round${round}-overview`);
  await expect(page.locator("aside").getByText("Bearth NFT")).toBeVisible({ timeout: 10000 });

  await page.goto("/ops/whitelist");
  await page.waitForTimeout(1000);
  await screenshot(page, `stress-ops-round${round}-whitelist`);

  await page.goto("/ops/nfts");
  await page.waitForTimeout(1000);
  await screenshot(page, `stress-ops-round${round}-nfts`);

  await page.locator("aside").getByRole("button", { name: /sign out/i }).click();
  await page.waitForURL(/\/login/, { timeout: 8000 });
}

// ── Admin Stress Tests ────────────────────────────────────────────────────────

test.describe("Stress — Admin Role (5 rounds)", () => {
  for (let round = 1; round <= 5; round++) {
    test(`Admin cycle round ${round}: login → presale → orders → customers → products → logout`, async ({ page }) => {
      await adminCycle(page, round);
      expect(page.url()).toContain("/login");
    });
  }
});

// ── Tech Stress Tests ─────────────────────────────────────────────────────────

test.describe("Stress — Tech Role (5 rounds)", () => {
  for (let round = 1; round <= 5; round++) {
    test(`Tech cycle round ${round}: login → dashboard → whitelist → nfts → logout`, async ({ page }) => {
      await techCycle(page, round);
      expect(page.url()).toContain("/login");
    });
  }
});

// ── Ops Stress Tests ──────────────────────────────────────────────────────────

test.describe("Stress — Ops Role (5 rounds)", () => {
  for (let round = 1; round <= 5; round++) {
    test(`Ops cycle round ${round}: login → overview → whitelist → nfts → logout`, async ({ page }) => {
      await opsCycle(page, round);
      expect(page.url()).toContain("/login");
    });
  }
});

// ── Cross-Role Stress Tests ───────────────────────────────────────────────────

test.describe("Stress — Role Switching (5 rounds)", () => {
  for (let round = 1; round <= 5; round++) {
    test(`Role switch round ${round}: admin → logout → tech → logout → ops → logout`, async ({ page }) => {
      // Admin
      await page.context().clearCookies();
      await loginAs(page, "admin");
      await page.goto("/presale");
      await page.waitForTimeout(1000);
      await expect(page.locator("aside")).toBeVisible({ timeout: 10000 });
      await screenshot(page, `stress-roleswitch-round${round}-admin`);
      await page.locator("aside").getByRole("button", { name: /sign out/i }).click();
      await page.waitForURL(/\/login/, { timeout: 8000 });

      // Tech
      await mockBlockchain(page);
      await mockWhitelistApi(page);
      await loginAs(page, "tech");
      await page.goto("/dashboard");
      await page.waitForTimeout(1000);
      await screenshot(page, `stress-roleswitch-round${round}-tech`);
      await page.locator("aside").getByRole("button", { name: /sign out/i }).click();
      await page.waitForURL(/\/login/, { timeout: 8000 });

      // Ops
      await mockBlockchain(page);
      await mockWhitelistApi(page);
      await loginAs(page, "ops");
      await page.goto("/ops");
      await page.waitForTimeout(1000);
      await screenshot(page, `stress-roleswitch-round${round}-ops`);
      await page.locator("aside").getByRole("button", { name: /sign out/i }).click();
      await page.waitForURL(/\/login/, { timeout: 8000 });

      expect(page.url()).toContain("/login");
    });
  }
});

// ── Presale Data Stress ───────────────────────────────────────────────────────

test.describe("Stress — Presale Data Pages (5 rounds)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin");
  });

  for (let round = 1; round <= 5; round++) {
    test(`Presale all pages round ${round}`, async ({ page }) => {
      const pages = [
        { url: "/presale", name: "overview" },
        { url: "/presale/orders", name: "orders" },
        { url: "/presale/customers", name: "customers" },
        { url: "/presale/products", name: "products" },
        { url: "/presale/nft", name: "nft" },
        { url: "/presale/reconciliation", name: "reconciliation" },
        { url: "/presale/reports", name: "reports" },
        { url: "/presale/users", name: "users" },
      ];

      for (const p of pages) {
        await page.goto(p.url);
        await page.waitForTimeout(1500);
        await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
        if (round === 1) {
          await screenshot(page, `stress-presale-${p.name}-round${round}`);
        }
      }
    });
  }
});
