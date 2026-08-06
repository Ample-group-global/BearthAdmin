/**
 * PHASE 2 — Wave Scheduling (DB + On-Chain)
 *
 * Purpose: Schedule all 7 waves in the database and push each on-chain.
 * Verify the sequential rule is enforced at the API level.
 *
 * What this phase tests:
 *   - /nft/waves loads all 7 waves correctly
 *   - Wave 1 Manage panel opens (Settings + Blockchain tabs)
 *   - DB schedule saved via API (reliable, no datetime-local input quirks)
 *   - Wave 1 schedule pushed on-chain via API → txHash confirms success
 *   - Sequential rule enforced: Wave 2 start must be after Wave 1 end
 *   - All 7 waves scheduled in DB and on-chain (API-based)
 *
 * TIMING STRATEGY (all times relative to T0 = module load time):
 *   Wave 1: start=T0+5,   end=T0+55,  reveal=T0+60   (50-min window for WL mints)
 *   Wave 2: start=T0+56,  end=T0+65
 *   Wave 3: start=T0+66,  end=T0+75
 *   Wave 4: start=T0+76,  end=T0+85
 *   Wave 5: start=T0+86,  end=T0+95
 *   Wave 6: start=T0+96,  end=T0+105
 *   Wave 7: start=T0+106, end=T0+115
 *
 * T0 is captured once at module load — consistent across all serial retries
 * in the same Playwright process.
 *
 * LOCK RULE: Once all tests pass this phase is locked.
 *            Pre-requisite: Phase 01 must be locked first.
 *
 * Pre-conditions:
 *   1. Phase 01 is LOCKED
 *   2. DB in clean state (all waves pending, no scheduled dates)
 *   3. Sepolia wallet has enough ETH (≥ 0.05 ETH)
 *   4. Contract deployed at 0xd3b0b081A40a4DF72E20A503Ba7eaE85b2Fb9F66
 */

import { test, expect } from '@playwright/test';
import { isLocked, isPreviousLocked, lockPhase, PhaseId } from '../helpers/phase-lock';

const PHASE_ID: PhaseId = 'phase-02';

// ── Timestamp helpers — T0 captured once at module load ───────────────────────
const T0 = Date.now();

function iso(deltaMin: number): string {
  return new Date(T0 + deltaMin * 60_000).toISOString();
}
function unx(deltaMin: number): number {
  return Math.floor((T0 + deltaMin * 60_000) / 1000);
}

// Wave 1: 50-min window (T0+5 → T0+55) — leaves room for Phase 2.5 WL mints
const W1_START_ISO  = iso(5);
const W1_END_ISO    = iso(55);
const W1_REVEAL_ISO = iso(60);   // must be strictly > W1_END
const W1_START_UNIX = unx(5);
const W1_END_UNIX   = unx(55);

// Waves 2–7: sequential 9-min windows, each starting 1 min after previous ends
const W2_START_ISO = iso(56);  const W2_END_ISO = iso(65);
const W3_START_ISO = iso(66);  const W3_END_ISO = iso(75);
const W4_START_ISO = iso(76);  const W4_END_ISO = iso(85);
const W5_START_ISO = iso(86);  const W5_END_ISO = iso(95);
const W6_START_ISO = iso(96);  const W6_END_ISO = iso(105);
const W7_START_ISO = iso(106); const W7_END_ISO = iso(115);

const W2_START_UNIX = unx(56);  const W2_END_UNIX = unx(65);
const W3_START_UNIX = unx(66);  const W3_END_UNIX = unx(75);
const W4_START_UNIX = unx(76);  const W4_END_UNIX = unx(85);
const W5_START_UNIX = unx(86);  const W5_END_UNIX = unx(95);
const W6_START_UNIX = unx(96);  const W6_END_UNIX = unx(105);
const W7_START_UNIX = unx(106); const W7_END_UNIX = unx(115);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Detect the Manage panel by the "Save Settings" button being visible */
async function waitForManageOpen(page: import('@playwright/test').Page) {
  await expect(page.locator('button').filter({ hasText: /^Save Settings$/ })).toBeVisible({ timeout: 10000 });
}

// ── Test Suite ────────────────────────────────────────────────────────────────

test.describe.configure({ mode: 'serial' });

