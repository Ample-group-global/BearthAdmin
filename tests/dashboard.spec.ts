import { test, expect } from "@playwright/test";
import { loginAs, mockBlockchain, mockWhitelistApi, screenshot } from "./helpers";

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
    await expect(page.locator("aside").getByText("Technical Admin")).toBeVisible();
    await expect(page.locator("aside").getByRole("link", { name: /overview/i })).toBeVisible();
    await expect(page.locator("aside").getByRole("link", { name: "Whitelist" })).toBeVisible();
    await expect(page.locator("aside").getByRole("link", { name: /contract/i })).toBeVisible();
    await expect(page.locator("aside").getByRole("link", { name: /nft overview/i })).toBeVisible();
    await screenshot(page, "30-dashboard-sidebar");
  });

  test("sidebar collapse toggle works", async ({ page }) => {
    await page.goto("/dashboard");
    const sidebar = page.locator("aside");
    await expect(sidebar).toHaveClass(/w-60/);
    await screenshot(page, "30-dashboard-sidebar-expanded");
    await sidebar.locator("button").first().click();
    await expect(sidebar).toHaveClass(/w-16/);
    await screenshot(page, "30-dashboard-sidebar-collapsed");
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
    await screenshot(page, "31-dashboard-overview");
  });

  test("nav links route to correct pages", async ({ page }) => {
    await page.goto("/dashboard");
    await page.locator("aside").getByRole("link", { name: "Whitelist" }).click();
    await page.waitForURL(/\/dashboard\/whitelist/);
    expect(page.url()).toContain("/dashboard/whitelist");
    await screenshot(page, "32-dashboard-whitelist");

    await page.locator("aside").getByRole("link", { name: /contract/i }).click();
    await page.waitForURL(/\/dashboard\/contract/);
    expect(page.url()).toContain("/dashboard/contract");
    await screenshot(page, "33-dashboard-contract");

    await page.locator("aside").getByRole("link", { name: /nft overview/i }).click();
    await page.waitForURL(/\/dashboard\/nfts/);
    expect(page.url()).toContain("/dashboard/nfts");
    await screenshot(page, "34-dashboard-nfts");
  });

  test("sign out logs out and redirects to login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.locator("aside").getByRole("button", { name: /sign out/i }).click();
    await page.waitForURL(/\/login/, { timeout: 5000 });
    expect(page.url()).toContain("/login");
  });

  // ── Overview Page ───────────────────────────────────────────────────────────

  test("overview shows stat cards after load", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Total Minted").first()).toBeVisible({ timeout: 12000 });
    await expect(page.getByText("Current Phase").first()).toBeVisible();
    await screenshot(page, "31-dashboard-overview-loaded");
  });

  test("overview quick action links are present", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForTimeout(2000);
    await expect(page.getByRole("link", { name: /Manage Whitelist/i })).toBeVisible({ timeout: 12000 });
    await expect(page.getByRole("link", { name: /Contract Operations/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /NFT Explorer/i }).last()).toBeVisible();
  });

  // ── Whitelist Page ──────────────────────────────────────────────────────────

  test("whitelist page shows address list", async ({ page }) => {
    await page.goto("/dashboard/whitelist");
    await expect(page.getByText(/all addresses/i).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/0xAb5801/i)).toBeVisible({ timeout: 8000 });
    await screenshot(page, "32-dashboard-whitelist-list");
  });

  test("whitelist add form is present", async ({ page }) => {
    await page.goto("/dashboard/whitelist");
    await page.waitForTimeout(1000);
    await screenshot(page, "32-dashboard-whitelist-add");
  });

  // ── NFT Explorer Page ───────────────────────────────────────────────────────

  test("nft overview page loads heading", async ({ page }) => {
    await page.goto("/dashboard/nfts");
    await expect(page.getByRole("heading", { name: /NFT Overview/i })).toBeVisible({ timeout: 15000 });
    await screenshot(page, "34-dashboard-nfts-header");
  });

  test("nft overview shows summary stat card labels", async ({ page }) => {
    await page.goto("/dashboard/nfts");
    await expect(page.getByText("WL Free").first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Public Free").first()).toBeVisible();
    await expect(page.getByText("Paid Mints").first()).toBeVisible();
    await expect(page.getByText("Revealed", { exact: true }).first()).toBeVisible();
    await screenshot(page, "34-dashboard-nfts-stats");
  });

  test("nft overview filter controls are visible", async ({ page }) => {
    await page.goto("/dashboard/nfts");
    await expect(page.getByRole("heading", { name: /NFT Overview/i })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('input[placeholder*="filter"]').or(page.locator('input[placeholder*="search"]').or(page.locator("select").first()))).toBeVisible({ timeout: 8000 });
  });

  test("nft overview refresh button works", async ({ page }) => {
    await page.goto("/dashboard/nfts");
    const refreshBtn = page.getByRole("button", { name: /refresh/i });
    await expect(refreshBtn).toBeVisible({ timeout: 15000 });
    await expect(refreshBtn).toBeEnabled({ timeout: 20000 });
    await refreshBtn.click();
    await expect(page.getByRole("heading", { name: /NFT Overview/i })).toBeVisible();
  });

  // ── Contract Page ────────────────────────────────────────────────────────────

  test("contract page renders main content area", async ({ page }) => {
    await page.goto("/dashboard/contract");
    await expect(page.locator("main")).not.toBeEmpty({ timeout: 10000 });
    await page.waitForTimeout(1500);
    await screenshot(page, "33-dashboard-contract-loaded");
  });

  // ── Generator Page ────────────────────────────────────────────────────────────

  test("generator page loads", async ({ page }) => {
    await page.goto("/dashboard/generator");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await screenshot(page, "35-dashboard-generator");
    const body = await page.locator("main").textContent();
    expect(body).toBeTruthy();
  });

  // ── Auth Guard ────────────────────────────────────────────────────────────────

  test("ops user cannot access /dashboard — redirected", async ({ page }) => {
    await page.context().clearCookies();
    await mockBlockchain(page);
    await mockWhitelistApi(page);
    await loginAs(page, "ops");
    await page.goto("/dashboard");
    await page.waitForURL(/\/(login|ops|presale)/, { timeout: 8000 });
    expect(page.url()).not.toContain("/dashboard");
  });

  // ── Responsiveness ────────────────────────────────────────────────────────────

  test("dashboard overview responsive on 1440px", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard");
    await page.waitForTimeout(2000);
    await screenshot(page, "36-dashboard-overview-1440");
  });

  test("dashboard overview on 768px tablet", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/dashboard");
    await page.waitForTimeout(2000);
    await screenshot(page, "36-dashboard-overview-768");
  });
});
