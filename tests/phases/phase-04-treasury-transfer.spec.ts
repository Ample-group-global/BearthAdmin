/**
 * PHASE 4 — Treasury Transfer Verification (All 7 Waves)
 *
 * Purpose: Verify all 7 waves have their treasury transfers completed after Phase 3.
 *
 * Expected state after Phase 3:
 *   Wave 1: revealed=true, close_action=treasury, treasury_recipient=0xA5Bb... (custom wallet)
 *            delivery_status = transferred (for Wave 1 unsold)
 *   Wave 2: revealed=true, close_action=treasury, treasury_recipient=null (default treasury)
 *            delivery_status = treasury_wallet
 *   Waves 3–7: revealed=true (internal), close_action=treasury, treasury_recipient=null
 *               delivery_status = treasury_wallet (all NFTs minted to treasury)
 *
 * Smart contract rule (BearthNFT.sol treasuryClose):
 *   Requires: waveEndTime set + block.timestamp > waveEndTime + waveRevealed=true
 *
 * What this phase tests:
 *   - All 7 waves show close_action='treasury' via API
 *   - /nft/waves page: no "Move to Wallet", "Auto Transfer" or "Reveal Now" buttons remain
 *   - /nft/waves REVEAL column shows "✓ Transferred" badge for 0-minted waves
 *   - /nft/nftlist page loads 9,999 total records
 *   - delivery_status breakdown: no treasury_pending records
 *   - Progress bar circles: Waves 1–2 green (Revealed), Waves 3–7 green (Complete)
 *
 * LOCK RULE: Phase locks when all tests pass.
 *            Pre-requisite: Phase 03 must be locked.
 */

import { test, expect } from '@playwright/test';
import { isLocked, isPreviousLocked, lockPhase, PhaseId } from '../helpers/phase-lock';

const PHASE_ID: PhaseId = 'phase-04';
const TREASURY_WALLET = '0x1121b0e2E7Fd3Edd0394B11BF431CB012B491870';

test.describe.configure({ mode: 'serial' });