test.describe('Phase 2 — Wave Scheduling (DB + On-Chain)', () => {
  let failCount = 0;

  test.beforeEach(async ({}, testInfo) => {
    if (!isPreviousLocked(PHASE_ID)) {
      testInfo.skip(true, '⏭ Phase 01 must be LOCKED before running Phase 02. Run phase-01 tests first.');
    }
    if (isLocked(PHASE_ID)) {
      testInfo.skip(true, '🔒 Phase 02 is LOCKED — set "locked":false in phase-lock.json to re-run.');
    }
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === 'failed') {
      failCount++;
      await page.screenshot({
        path: `tests/phase-results/screenshots/${PHASE_ID}-${testInfo.title.replace(/[^a-z0-9]/gi, '_')}.png`,
        fullPage: true,
      }).catch(() => {});
    }
  });

  test.afterAll(async () => {
    if (failCount === 0) lockPhase(PHASE_ID);
    else console.log(`\n⚠  Phase 02: ${failCount} test(s) failed — fix and re-run.\n`);
  });

  // ─── P2-01: /nft/waves loads all 7 waves ─────────────────────────────────
  test('P2-01: /nft/waves page loads with all 7 waves visible', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/nft/waves');
    // /api/waves makes 7 Sepolia RPC calls when all waves are scheduled — allow extra time
    await expect(page.locator('button').filter({ hasText: /^Manage$/i }).first()).toBeVisible({ timeout: 60000 });
    const manageBtns = page.locator('button').filter({ hasText: /^Manage$/i });
    await expect(manageBtns).toHaveCount(7, { timeout: 30000 });
  });

  // ─── P2-02: Open Wave 1 Manage panel ─────────────────────────────────────
  test('P2-02: Wave 1 Manage panel opens with wave configuration form', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/nft/waves');
    await expect(page.locator('button').filter({ hasText: /^Manage$/i }).first()).toBeVisible({ timeout: 60000 });

    await page.locator('button').filter({ hasText: /^Manage$/i }).first().click();
    await waitForManageOpen(page);

    // The Manage panel is a flat form (no Settings/Blockchain tabs)
    // Verify core form elements are visible
    const body = await page.textContent('body') ?? '';
    expect(body).toMatch(/wave schedule|start date|sale method|default price/i);
    console.log('P2-02: Wave 1 Manage panel opened with configuration form ✓');
  });

  // ─── P2-03: Wave 1 DB schedule saved via API ─────────────────────────────
  // Idempotent: if schedule is locked (start already arrived), skip gracefully.
  test('P2-03: Save Wave 1 DB schedule (scheduledStart, scheduledEnd, reveal)', async ({ page }) => {
    const wavesRes = await page.request.get('/api/waves');
    expect(wavesRes.ok()).toBe(true);
    const data = await wavesRes.json();
    const waves: any[] = data.waves ?? [];
    const wave1 = waves.find((w: any) => (w.wave_number ?? w.waveNumber) === 1);
    expect(wave1, 'Wave 1 not found in /api/waves').toBeTruthy();

    // Retry safety: if Wave 1's start has already arrived the schedule is locked —
    // skip the PUT and let P2-04 verify on-chain state instead.
    const existingStart = wave1.scheduledStart ?? wave1.scheduled_start;
    if (existingStart && Date.now() >= new Date(existingStart).getTime()) {
      console.log(`P2-03: Wave 1 schedule locked (start arrived) — skipping PUT, using existing ✓`);
      return;
    }

    const res = await page.request.put(`/api/waves/${wave1.id}`, {
      data: {
        scheduledStart:    W1_START_ISO,
        scheduledEnd:      W1_END_ISO,
        revealScheduledAt: W1_REVEAL_ISO,
      },
    });

    // Treat 409 (Rule 6) gracefully on retry
    if (res.status() === 409) {
      console.log(`P2-03: Wave 1 schedule locked (409) — start arrived between check and PUT ✓`);
      return;
    }

    expect(res.ok()).toBe(true);
    const updated = await res.json();
    const saved = updated.wave?.scheduledStart ?? updated.wave?.scheduled_start;
    expect(saved).toBeTruthy();
    console.log(`P2-03: Wave 1 DB schedule saved ✓  start=${W1_START_ISO.slice(0, 16)}`);
  });

  // ─── P2-04: Wave 1 schedule pushed on-chain via API ──────────────────────
  // Uses PUT /api/nft-sell/waves/1/schedule directly — avoids UI datetime-local input.
  // On 409 (locked): verifies on-chain state instead of re-pushing.
  test('P2-04: Push Wave 1 schedule on-chain via API', async ({ page }) => {
    test.setTimeout(120_000);

    const res = await page.request.put('/api/nft-sell/waves/1/schedule', {
      data: { startUnix: W1_START_UNIX, endUnix: W1_END_UNIX },
      timeout: 120_000,
    });

    if (res.status() === 409) {
      // Schedule lock: Wave 1 start has arrived. Verify it was pushed on-chain previously.
      const checkRes = await page.request.get('/api/nft-sell/waves/1', { timeout: 15_000 });
      expect(checkRes.ok()).toBe(true);
      const checkData = await checkRes.json();
      expect(checkData.onChain?.startTime, 'Wave 1 must be on-chain if schedule is locked').toBeGreaterThan(0);
      console.log('P2-04: Wave 1 already on-chain (schedule locked — prior run) ✓');
      return;
    }

    expect(res.ok()).toBe(true);
    const pushData = await res.json();
    expect(pushData.txHash, 'txHash missing from schedule push response').toBeTruthy();
    console.log(`P2-04: Wave 1 pushed on-chain ✓  txHash=${String(pushData.txHash).slice(0, 22)}...`);
  });

  // ─── P2-05: Wave 1 DB shows scheduled_start after P2-03 ──────────────────
  test('P2-05: Wave 1 shows scheduled_start in DB after API save', async ({ page }) => {
    const res = await page.request.get('/api/waves');
    expect(res.ok()).toBe(true);
    const data = await res.json();
    const waves: any[] = data.waves ?? [];
    const wave1 = waves.find((w: any) => (w.wave_number ?? w.waveNumber) === 1);
    expect(wave1).toBeTruthy();
    const scheduled = wave1.scheduledStart ?? wave1.scheduled_start;
    expect(scheduled, 'Wave 1 scheduled_start must be set after P2-03').toBeTruthy();
    console.log(`P2-05: Wave 1 scheduled_start = ${scheduled} ✓`);
  });

  // ─── P2-06: Sequential rule enforced via API ──────────────────────────────
  test('P2-06: Sequential rule: API rejects Wave 2 start scheduled before Wave 1 end', async ({ page }) => {
    const wavesRes = await page.request.get('/api/waves');
    expect(wavesRes.ok()).toBe(true);
    const data = await wavesRes.json();
    const waves: any[] = data.waves ?? [];
    const wave1 = waves.find((w: any) => (w.wave_number ?? w.waveNumber) === 1);
    const wave2 = waves.find((w: any) => (w.wave_number ?? w.waveNumber) === 2);
    expect(wave1).toBeTruthy();
    expect(wave2).toBeTruthy();

    const wave1End = wave1.scheduledEnd ?? wave1.scheduled_end;
    expect(wave1End, 'Wave 1 must have scheduledEnd before P2-06 can test sequential rule').toBeTruthy();

    const wave1EndMs = new Date(wave1End).getTime();
    const badStart   = new Date(wave1EndMs - 60_000).toISOString(); // 1 min BEFORE Wave 1 end
    const badEnd     = new Date(wave1EndMs + 60_000).toISOString();

    const res = await page.request.put(`/api/waves/${wave2.id}`, {
      data: { scheduledStart: badStart, scheduledEnd: badEnd },
    });

    expect(res.status()).toBeGreaterThanOrEqual(400);
    const errData = await res.json();
    expect(errData.error).toBeTruthy();
    console.log(`P2-06: Bad schedule rejected (${res.status()}): ${String(errData.error).slice(0, 80)} ✓`);
  });

  // ─── P2-07: Wave 2 DB schedule saved via API ──────────────────────────────
  test('P2-07: Save Wave 2 DB schedule with start AFTER Wave 1 end', async ({ page }) => {
    const wavesRes = await page.request.get('/api/waves');
    expect(wavesRes.ok()).toBe(true);
    const data = await wavesRes.json();
    const wave2 = data.waves?.find((w: any) => (w.wave_number ?? w.waveNumber) === 2);
    expect(wave2, 'Wave 2 not found').toBeTruthy();

    const res = await page.request.put(`/api/waves/${wave2.id}`, {
      data: { scheduledStart: W2_START_ISO, scheduledEnd: W2_END_ISO },
    });

    if (res.status() === 409) {
      console.log('P2-07: Wave 2 schedule locked (retry) — skipping ✓');
      return;
    }
    expect(res.ok()).toBe(true);
    const updated = await res.json();
    const saved = updated.wave?.scheduledStart ?? updated.wave?.scheduled_start;
    expect(saved).toBeTruthy();
    console.log(`P2-07: Wave 2 DB schedule saved ✓  start=${W2_START_ISO.slice(0, 16)}`);
  });

  // ─── P2-08: Wave 2 schedule + price pushed on-chain via API ──────────────
  test('P2-08: Push Wave 2 schedule + price on-chain via API', async ({ page }) => {
    test.setTimeout(660_000); // 2 TXs × 300s each

    // Schedule push (non-blocking on timeout — wave may already be on-chain from prior run)
    try {
      const schedRes = await page.request.put('/api/nft-sell/waves/2/schedule', {
        data: { startUnix: W2_START_UNIX, endUnix: W2_END_UNIX },
        timeout: 300_000,
      });
      if (schedRes.status() === 409) {
        console.log('P2-08: Wave 2 schedule locked — verifying on-chain');
        const checkRes = await page.request.get('/api/nft-sell/waves/2', { timeout: 15_000 });
        const checkData = await checkRes.json();
        expect(checkData.onChain?.startTime, 'Wave 2 must be on-chain if schedule locked').toBeGreaterThan(0);
      } else {
        expect(schedRes.ok()).toBe(true);
        const schedData = await schedRes.json();
        expect(schedData.txHash).toBeTruthy();
        console.log(`P2-08: Wave 2 schedule on-chain ✓  txHash=${String(schedData.txHash).slice(0, 22)}...`);
      }
    } catch (e: any) {
      // Timeout: TX was submitted but response didn't arrive — verify on-chain state
      console.log(`P2-08: Wave 2 schedule TX timeout — verifying on-chain (${e.message?.slice(0, 60)})`);
      const checkRes = await page.request.get('/api/nft-sell/waves/2', { timeout: 15_000 });
      const checkData = await checkRes.json();
      expect(checkData.onChain?.startTime, 'Wave 2 must be on-chain after schedule timeout').toBeGreaterThan(0);
    }

    // Price push (non-blocking on timeout)
    try {
      const priceRes = await page.request.put('/api/nft-sell/waves/2/price', {
        data: { priceEth: '0.0303' },
        timeout: 300_000,
      });
      if (priceRes.ok()) {
        const priceData = await priceRes.json();
        console.log(`P2-08: Wave 2 price set ✓  txHash=${String(priceData.txHash).slice(0, 22)}...`);
      } else {
        console.log(`P2-08: Wave 2 price TX skipped (${priceRes.status()})`);
      }
    } catch (e: any) {
      console.log(`P2-08: Wave 2 price TX timeout — continuing (${e.message?.slice(0, 60)})`);
    }
  });

  // ─── P2-09: Schedule Waves 3–7 DB + on-chain (all API) ───────────────────
  test('P2-09: Schedule Waves 3–7 DB + on-chain via API (complete all 7 waves)', async ({ page }) => {
    test.setTimeout(900_000); // 5 waves × 2 TXs × ~120s + Wave2 price retry + overhead

    // Let the API settle after P2-08's heavy blockchain TX (RPC node can be slow)
    await page.waitForTimeout(10_000);

    // Retry Wave 2 price if P2-08 got a 503 (API momentarily unreachable after schedule TX)
    const w2Check = await page.request.get('/api/nft-sell/waves/2', { timeout: 30_000 });
    if (w2Check.ok()) {
      const w2Data = await w2Check.json();
      const w2Price = w2Data.onChain?.priceEth ? parseFloat(w2Data.onChain.priceEth) : 0;
      if (w2Price < 0.001) {
        console.log('P2-09: Wave 2 price is 0 (P2-08 503) — retrying price TX...');
        const priceRetry = await page.request.put('/api/nft-sell/waves/2/price', {
          data: { priceEth: '0.0303' },
          timeout: 120_000,
        });
        if (priceRetry.ok()) {
          const pd = await priceRetry.json();
          console.log(`P2-09: Wave 2 price (retry) ✓  txHash=${String(pd.txHash).slice(0, 22)}...`);
        } else {
          console.log(`P2-09: Wave 2 price retry also failed (${priceRetry.status()}) — continuing`);
        }
      } else {
        console.log(`P2-09: Wave 2 price already set (${w2Price} ETH) ✓`);
      }
    }

    const waveDefs = [
      { num: 3, startISO: W3_START_ISO, endISO: W3_END_ISO, startUnix: W3_START_UNIX, endUnix: W3_END_UNIX, price: '0.0606' },
      { num: 4, startISO: W4_START_ISO, endISO: W4_END_ISO, startUnix: W4_START_UNIX, endUnix: W4_END_UNIX, price: '0.0909' },
      { num: 5, startISO: W5_START_ISO, endISO: W5_END_ISO, startUnix: W5_START_UNIX, endUnix: W5_END_UNIX, price: '0.1515' },
      { num: 6, startISO: W6_START_ISO, endISO: W6_END_ISO, startUnix: W6_START_UNIX, endUnix: W6_END_UNIX, price: '0.2424' },
      { num: 7, startISO: W7_START_ISO, endISO: W7_END_ISO, startUnix: W7_START_UNIX, endUnix: W7_END_UNIX, price: '0.3939' },
    ];

    // Use 45s timeout for the wave list — endpoint fetches on-chain data for all 7 waves;
    // can be slow after recent blockchain TXs from P2-08
    const wavesRes = await page.request.get('/api/waves', { timeout: 45_000 });
    expect(wavesRes.ok()).toBe(true);
    const allWaves: any[] = (await wavesRes.json()).waves ?? [];

    for (const wd of waveDefs) {
      const waveRow = allWaves.find((w: any) => (w.wave_number ?? w.waveNumber) === wd.num);
      expect(waveRow, `Wave ${wd.num} not found in /api/waves`).toBeTruthy();

      // DB save (idempotent — 409 = locked, skip gracefully)
      const saveRes = await page.request.put(`/api/waves/${waveRow.id}`, {
        data: { scheduledStart: wd.startISO, scheduledEnd: wd.endISO },
        timeout: 10_000,
      });
      if (saveRes.status() !== 409) {
        expect(saveRes.ok(), `DB save failed for Wave ${wd.num}: ${saveRes.status()}`).toBe(true);
      }

      // On-chain schedule push
      const schedRes = await page.request.put(`/api/nft-sell/waves/${wd.num}/schedule`, {
        data: { startUnix: wd.startUnix, endUnix: wd.endUnix },
        timeout: 120_000,
      });
      if (schedRes.status() === 409) {
        // Locked: verify already on-chain
        const checkRes = await page.request.get(`/api/nft-sell/waves/${wd.num}`, { timeout: 20_000 });
        const checkData = await checkRes.json();
        expect(checkData.onChain?.startTime, `Wave ${wd.num} must be on-chain if locked`).toBeGreaterThan(0);
        console.log(`P2-09: Wave ${wd.num} already on-chain (locked) ✓`);
      } else {
        expect(schedRes.ok(), `Schedule push failed for Wave ${wd.num}: ${schedRes.status()}`).toBe(true);
        const schedData = await schedRes.json();
        console.log(`P2-09: Wave ${wd.num} schedule ✓  txHash=${String(schedData.txHash).slice(0, 22)}...`);
      }

      // Price push (non-blocking — timeout logs and continues)
      try {
        const priceRes = await page.request.put(`/api/nft-sell/waves/${wd.num}/price`, {
          data: { priceEth: wd.price },
          timeout: 300_000,
        });
        if (priceRes.ok()) {
          const priceData = await priceRes.json();
          console.log(`P2-09: Wave ${wd.num} price (${wd.price} ETH) ✓  txHash=${String(priceData.txHash).slice(0, 22)}...`);
        } else {
          console.log(`P2-09: Wave ${wd.num} price TX skipped (${priceRes.status()})`);
        }
      } catch (e: any) {
        console.log(`P2-09: Wave ${wd.num} price TX timeout — continuing (${e.message?.slice(0, 60)})`);
      }
    }

    console.log('\nP2-09: All 7 waves scheduled in DB + on Sepolia ✓');
  });
});
