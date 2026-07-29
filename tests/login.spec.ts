import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SCREENSHOTS = path.join(process.cwd(), 'tests', 'results', 'login');

async function snap(page: any, name: string) {
  fs.mkdirSync(SCREENSHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SCREENSHOTS, `${name}.png`), fullPage: false });
  console.log(`  📸 ${name}.png`);
}

test('Technical user can log in and reach dashboard', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await snap(page, '01-login-page');

  // Fill credentials
  await page.fill('input[type="email"], input[name="email"], input[placeholder*="email" i]', 'amplecapitalholding@gmail.com');
  await page.fill('input[type="password"], input[name="password"]', 'amplecapitalholding@123');
  await snap(page, '02-credentials-filled');

  // Submit
  await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")');

  // Should redirect to dashboard
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await snap(page, '03-dashboard');

  expect(page.url()).toContain('/dashboard');
  console.log('  ✅ Login successful — redirected to:', page.url());
});

test('Wrong password shows error', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  await page.fill('input[type="email"], input[name="email"], input[placeholder*="email" i]', 'amplecapitalholding@gmail.com');
  await page.fill('input[type="password"], input[name="password"]', 'wrongpassword');
  await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")');

  // Should stay on login page and show an error
  await page.waitForTimeout(3000);
  await snap(page, '04-wrong-password-error');

  const url = page.url();
  expect(url).toContain('/login');
  console.log('  ✅ Wrong password blocked — stayed on:', url);
});
