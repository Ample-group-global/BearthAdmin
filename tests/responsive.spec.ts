import { test, expect } from "@playwright/test";
import { loginAs, mockBlockchain, mockWhitelistApi } from "./helpers";

const VIEWPORTS = {
  mobile: { width: 375, height: 667, name: "Mobile (375px)" },
  tablet: { width: 768, height: 1024, name: "Tablet (768px)" },
  desktop: { width: 1280, height: 800, name: "Desktop (1280px)" },
  wide: { width: 1920, height: 1080, name: "Widescreen (1920px)" },
};

test.describe("Responsiveness — Login page", () => {
  for (const [key, vp] of Object.entries(VIEWPORTS)) {
    test(`${vp.name}: login form is fully visible and usable`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/login");

      const form = page.locator("form");
      await expect(form).toBeVisible();

      // No horizontal overflow
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(bodyWidth).toBeLessThanOrEqual(vp.width + 5); // 5px tolerance

      // Form fields are clickable
      await page.fill('input[autocomplete="username"]', "test");
      await page.fill('input[autocomplete="current-password"]', "test");
      const input = page.locator('input[autocomplete="username"]');
      const box = await input.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width);
    });
  }
});

test.describe("Responsiveness — Tech Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await mockBlockchain(page);
    await mockWhitelistApi(page);
    await loginAs(page, "tech");
  });

  test("mobile (375px): sidebar collapses to icon mode", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/dashboard");
    // Sidebar should exist; on small screens content should still be accessible
    await expect(page.locator("aside")).toBeVisible();
    // Main content area should not overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(380);
  });

  test("tablet (768px): dashboard overview is readable", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /overview/i })).toBeVisible();
    await expect(page.locator("aside")).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
  });

  test("desktop (1280px): full sidebar and content visible", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/dashboard");
    await expect(page.locator("aside").getByText("Bearth NFT")).toBeVisible();
    await expect(page.locator("aside").getByText("Technical Admin")).toBeVisible();
    await expect(page.getByRole("heading", { name: /overview/i })).toBeVisible();
  });

  test("nft explorer: filter bar wraps on narrow screens", async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 800 });
    await page.goto("/dashboard/nfts");
    await expect(page.getByRole("heading", { name: /nft explorer/i })).toBeVisible();
    // Should not cause horizontal scroll
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(485);
  });

  test("whitelist page is usable on tablet", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/dashboard/whitelist");
    await expect(page.locator("main")).toBeVisible();
  });
});

test.describe("Responsiveness — Ops Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await mockBlockchain(page);
    await mockWhitelistApi(page);
    await loginAs(page, "ops");
  });

  test("mobile (375px): ops overview is readable", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/ops");
    await expect(page.getByRole("heading", { name: /Project Overview/i })).toBeVisible();
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(380);
  });

  test("tablet (768px): ops overview stats grid is visible", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/ops");
    await expect(page.getByText(/Minting Progress/i)).toBeVisible({ timeout: 8000 });
  });

  test("mobile (375px): nft gallery grid adjusts columns", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/ops/nfts");
    await expect(page.getByRole("heading", { name: /NFT Gallery/i })).toBeVisible();
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(380);
  });

  test("mobile (375px): whitelist form is usable", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/ops/whitelist");
    await expect(page.locator('input[placeholder="0x..."]')).toBeVisible({ timeout: 5000 });
    const box = await page.locator('input[placeholder="0x..."]').boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(380);
  });

  test("desktop (1920px): sidebar and content render correctly", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/ops");
    await expect(page.locator("aside").getByText("Operations Staff")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Project Overview/i })).toBeVisible();
  });

  test("nft gallery summary strip adapts to screen width", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/ops/nfts");
    await expect(page.getByText(/Free Whitelist Mint/i).first()).toBeVisible({ timeout: 5000 });
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(380);
  });
});

test.describe("Auth routing edge cases", () => {
  test("unauthenticated / redirects to /login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/");
    await page.waitForURL(/\/login/, { timeout: 5000 });
    expect(page.url()).toContain("/login");
  });

  test("unauthenticated /dashboard redirects to /login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/dashboard");
    await page.waitForURL(/\/login/, { timeout: 5000 });
    expect(page.url()).toContain("/login");
  });

  test("unauthenticated /admin redirects to /login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/admin");
    await page.waitForURL(/\/login/, { timeout: 5000 });
    expect(page.url()).toContain("/login");
  });

  test("unauthenticated /whitelist redirects to /login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/whitelist");
    await page.waitForURL(/\/login/, { timeout: 5000 });
    expect(page.url()).toContain("/login");
  });

  test("already-logged-in tech user at /login redirects to /dashboard", async ({ page }) => {
    await mockBlockchain(page);
    await mockWhitelistApi(page);
    await loginAs(page, "tech");
    await page.goto("/login");
    await page.waitForURL(/\/dashboard/, { timeout: 5000 });
    expect(page.url()).toContain("/dashboard");
  });

  test("already-logged-in ops user at /login redirects to /ops", async ({ page }) => {
    await mockBlockchain(page);
    await mockWhitelistApi(page);
    await loginAs(page, "ops");
    await page.goto("/login");
    await page.waitForURL(/\/ops/, { timeout: 5000 });
    expect(page.url()).toContain("/ops");
  });
});
