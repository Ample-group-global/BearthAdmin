/**
 * Playwright global setup — runs once before any browser opens.
 *
 * 1. Verifies BearthApi and BearthAdmin are reachable.
 * 2. Logs in with real tech credentials and saves the session to tech.json.
 *    All 51 tests reuse this single session — no per-test login needed.
 */

import { FullConfig, chromium } from '@playwright/test';
import path from 'path';

const EMAIL   = "amplecapitalholding@gmail.com";
const PASS    = "amplecapitalholding@123";
const TECH_AUTH = path.join(process.cwd(), "tests", ".auth", "tech.json");

async function waitForService(url: string, label: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.status < 600) {
        console.log(`[setup] ${label} ready (HTTP ${res.status})`);
        return;
      }
    } catch { /* not ready yet */ }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error(
    `[setup] ${label} did not become ready within ${timeoutMs / 1000}s.\n` +
    `  Make sure both services are running before starting the test suite.\n  URL: ${url}`,
  );
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:3000';

  console.log('[setup] Verifying services...');
  await Promise.all([
    waitForService('http://localhost:8000/api/auth/admin/me', 'BearthApi  (port 8000)'),
    waitForService(`${baseURL}/login`,                        'BearthAdmin (port 3000)'),
  ]);

  // Wait for BearthApi's startup event-sync storm to settle before attempting login.
  // On first boot the contract listeners pick up any recent Sepolia events; this
  // phase lasts ~30-60 s.  Waiting here gives the DB pool time to stabilise so
  // the auth pool is free when we try to log in.
  console.log('[setup] Waiting 60 s for startup DB activity to settle...');
  await new Promise(r => setTimeout(r, 60_000));
  console.log('[setup] Settled — attempting login...');

  // Login once with real credentials — saves session to tech.json so all tests
  // share a single login session (no repeated logins per test).
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page    = await context.newPage();

  try {
    let loggedIn = false;
    for (let attempt = 1; attempt <= 10; attempt++) {
      try {
        await page.goto(`${baseURL}/login`);
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
        await page.fill('input[type="email"], input[name="email"]', EMAIL);
        await page.fill('input[type="password"], input[name="password"]', PASS);
        await page.click('button[type="submit"]');
        await page.waitForURL('**/dashboard**', { timeout: 25000 });
        loggedIn = true;
        break;
      } catch {
        if (attempt === 10) {
          console.error('[setup] Login failed after 10 attempts — check API and DB');
          break;
        }
        console.log(`[setup] Login attempt ${attempt} failed — retrying in 5s...`);
        await new Promise(r => setTimeout(r, 5000));
      }
    }

    if (loggedIn) {
      await context.storageState({ path: TECH_AUTH });
      console.log('[setup] Session saved to tech.json — all tests will reuse this login');
    } else {
      // Write empty state so tests don't crash on missing file
      require('fs').writeFileSync(TECH_AUTH, JSON.stringify({ cookies: [], origins: [] }));
      console.warn('[setup] Could not login — tests will attempt their own login');
    }
  } finally {
    await browser.close();
  }

  console.log('[setup] All services ready — starting tests');
}
