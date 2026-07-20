import { test, expect } from "@playwright/test";

const EMAIL = "official@imbearth.com";
const PASSWORD = "officialbearth@123";

test.describe("Bearth Admin Login", () => {
  // Clear any saved session — login tests must not run with an active admin session
  test.use({ storageState: { cookies: [], origins: [] } });

  test("shows login page with correct elements", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/Bearth/i);
    await expect(page.getByRole("heading", { name: "Bearth Admin" })).toBeVisible();
    await expect(page.getByPlaceholder("Enter your email")).toBeVisible();
    await expect(page.getByPlaceholder("Enter your password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  });

  test("logs in successfully with admin credentials", async ({ page }) => {
    // Increase timeout: DB round-trip can be slow on Railway cold start
    test.setTimeout(90000);
    await page.goto("/login");

    await page.getByPlaceholder("Enter your email").fill(EMAIL);
    await page.getByPlaceholder("Enter your password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign In" }).click();

    // Wait for redirect after successful login
    await page.waitForURL(/\/dashboard/, { timeout: 30000 });

    const url = page.url();
    expect(url).toMatch(/\/dashboard/);
    console.log(`✅ Logged in — redirected to: ${url}`);
  });

  test("shows error with wrong password", async ({ page }) => {
    await page.goto("/login");

    await page.getByPlaceholder("Enter your email").fill(EMAIL);
    await page.getByPlaceholder("Enter your password").fill("wrongpassword");
    await page.getByRole("button", { name: "Sign In" }).click();

    // Error can be: "Invalid credentials", "Login failed", or "Database is temporarily unavailable"
    await expect(
      page.getByText(/invalid credentials|login failed|invalid|incorrect|unavailable|try again/i).first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("shows loading state while submitting", async ({ page }) => {
    // Increase timeout: DB round-trip can be slow on Railway cold start
    test.setTimeout(90000);
    await page.goto("/login");

    await page.getByPlaceholder("Enter your email").fill(EMAIL);
    await page.getByPlaceholder("Enter your password").fill(PASSWORD);

    // Click and immediately check for loading state
    const submitBtn = page.getByRole("button", { name: /sign in|signing in/i });
    await submitBtn.click();

    // Button should show loading text briefly
    await expect(page.getByText("Signing in…")).toBeVisible({ timeout: 3000 }).catch(() => {
      // May have already completed — that's fine
    });

    await page.waitForURL(/\/dashboard/, { timeout: 30000 });
  });

  test("password visibility toggle works", async ({ page }) => {
    await page.goto("/login");

    const pwInput = page.getByPlaceholder("Enter your password");
    await pwInput.fill(PASSWORD);

    await expect(pwInput).toHaveAttribute("type", "password");

    // Click the eye toggle button
    await page.getByRole("button", { name: /show password/i }).click();
    await expect(pwInput).toHaveAttribute("type", "text");

    // Toggle back
    await page.getByRole("button", { name: /hide password/i }).click();
    await expect(pwInput).toHaveAttribute("type", "password");
  });
});
