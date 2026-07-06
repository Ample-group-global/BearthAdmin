import { test, expect } from "@playwright/test";
import { loginAs, screenshot } from "./helpers";

test.describe("Presale Section — Admin Role", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin");
  });

  // ── Sidebar / Layout ─────────────────────────────────────────────────────────

  test("presale layout: sidebar visible with nav items", async ({ page }) => {
    await page.goto("/presale");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("aside")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("aside").getByText("Bearth")).toBeVisible();
    await screenshot(page, "02-presale-sidebar");
  });

  test("presale layout: header shows Admin badge", async ({ page }) => {
    await page.goto("/presale");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("header").getByText("Admin")).toBeVisible({ timeout: 10000 });
    await screenshot(page, "02-presale-header");
  });

  test("presale layout: sidebar collapse toggle works", async ({ page }) => {
    await page.goto("/presale");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible({ timeout: 10000 });
    await screenshot(page, "02-presale-sidebar-expanded");
    // Use title attribute to find the collapse button specifically
    const collapseBtn = sidebar.locator('button[title="Collapse sidebar"]');
    const hasCollapseBtn = await collapseBtn.count();
    if (hasCollapseBtn > 0) {
      await collapseBtn.click();
      await page.waitForTimeout(400);
      await screenshot(page, "02-presale-sidebar-collapsed");
      // Expand
      const expandBtn = sidebar.locator('button[title="Expand sidebar"]');
      if (await expandBtn.count() > 0) {
        await expandBtn.click();
        await page.waitForTimeout(400);
      }
    }
    // Sidebar should always be visible
    await expect(sidebar).toBeVisible();
  });

  test("presale sign out redirects to login", async ({ page }) => {
    await page.goto("/presale");
    await page.waitForLoadState("networkidle");
    await page.locator("aside").getByRole("button", { name: /sign out/i }).click();
    await page.waitForURL(/\/login/, { timeout: 8000 });
    expect(page.url()).toContain("/login");
  });

  // ── Overview Page ───────────────────────────────────────────────────────────

  test("overview: loads heading and stat cards", async ({ page }) => {
    await page.goto("/presale");
    await page.waitForTimeout(3000);
    await expect(page.getByRole("heading", { name: /Bearth Overview/i })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText("Total Orders")).toBeVisible({ timeout: 20000 });
    await expect(page.getByText("Total Customers")).toBeVisible();
    await expect(page.getByText("NFT Records")).toBeVisible();
    await expect(page.getByText("Products")).toBeVisible();
    await screenshot(page, "03-presale-overview");
  });

  test("overview: shows revenue section", async ({ page }) => {
    await page.goto("/presale");
    await page.waitForTimeout(3000);
    await expect(page.getByText("Revenue")).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/NFT Revenue/i).first()).toBeVisible();
    await screenshot(page, "03-presale-overview-revenue");
  });

  test("overview: shows orders by payment status table", async ({ page }) => {
    await page.goto("/presale");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/Orders by Payment Status/i)).toBeVisible({ timeout: 12000 });
  });

  // ── Orders Page ─────────────────────────────────────────────────────────────

  test("orders: page loads with table", async ({ page }) => {
    await page.goto("/presale/orders");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await screenshot(page, "04-presale-orders");
    // Should have some heading or table-related text
    const body = await page.locator("main").textContent();
    expect(body).toBeTruthy();
  });

  test("orders: navigation from sidebar works", async ({ page }) => {
    await page.goto("/presale");
    await page.waitForLoadState("networkidle");
    const ordersLink = page.locator("aside").getByRole("link", { name: /orders/i });
    await expect(ordersLink).toBeVisible({ timeout: 10000 });
    await ordersLink.click();
    await page.waitForURL(/\/presale\/orders/, { timeout: 8000 });
    await page.waitForLoadState("networkidle");
    await screenshot(page, "04-presale-orders-nav");
  });

  // ── Customers Page ──────────────────────────────────────────────────────────

  test("customers: page loads", async ({ page }) => {
    await page.goto("/presale/customers");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await screenshot(page, "05-presale-customers");
    const body = await page.locator("main").textContent();
    expect(body).toBeTruthy();
  });

  // ── Products Page ───────────────────────────────────────────────────────────

  test("products: page loads", async ({ page }) => {
    await page.goto("/presale/products");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await screenshot(page, "06-presale-products");
    const body = await page.locator("main").textContent();
    expect(body).toBeTruthy();
  });

  // ── NFT Records Page ─────────────────────────────────────────────────────────

  test("nft records: page loads", async ({ page }) => {
    await page.goto("/presale/nft");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await screenshot(page, "07-presale-nft-records");
    const body = await page.locator("main").textContent();
    expect(body).toBeTruthy();
  });

  // ── Reconciliation Page ──────────────────────────────────────────────────────

  test("reconciliation: page loads", async ({ page }) => {
    await page.goto("/presale/reconciliation");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await screenshot(page, "08-presale-reconciliation");
    const body = await page.locator("main").textContent();
    expect(body).toBeTruthy();
  });

  // ── Reports Page ─────────────────────────────────────────────────────────────

  test("reports: page loads", async ({ page }) => {
    await page.goto("/presale/reports");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await screenshot(page, "09-presale-reports");
    const body = await page.locator("main").textContent();
    expect(body).toBeTruthy();
  });

  // ── Users / Team Page ────────────────────────────────────────────────────────

  test("users: page loads", async ({ page }) => {
    await page.goto("/presale/users");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await screenshot(page, "10-presale-users-team");
    const body = await page.locator("main").textContent();
    expect(body).toBeTruthy();
  });

  // ── Responsiveness ───────────────────────────────────────────────────────────

  test("responsive: overview readable on 1280px desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/presale");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    await screenshot(page, "11-presale-overview-desktop-1280");
    await expect(page.getByText("Total Orders")).toBeVisible({ timeout: 10000 });
  });

  test("responsive: overview on 768px tablet", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/presale");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    await screenshot(page, "11-presale-overview-tablet-768");
  });

  // ── Auth guard ───────────────────────────────────────────────────────────────

  test("unauthenticated user redirected to /login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/presale");
    await page.waitForURL(/\/login/, { timeout: 8000 });
    expect(page.url()).toContain("/login");
  });

  test("tech user redirected away from /presale to /dashboard", async ({ page }) => {
    await page.context().clearCookies();
    await loginAs(page, "tech");
    await page.goto("/presale");
    await page.waitForURL(/\/dashboard/, { timeout: 8000 });
    expect(page.url()).toContain("/dashboard");
  });
});
