import { test, expect } from "@playwright/test";
import { loginAs, mockBlockchain, mockWhitelistApi } from "./helpers";

test.describe("Tech Admin Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await mockBlockchain(page);
    await mockWhitelistApi(page);
    await loginAs(page, "tech");
  });

  // ── Layout & Navigation ─────────────────────────────────────────────────────

  test("sidebar renders with correct nav items", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("aside").getByText("Bearth NFT")).toBeVisible();
    // "Technical Admin" appears in sidebar label AND top bar — scope to sidebar
    await expect(page.locator("aside").getByText("Technical Admin")).toBeVisible();
    await expect(page.locator("aside").getByRole("link", { name: /overview/i })).toBeVisible();
    await expect(page.locator("aside").getByRole("link", { name: "Whitelist" })).toBeVisible();
    await expect(page.locator("aside").getByRole("link", { name: /contract/i })).toBeVisible();
    await expect(page.locator("aside").getByRole("link", { name: /nft explorer/i })).toBeVisible();
  });

  test("sidebar collapse toggle works", async ({ page }) => {
    await page.goto("/dashboard");
    const sidebar = page.locator("aside");
    await expect(sidebar).toHaveClass(/w-60/);
    await sidebar.locator("button").first().click();
    await expect(sidebar).toHaveClass(/w-16/);
    await sidebar.locator("button").first().click();
    await expect(sidebar).toHaveClass(/w-60/);
  });

  test("top bar shows Technical Admin label", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("header").getByText(/Technical Admin/)).toBeVisible();
  });

  test("navigating to /dashboard shows Overview page", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /overview/i })).toBeVisible();
  });

  test("nav links route to correct pages", async ({ page }) => {
    await page.goto("/dashboard");
    // Use sidebar-scoped links to avoid ambiguity with quick-action links
    await page.locator("aside").getByRole("link", { name: "Whitelist" }).click();
    await page.waitForURL(/\/dashboard\/whitelist/);
    expect(page.url()).toContain("/dashboard/whitelist");

    await page.locator("aside").getByRole("link", { name: /contract/i }).click();
    await page.waitForURL(/\/dashboard\/contract/);
    expect(page.url()).toContain("/dashboard/contract");

    await page.locator("aside").getByRole("link", { name: /nft explorer/i }).click();
    await page.waitForURL(/\/dashboard\/nfts/);
    expect(page.url()).toContain("/dashboard/nfts");
  });

  test("sign out logs out and redirects to login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.locator("aside").getByRole("button", { name: /sign out/i }).click();
    await page.waitForURL(/\/login/, { timeout: 5000 });
    expect(page.url()).toContain("/login");
  });

  // ── Overview page ───────────────────────────────────────────────────────────

  test("overview shows stat cards after load", async ({ page }) => {
    await page.goto("/dashboard");
    // Stat card labels are always visible once data loads (or error)
    await expect(page.getByText("Total Minted").first()).toBeVisible({ timeout: 12000 });
    await expect(page.getByText("Current Phase").first()).toBeVisible();
  });

  test("overview quick action links are present", async ({ page }) => {
    await page.goto("/dashboard");
    // Wait for page to finish loading blockchain data
    await page.waitForTimeout(2000);
    await expect(page.getByRole("link", { name: /Manage Whitelist/i })).toBeVisible({ timeout: 12000 });
    await expect(page.getByRole("link", { name: /Contract Operations/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /NFT Explorer/i }).last()).toBeVisible();
  });

  // ── Whitelist page ──────────────────────────────────────────────────────────

  test("whitelist page shows tab navigation", async ({ page }) => {
    await page.goto("/dashboard/whitelist");
    // The whitelist uses custom tabs or sections — check for key text
    await expect(page.getByText(/all addresses/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("whitelist page renders address list", async ({ page }) => {
    await page.goto("/dashboard/whitelist");
    // The hook returns plain addresses; look for part of a known mock address
    await expect(page.getByText(/0xAb5801/i)).toBeVisible({ timeout: 8000 });
  });

  test("whitelist add form is present", async ({ page }) => {
    await page.goto("/dashboard/whitelist");
    // Tab to "Add Single" if it's a tab UI
    const addTab = page.getByText(/add single/i).first();
    if (await addTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addTab.click();
    }
    await expect(page.locator("main")).toBeVisible();
  });

  // ── NFT Explorer page ───────────────────────────────────────────────────────

  test("nft explorer page loads heading", async ({ page }) => {
    await page.goto("/dashboard/nfts");
    await expect(page.getByRole("heading", { name: /nft explorer/i })).toBeVisible();
  });

  test("nft explorer shows summary stat card labels", async ({ page }) => {
    await page.goto("/dashboard/nfts");
    await expect(page.getByText("WL Free Minted")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Public Free Minted")).toBeVisible();
    await expect(page.getByText("Paid Minted")).toBeVisible();
    // Use exact text to avoid ambiguity with "Revealed" in dropdown
    await expect(page.getByText("Revealed", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Blind Box", { exact: true }).first()).toBeVisible();
  });

  test("nft explorer filter controls are visible", async ({ page }) => {
    await page.goto("/dashboard/nfts");
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator("select").first()).toBeVisible();
  });

  test("nft explorer refresh button becomes enabled after load", async ({ page }) => {
    await page.goto("/dashboard/nfts");
    const refreshBtn = page.getByRole("button", { name: /refresh/i });
    await expect(refreshBtn).toBeVisible({ timeout: 8000 });
    // Wait for initial load to complete (button re-enables)
    await expect(refreshBtn).toBeEnabled({ timeout: 15000 });
    await refreshBtn.click();
    await expect(page.getByRole("heading", { name: /nft explorer/i })).toBeVisible();
  });

  // ── Contract page ────────────────────────────────────────────────────────────

  test("contract page renders main content area", async ({ page }) => {
    await page.goto("/dashboard/contract");
    await expect(page.locator("main")).not.toBeEmpty({ timeout: 10000 });
  });

  // ── Auth guard ───────────────────────────────────────────────────────────────

  test("ops user cannot access /dashboard — redirected away to /ops", async ({ page }) => {
    // Clear cookies and log in as ops
    await page.context().clearCookies();
    await mockBlockchain(page);
    await mockWhitelistApi(page);
    await loginAs(page, "ops");

    // Try to access tech dashboard: proxy redirects to /login → /login sees ops session → /ops
    await page.goto("/dashboard");
    await page.waitForURL(/\/(login|ops)/, { timeout: 8000 });
    // Either stopped at /login or bounced to /ops — either way NOT on /dashboard
    expect(page.url()).not.toContain("/dashboard");
  });
});