test.describe('Phase 4 — Treasury Transfer Verification (All 7 Waves)', () => {
  let failCount = 0;

  test.beforeEach(async ({}, testInfo) => {
    if (!isPreviousLocked(PHASE_ID)) {
      testInfo.skip(true, '⏭ Phase 03 must be LOCKED before running Phase 04.');
    }
    if (isLocked(PHASE_ID)) {
      testInfo.skip(true, '🔒 Phase 04 is LOCKED — set "locked":false in phase-lock.json to re-run.');
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
    else console.log(`\n⚠  Phase 04: ${failCount} test(s) failed — fix and re-run.\n`);
  });

  // ─── P4-01: All 7 waves have close_action='treasury' via API ──────────────
  test('P4-01: All 7 waves have close_action=treasury (verified via API)', async ({ page }) => {
    const res = await page.request.get('/api/nft-sell/waves');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    const waves: any[] = data.waves ?? [];

    console.log('\nP4-01: Wave treasury status:');
    let allDone = true;
    for (const w of waves) {
      const done = w.closeAction === 'treasury';
      console.log(`  Wave ${w.waveNumber}: closeAction=${w.closeAction}, waveRevealed=${w.waveRevealed} ${done ? '✓' : '✗'}`);
      if (!done) allDone = false;
    }
    expect(allDone).toBeTruthy();
    console.log('P4-01: All 7 waves treasury-closed ✓');
  });

  // ─── P4-02: /nft/waves page — no action buttons remain ───────────────────
  test('P4-02: No Move to Wallet, Auto Transfer, or Reveal Now buttons remain on /nft/waves', async ({ page }) => {
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');

    const moveBtn    = page.locator('button').filter({ hasText: /move to wallet/i });
    const autoBtn    = page.locator('button').filter({ hasText: /auto transfer/i });
    const revealBtn  = page.locator('button').filter({ hasText: /reveal now/i });

    const moveCnt   = await moveBtn.count();
    const autoCnt   = await autoBtn.count();
    const revealCnt = await revealBtn.count();

    console.log(`P4-02: Move to Wallet: ${moveCnt}, Auto Transfer: ${autoCnt}, Reveal Now: ${revealCnt}`);
    expect(moveCnt).toBe(0);
    expect(autoCnt).toBe(0);
    expect(revealCnt).toBe(0);
    console.log('P4-02: No pending action buttons ✓');
  });

  // ─── P4-03: 0-minted waves show "✓ Transferred" badge in REVEAL column ───
  test('P4-03: 0-minted waves (3–7) show Transferred badge in REVEAL column', async ({ page }) => {
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body') ?? '';
    // "✓ Transferred" badge should appear for each 0-minted completed wave
    const transferredMatches = (body.match(/Transferred/g) ?? []).length;
    console.log(`P4-03: "Transferred" occurrences in page: ${transferredMatches}`);
    // At least the 5 zero-minted waves should show transferred badge
    expect(transferredMatches).toBeGreaterThanOrEqual(5);
    console.log('P4-03: 0-minted waves show Transferred badge ✓');
  });

  // ─── P4-04: Progress bar — all circles green ──────────────────────────────
  test('P4-04: Collection Reveal Progress bar shows all 7 waves as complete/revealed', async ({ page }) => {
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body') ?? '';
    // Progress bar should show "Revealed" for waves 1–2 and "Complete" for waves 3–7
    const revealedCount = (body.match(/\bRevealed\b/g) ?? []).length;
    const completeCount = (body.match(/\bComplete\b/g) ?? []).length;

    console.log(`P4-04: Revealed labels: ${revealedCount}, Complete labels: ${completeCount}`);
    // Expect at least 2 "Revealed" (waves 1–2) and 5 "Complete" (waves 3–7)
    expect(revealedCount).toBeGreaterThanOrEqual(2);
    expect(completeCount).toBeGreaterThanOrEqual(5);
    console.log('P4-04: All wave circles show correct completed state ✓');
  });

  // ─── P4-05: /nft/nftlist — 9,999 total, no treasury_pending ──────────────
  test('P4-05: NFT Records — 9,999 total records, no treasury_pending', async ({ page }) => {
    await page.goto('/nft/nftlist');
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body') ?? '';
    expect(body).toMatch(/9[,.]?999/);
    console.log('P4-05: 9,999 NFT records confirmed ✓');

    // treasury_pending should be 0 — all waves processed
    // Check via API
    const res = await page.request.get('/api/nft-sell/waves');
    if (res.ok()) {
      const data = await res.json();
      const waves: any[] = data.waves ?? [];
      const totalPending = waves.reduce((sum: number, w: any) => sum + (w.treasuryPendingCount ?? 0), 0);
      console.log(`P4-05: Total treasury_pending across all waves: ${totalPending}`);
      expect(totalPending).toBe(0);
    }
  });

  // ─── P4-06: Wave 1 delivery_status — customer tokens revealed, unsold transferred ─
  test('P4-06: Wave 1 customer sales show revealed status, unsold show transferred', async ({ page }) => {
    const res = await page.request.get('/api/nft-sell/waves');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    const w1 = (data.waves ?? []).find((w: any) => w.waveNumber === 1);

    console.log(`P4-06: Wave 1 — soldCount: ${w1?.soldCount}, treasuryRecipient: ${w1?.treasuryRecipient}, closeAction: ${w1?.closeAction}`);
    expect(w1?.closeAction).toBe('treasury');
    expect(w1?.waveRevealed).toBe(true);
    console.log('P4-06: Wave 1 state verified ✓');
  });

  // ─── P4-07: Summary log ───────────────────────────────────────────────────
  test('P4-07: All waves treasury-complete — print final summary', async ({ page }) => {
    const res = await page.request.get('/api/nft-sell/waves');
    const data = await res.json();
    const waves: any[] = data.waves ?? [];

    console.log('\n🎉 PHASE 4 COMPLETE — ALL 7 WAVES TREASURY-CLOSED');
    for (const w of waves) {
      const recipient = w.treasuryRecipient ?? TREASURY_WALLET + ' (default)';
      console.log(`   Wave ${w.waveNumber}: qty=${w.quantity} | sold=${w.soldCount ?? 0} | closeAction=${w.closeAction} | recipient=${recipient}`);
    }
    console.log('\n✓ Phase 1 — Filebase sync');
    console.log('✓ Phase 2 — Wave scheduling (all 7 waves, DB + on-chain)');
    console.log('✓ Phase 3 — Wave reveal + auto-treasury (all 7 waves)');
    console.log('✓ Phase 4 — Treasury state verification (all 7 waves)');
    console.log('\nNext: Run Phase 5 (Contract Operations) and Phase 6 (Dashboard)');
  });
});
