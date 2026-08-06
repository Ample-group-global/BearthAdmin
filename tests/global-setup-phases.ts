/**
 * global-setup-phases.ts
 *
 * Fixed global setup for phase tests.
 * Differences from global-setup.ts:
 *   - Does NOT hardcode http://localhost:8000 (CI-01 fix)
 *   - Does NOT wait 60s unconditionally (SI-07 fix)
 *   - Only checks BearthAdmin reachability (BearthApi is checked via proxy)
 *   - Creates .auth directory if missing
 *
 * Used by: playwright.phases.config.ts
 */

import { FullConfig, chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import http from 'http';
import https from 'https';

const EMAIL     = 'amplecapitalholding@gmail.com';
const PASS      = 'amplecapitalholding@123';
const TECH_AUTH = path.join(process.cwd(), 'tests', '.auth', 'tech.json');

function httpGet(url: string, timeoutMs: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
  });
}

async function waitForService(url: string, label: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const status = await httpGet(url, 5000);
      if (status > 0 && status < 600) {
        console.log(`[phases-setup] ${label} ready (HTTP ${status})`);
        return;
      }
    } catch (e: any) {
      console.log(`[phases-setup] ${label} not ready yet: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error(`[phases-setup] ${label} did not become ready within ${timeoutMs / 1000}s. URL: ${url}`);
}

export default async function globalSetupPhases(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:3000';

  // If a valid session already exists (from a prior run), skip service wait + re-login.
  // The phase tests reuse this session; no need to recreate it each run.
  if (fs.existsSync(TECH_AUTH)) {
    try {
      const stored = JSON.parse(fs.readFileSync(TECH_AUTH, 'utf8'));
      if (Array.isArray(stored.cookies) && stored.cookies.length > 0) {
        console.log('[phases-setup] Valid session found in tech.json — skipping re-login');
        return;
      }
    } catch { /* invalid JSON — fall through to full setup */ }
  }

  console.log(`[phases-setup] Checking BearthAdmin at ${baseURL}...`);
  await waitForService(`${baseURL}/login`, 'BearthAdmin');

  // Ensure .auth directory exists
  fs.mkdirSync(path.dirname(TECH_AUTH), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page    = await context.newPage();

  try {
    let loggedIn = false;

    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await page.goto(`${baseURL}/login`);
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
        await page.fill('input[type="email"], input[name="email"]', EMAIL);
        await page.fill('input[type="password"], input[name="password"]', PASS);
        await page.click('button[type="submit"]');
        await page.waitForURL('**/dashboard**', { timeout: 30_000 });
        loggedIn = true;
        console.log(`[phases-setup] Logged in successfully on attempt ${attempt}`);
        break;
      } catch (err) {
        if (attempt === 5) {
          console.error(`[phases-setup] Login failed after 5 attempts`);
          break;
        }
        console.log(`[phases-setup] Login attempt ${attempt} failed — retrying in 5s...`);
        await new Promise(r => setTimeout(r, 5000));
      }
    }

    if (loggedIn) {
      await context.storageState({ path: TECH_AUTH });
      console.log(`[phases-setup] Session saved to ${TECH_AUTH}`);
    } else {
      fs.writeFileSync(TECH_AUTH, JSON.stringify({ cookies: [], origins: [] }));
      console.warn('[phases-setup] Could not login — phase tests will fail auth checks');
    }
  } finally {
    await browser.close();
  }

  console.log('[phases-setup] Setup complete — starting phase tests');
}
