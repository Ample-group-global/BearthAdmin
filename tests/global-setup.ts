import { chromium, FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const TECH_AUTH = path.join(process.cwd(), 'tests', '.auth', 'tech.json');

function isTechAuthValid(): boolean {
  if (!fs.existsSync(TECH_AUTH)) return false;
  try {
    const state = JSON.parse(fs.readFileSync(TECH_AUTH, 'utf8'));
    const session = state.cookies?.find((c: any) => c.name === 'admin_session');
    if (!session) return false;
    // expires is in seconds; -1 means session cookie (no expiry set)
    if (session.expires === -1) return true;
    return session.expires > Date.now() / 1000 + 300; // valid for at least 5 more minutes
  } catch {
    return false;
  }
}

export default async function globalSetup(_config: FullConfig) {
  // Reuse cached session if still valid — avoids needing DB for auth re-creation
  if (isTechAuthValid()) {
    console.log('[global-setup] Reusing valid cached tech session');
    return;
  }

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
