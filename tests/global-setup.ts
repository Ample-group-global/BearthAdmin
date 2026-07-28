import { chromium, FullConfig } from '@playwright/test';
import path from 'path';

const TECH_AUTH  = path.join(process.cwd(), 'tests', '.auth', 'tech.json');

export default async function globalSetup(_config: FullConfig) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page    = await context.newPage();

  // ── Login as Technical user ───────────────────────────────────────────────
  await page.goto('http://localhost:3000/login');
  await page.waitForLoadState('networkidle');

  await page.fill('input[type="email"], input[name="email"], input[placeholder*="email" i]', 'amplecapitalholding@gmail.com');
  await page.fill('input[type="password"], input[name="password"]', 'amplecapitalholding@123');
  await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")');

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForLoadState('networkidle');

  await context.storageState({ path: TECH_AUTH });
  await browser.close();
}
