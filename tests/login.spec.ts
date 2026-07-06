import { test, expect } from "@playwright/test";
import { screenshot } from "./helpers";

test.describe("Login Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/login");
  });

  test("renders all form elements", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Bearth Admin" })).toBeVisible();
    await expect(page.getByText("Sign in to access the dashboard")).toBeVisible();
    await expect(page.locator('input[autocomplete="email"]')).toBeVisible();
    await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText("Sign In");
    await screenshot(page, "01-login-page");
  });

  test("shows forgot password link", async ({ page }) => {
    await expect(page.getByRole("link", { name: "Forgot password?" })).toBeVisible();
  });

  test("password show/hide toggle works", async ({ page }) => {
    const pw = page.locator('input[autocomplete="current-password"]');
    await expect(pw).toHaveAttribute("type", "password");
    await page.locator('button[type="button"]').click();
    await expect(pw).toHaveAttribute("type", "text");
    await page.locator('button[type="button"]').click();
    await expect(pw).toHaveAttribute("type", "password");
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.fill('input[autocomplete="email"]', "bad@bad.com");
    await page.fill('input[autocomplete="current-password"]', "wrongpassword");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=Invalid").or(page.locator("text=failed").or(page.locator("text=error")))).toBeVisible({ timeout: 8000 });
    await screenshot(page, "01-login-error");
  });

  test("submit button disables while loading", async ({ page }) => {
    await page.fill('input[autocomplete="email"]', "admin@bearth.local");
    await page.fill('input[autocomplete="current-password"]', "Admin2024!");
    await page.route("/api/auth/login", async (route) => {
      await new Promise((r) => setTimeout(r, 600));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ role: "admin", success: true }) });
    });
    const btn = page.locator('button[type="submit"]');
    await btn.click();
    await expect(btn).toBeDisabled();
  });

  test("admin login redirects to /presale", async ({ page }) => {
    await page.fill('input[autocomplete="email"]', "admin@bearth.local");
    await page.fill('input[autocomplete="current-password"]', "Admin2024!");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/presale/, { timeout: 15000 });
    expect(page.url()).toContain("/presale");
  });

  test("ops login redirects to /presale", async ({ page }) => {
    await page.fill('input[autocomplete="email"]', "ops@bearth.local");
    await page.fill('input[autocomplete="current-password"]', "Ops2024!");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/presale/, { timeout: 15000 });
    expect(page.url()).toContain("/presale");
  });

  test("tech login redirects to /dashboard", async ({ page }) => {
    await page.fill('input[autocomplete="email"]', "tech@bearth.local");
    await page.fill('input[autocomplete="current-password"]', "Tech2024!");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    expect(page.url()).toContain("/dashboard");
  });

  test("form is usable on mobile (375px)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/login");
    const card = page.locator(".rounded-2xl").first();
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.width).toBeLessThanOrEqual(375);
    await screenshot(page, "01-login-mobile");
  });

  test("form is readable on tablet (768px)", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Bearth Admin" })).toBeVisible();
    await screenshot(page, "01-login-tablet");
  });
});
