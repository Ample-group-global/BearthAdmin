/**
 * Playwright global setup — runs once before any browser opens.
 *
 * Strategy: authenticate via direct API call (no UI interaction).
 * This eliminates all sources of login flakiness:
 *   - No React hydration timing races
 *   - No networkidle vs DOM readiness ambiguity
 *   - No fill() event-propagation issues on controlled inputs
 *   - Unaffected by dev-server chunk compilation delays
 *
 * The session cookie from the API response is injected directly into
 * a saved storage state that all tests reuse.
 */

import { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const EMAIL     = "amplecapitalholding@gmail.com";
const PASS      = "amplecapitalholding@123";
const TECH_AUTH = path.join(process.cwd(), "tests", ".auth", "tech.json");

async function waitForService(url: string, label: string, timeoutMs = 90_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
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

// Authenticate directly against BearthApi (port 8000) — bypasses the Next.js
// proxy layer which is unstable during dev-server compilation warm-up.
// BearthAdmin's /api/auth/login is just a thin proxy to this endpoint anyway.
async function loginViaApi(retries = 8): Promise<string | null> {
  const API_BASE = 'http://localhost:8000';

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${API_BASE}/api/auth/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASS }),
        signal: AbortSignal.timeout(20_000),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        console.log(`[setup] Login attempt ${attempt} — HTTP ${res.status}: ${JSON.stringify(data)?.slice(0, 120)}`);
        if (res.status === 401 || res.status === 403) {
          throw new Error(`[setup] Credentials rejected (${res.status}) — check EMAIL/PASS in global-setup.ts`);
        }
        // 5xx / 503 — server not ready yet, retry
      } else {
        const token: string | null = data?.token ?? data?.access_token ?? null;
        if (token) {
          console.log(`[setup] Login succeeded on attempt ${attempt}`);
          return token;
        }
        console.log(`[setup] Login attempt ${attempt} — response OK but no token in: ${JSON.stringify(data)?.slice(0, 120)}`);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.startsWith('[setup]')) throw err;
      console.log(`[setup] Login attempt ${attempt} failed — ${err instanceof Error ? err.message : err}`);
    }

    if (attempt < retries) {
      const delay = Math.min(5000 * attempt, 20_000);
      console.log(`[setup] Retrying in ${delay / 1000}s…`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  return null;
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:3000';

  // ── 1. Wait for both services ──────────────────────────────────────────────
  console.log('[setup] Verifying services...');
  await Promise.all([
    waitForService('http://localhost:8000/api/auth/admin/me', 'BearthApi  (port 8000)'),
    waitForService(`${baseURL}/login`,                        'BearthAdmin (port 3000)'),
  ]);

  // ── 2. Let the server finish startup DB work ───────────────────────────────
  // BearthApi's contract listeners run a Sepolia event-sync sweep on boot.
  // This uses DB pool connections; waiting lets the pool stabilise so the
  // auth query doesn't compete with the sync burst.
  console.log('[setup] Waiting 60 s for startup DB activity to settle...');
  await new Promise(r => setTimeout(r, 60_000));
  console.log('[setup] Settled — authenticating via API...');

  // ── 3. Authenticate directly against BearthApi — no browser UI ────────────
  const sessionToken = await loginViaApi();

  if (!sessionToken) {
    // Write empty state so tests don't crash on missing file, then fail loudly
    fs.mkdirSync(path.dirname(TECH_AUTH), { recursive: true });
    fs.writeFileSync(TECH_AUTH, JSON.stringify({ cookies: [], origins: [] }));
    throw new Error('[setup] Could not obtain a session token after all retries — tests aborted.');
  }

  // ── 4. Build storage state with the session cookie ────────────────────────
  const origin = new URL(baseURL).origin;
  const storageState = {
    cookies: [
      {
        name:     'admin_session',
        value:    sessionToken,
        domain:   new URL(baseURL).hostname,
        path:     '/',
        expires:  Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
        httpOnly: true,
        secure:   false,
        sameSite: 'Lax' as const,
      },
    ],
    origins: [
      {
        origin,
        localStorage: [],
      },
    ],
  };

  fs.mkdirSync(path.dirname(TECH_AUTH), { recursive: true });
  fs.writeFileSync(TECH_AUTH, JSON.stringify(storageState, null, 2));
  console.log('[setup] Session saved to tech.json — all tests will reuse this login');
  console.log('[setup] All services ready — starting tests');
}
