// Route: /referrers — Referrer management page
import { test, expect } from "@playwright/test";
import path from "path";

test.use({ storageState: path.join(process.cwd(), "tests", ".auth", "admin.json") });

test.describe("Presale Referrers Page", () => {
  test("loads and shows heading", async ({ page }) => {
    // Increase timeout: cold Next.js compilation can take 60-90s on first run
    test.setTimeout(120000);
    await page.goto("/referrers", { timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
    expect(page.url()).not.toContain("/login");

    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 20000 });
    await expect(heading).toContainText(/Referrer/i);
  });

  test("table or empty state renders", async ({ page }) => {
    await page.goto("/referrers");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    // Wait for loading spinner to clear
    await page.locator('svg.animate-spin').waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
    // Custom table: shows <table> when data exists, or div.rounded-xl.p-16 (empty state)
    const content = page.locator('table').or(page.locator('div.rounded-xl.p-16'));
    await expect(content.first()).toBeVisible({ timeout: 15000 });
  });

  test("search field is present", async ({ page }) => {
    await page.goto("/referrers");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});

    const searchInput = page.locator('input[type="text"], input[placeholder*="Search" i]').first();
    await expect(searchInput).toBeVisible({ timeout: 20000 });
  });

  test("add referrer button or new referrer option is available", async ({ page }) => {
    await page.goto("/referrers");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});

    // Button text is "New Ext. Referrer"
    const addBtn = page.locator('button').filter({ hasText: /New.*Referrer/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 20000 });
  });
});
