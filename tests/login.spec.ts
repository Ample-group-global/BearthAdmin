import { test, expect } from "@playwright/test";

test.describe("Login page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("renders login form elements", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Bearth NFT Admin" })).toBeVisible();
    await expect(page.getByText("Sign in to access the dashboard")).toBeVisible();
    await expect(page.locator('input[autocomplete="username"]')).toBeVisible();
    await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText("Sign In");
  });

  test("shows role info boxes", async ({ page }) => {
    await expect(page.getByText("Technical Admin")).toBeVisible();
    await expect(page.getByText("Operations Staff")).toBeVisible();
  });

  test("password show/hide toggle works", async ({ page }) => {
    const passwordInput = page.locator('input[autocomplete="current-password"]');
    await expect(passwordInput).toHaveAttribute("type", "password");

    await page.locator('button[type="button"]').click();
    await expect(passwordInput).toHaveAttribute("type", "text");

    await page.locator('button[type="button"]').click();
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.fill('input[autocomplete="username"]', "wrong_user");
    await page.fill('input[autocomplete="current-password"]', "wrong_password");
    await page.click('button[type="submit"]');
    await expect(page.getByText(/Invalid username or password/i)).toBeVisible({ timeout: 5000 });
  });

  test("submit button is disabled while loading", async ({ page }) => {
    await page.fill('input[autocomplete="username"]', "tech_admin");
    await page.fill('input[autocomplete="current-password"]', "TechAdmin2024!");

    // Intercept login to slow it down
    await page.route("/api/auth/login", async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ role: "tech", success: true }),
      });
    });

    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();
    await expect(submitBtn).toBeDisabled();
  });

  test("tech admin login redirects to /dashboard", async ({ page }) => {
    await page.fill('input[autocomplete="username"]', "tech_admin");
    await page.fill('input[autocomplete="current-password"]', "TechAdmin2024!");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    expect(page.url()).toContain("/dashboard");
  });

  test("ops admin login redirects to /ops", async ({ page }) => {
    await page.fill('input[autocomplete="username"]', "ops_admin");
    await page.fill('input[autocomplete="current-password"]', "OpsAdmin2024!");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/ops/, { timeout: 10000 });
    expect(page.url()).toContain("/ops");
  });

  // ── Responsiveness ──────────────────────────────────────────────────────────

  test("form is centered and readable on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const card = page.locator(".bg-white.rounded-2xl");
    await expect(card).toBeVisible();
    // Card should not overflow the viewport
    const box = await card.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.width).toBeLessThanOrEqual(375);
  });

  test("form is readable on tablet", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByRole("heading", { name: "Bearth NFT Admin" })).toBeVisible();
    await expect(page.locator('input[autocomplete="username"]')).toBeVisible();
  });
});
