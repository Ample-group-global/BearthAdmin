import { test, expect } from "@playwright/test";

test.use({ storageState: undefined });

const EMAIL = "amplecapitalholding@gmail.com";
const PASS  = "amplecapitalholding@123";

test("Login page — renders correctly", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("h1")).toContainText("Bearth Admin");
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.locator('button[type="submit"]')).toContainText("Sign In");
  await expect(page.locator('a[href="/forgot-password"]')).toBeVisible();
});

test("Login page — wrong credentials shows error", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[type="email"]', "wrong@example.com");
  await page.fill('input[type="password"]', "wrongpassword");
  await page.click('button[type="submit"]');
  await expect(page.locator("text=Incorrect email or password")).toBeVisible({ timeout: 10000 });
});

test("Login page — valid credentials redirect to dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 30000 });
  expect(page.url()).toContain("/dashboard");
});
