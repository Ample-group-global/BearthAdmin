/**
 * Playwright global setup — runs once before any browser opens.
 *
 * 1. Verifies BearthApi and BearthAdmin are reachable — fails immediately
 *    with a clear message if either is down, preventing 51 Chrome windows
 *    from opening just to fail on login.
 * 2. Warms up the Next.js login API route — the dev server compiles routes
 *    on first request; without this, the first browser POST returns 404.
 *
 * No browser is opened here. Each test handles its own login via loginAs().
 */

import { FullConfig } from '@playwright/test';

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

  // Warm up login API route — Next.js dev server compiles routes on first request.
  // Without this warm-up the first browser POST hits the route while it's still
  // compiling and gets a 404, causing the first login attempt to fail.
  try {
    await fetch(`${baseURL}/api/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: 'warmup@x.local', password: 'warmup' }),
      signal:  AbortSignal.timeout(10_000),
    });
    console.log('[setup] Login API route compiled and ready');
  } catch { /* ignore — we only care that compilation was triggered */ }

  console.log('[setup] All services ready — starting tests');
}
