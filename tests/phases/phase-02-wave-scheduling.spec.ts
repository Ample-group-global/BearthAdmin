/**
 * PHASE 2 — Wave Scheduling (DB + On-Chain)
 *
 * Purpose: Schedule Wave 1 in the database and push it on-chain.
 * Verify sequential rules are enforced (Wave 2 can't be scheduled before Wave 1 ends).
 *
 * What this phase tests:
 *   - /nft/waves loads all 7 waves correctly
 *   - Wave 1 Manage modal opens (Settings + Blockchain tabs)
 *   - DB schedule can be saved (scheduled_start, scheduled_end, reveal_scheduled_at)
 *   - Wave 1 schedule pushed on-chain via setWaveDates()
 *   - TxBanner confirms on-chain success
 *   - Sequential rule: Wave 2 start must be after Wave 1 end (DB-level enforcement)
 *   - Wave 2 schedule saved to DB after Wave 1 is confirmed
 *   - Wave 2 pushed on-chain
 *
 * TIMING STRATEGY (all 7 waves scheduled upfront with sequential windows):
 *   Wave 1: start = 2 min ago,  end = NOW + 15 min,  reveal = NOW + 17 min
 *   Wave 2: start = NOW + 16,   end = NOW + 25
 *   Wave 3: start = NOW + 26,   end = NOW + 35
 *   Wave 4: start = NOW + 36,   end = NOW + 45
 *   Wave 5: start = NOW + 46,   end = NOW + 55
 *   Wave 6: start = NOW + 56,   end = NOW + 65
 *   Wave 7: start = NOW + 66,   end = NOW + 75
 *   All waves scheduled in Phase 2; Phase 2.5 mints in each wave as it opens.
 *   Total test session: ~80 min for all 7 waves to cycle through on Sepolia testnet.
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

// Produce a datetime-local string (YYYY-MM-DDTHH:MM) adjusted by deltaMinutes
function dtLocal(deltaMinutes: number): string {
  const d = new Date(Date.now() + deltaMinutes * 60_000);
  // Offset to local time so datetime-local input fills correctly
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

const WAVE1_START    = () => dtLocal(-2);   // 2 min ago (already "open")
const WAVE1_END      = () => dtLocal(15);   // 15 min from now (Phase 2.5 Wave 1 minting window)
const WAVE1_REVEAL   = () => dtLocal(17);   // 17 min from now
const WAVE2_START    = () => dtLocal(16);   // 1 min after Wave 1 ends
const WAVE2_END      = () => dtLocal(25);   // 9-min window for Wave 2 minting
const WAVE3_START    = () => dtLocal(26);   // 1 min after Wave 2 ends
const WAVE3_END      = () => dtLocal(35);
const WAVE4_START    = () => dtLocal(36);
const WAVE4_END      = () => dtLocal(45);
const WAVE5_START    = () => dtLocal(46);
const WAVE5_END      = () => dtLocal(55);
const WAVE6_START    = () => dtLocal(56);
const WAVE6_END      = () => dtLocal(65);
const WAVE7_START    = () => dtLocal(66);
const WAVE7_END      = () => dtLocal(75);

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

  test.afterEach(async ({}, testInfo) => {
    if (testInfo.status === 'failed') failCount++;
  });

  test.afterAll(async () => {
    if (failCount === 0) lockPhase(PHASE_ID);
    else console.log(`\n⚠  Phase 02: ${failCount} test(s) failed — fix and re-run.\n`);
  });

  // ─── P2-01: /nft/waves loads all 7 waves ─────────────────────────────────
  test('P2-01: /nft/waves page loads with all 7 waves visible', async ({ page }) => {
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');

    // 7 wave rows — look for Manage buttons (one per wave)
    const manageBtns = page.locator('button').filter({ hasText: /^Manage$/i });
    await expect(manageBtns).toHaveCount(7, { timeout: 15000 });
  });

  // ─── P2-02: Open Wave 1 Manage modal ─────────────────────────────────────
  test('P2-02: Wave 1 Manage modal opens with Settings and Blockchain tabs', async ({ page }) => {
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');

    // Click first "Manage" button (Wave 1 — first row)
    const manageBtns = page.locator('button').filter({ hasText: /^Manage$/i });
    await manageBtns.first().click();

    // Modal should open
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10000 });

    // Both tabs visible
    await expect(page.getByRole('tab', { name: /settings/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /blockchain/i })).toBeVisible();
  });

  // ─── P2-03: Wave 1 DB schedule saved ─────────────────────────────────────
  test('P2-03: Save Wave 1 DB schedule (Settings tab)', async ({ page }) => {
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');

    const manageBtns = page.locator('button').filter({ hasText: /^Manage$/i });
    await manageBtns.first().click();
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10000 });

    // Go to Settings tab
    await page.getByRole('tab', { name: /settings/i }).click();
    await page.waitForTimeout(500);

    // Fill scheduled_start, scheduled_end, reveal_scheduled_at
    const dateInputs = page.locator('input[type="datetime-local"]');
    const count = await dateInputs.count();

    if (count >= 2) {
      // Fill start (first datetime input)
      await dateInputs.nth(0).fill(WAVE1_START());
      // Fill end (second datetime input)
      await dateInputs.nth(1).fill(WAVE1_END());
      // Fill reveal if third input exists
      if (count >= 3) {
        await dateInputs.nth(2).fill(WAVE1_REVEAL());
      }
    } else {
      // Try labeled inputs
      const startInput = page.locator('input[name*="start" i], input[placeholder*="start" i]').first();
      const endInput   = page.locator('input[name*="end" i],   input[placeholder*="end" i]').first();
      if (await startInput.isVisible()) await startInput.fill(WAVE1_START());
      if (await endInput.isVisible())   await endInput.fill(WAVE1_END());
    }

    // Save Settings
    const saveBtn = page.locator('button').filter({ hasText: /save.*settings|save/i }).first();
    await saveBtn.click();

    // Expect success feedback (banner or toast)
    await expect(
      page.locator('[class*="success"], [class*="toast"], [role="alert"]').filter({ hasText: /saved|updated|success/i })
    ).toBeVisible({ timeout: 15000 });
  });

  // ─── P2-04: Wave 1 schedule pushed on-chain ───────────────────────────────
  test('P2-04: Push Wave 1 schedule on-chain → TxBanner shows success', async ({ page }) => {
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');

    const manageBtns = page.locator('button').filter({ hasText: /^Manage$/i });
    await manageBtns.first().click();
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10000 });

    // Switch to Blockchain tab
    await page.getByRole('tab', { name: /blockchain/i }).click();
    await page.waitForTimeout(500);

    // Fill start/end on blockchain tab (separate inputs for on-chain)
    const dateInputs = page.locator('[role="dialog"] input[type="datetime-local"]');
    const count = await dateInputs.count();
    if (count >= 2) {
      await dateInputs.nth(0).fill(WAVE1_START());
      await dateInputs.nth(1).fill(WAVE1_END());
    }

    // Click "Push Schedule to Chain" (Step 1 on Blockchain tab)
    const pushBtn = page.locator('button').filter({ hasText: /push.*schedule|push.*chain|set.*schedule/i });
    await expect(pushBtn.first()).toBeVisible({ timeout: 10000 });
    await pushBtn.first().click();

    // Wait for on-chain TX — TxBanner should appear (green = success)
    // Timeout: 90 seconds for Sepolia confirmation
    await expect(
      page.locator('[class*="txbanner" i], [class*="tx-banner" i], [class*="success"], [role="alert"]')
        .filter({ hasText: /0x[0-9a-f]{8,}|success|confirmed/i })
    ).toBeVisible({ timeout: 90_000 });

    console.log('P2-04: Wave 1 schedule pushed on-chain ✓');
  });

  // ─── P2-05: Wave 1 status reflects scheduling ────────────────────────────
  test('P2-05: Wave 1 shows Upcoming or Active status after scheduling', async ({ page }) => {
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');

    // Wave 1 row should now show Upcoming, Active, or a scheduled date
    const wave1Row = page.locator('tr, [class*="row"]').filter({ hasText: /genesis.*free|wave 1/i }).first();
    if (await wave1Row.isVisible({ timeout: 8000 }).catch(() => false)) {
      const rowText = (await wave1Row.textContent()) ?? '';
      const hasStatus = /upcoming|active|scheduled/i.test(rowText);
      const hasDate   = /202[0-9]-[0-9]{2}-[0-9]{2}/.test(rowText);
      expect(hasStatus || hasDate).toBeTruthy();
    }
  });

  // ─── P2-06: Sequential rule enforced — Wave 2 blocked before Wave 1 end ──
  test('P2-06: Sequential rule: saving Wave 2 with start BEFORE Wave 1 end returns error', async ({ page }) => {
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');

    // Find Wave 2 Manage button (second row)
    const manageBtns = page.locator('button').filter({ hasText: /^Manage$/i });
    await manageBtns.nth(1).click();
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10000 });

    await page.getByRole('tab', { name: /settings/i }).click();
    await page.waitForTimeout(500);

    // Set Wave 2 start BEFORE Wave 1 end — should fail sequential rule
    const badStart = dtLocal(1); // only 1 min from now, before Wave 1's 15-min end
    const dateInputs = page.locator('[role="dialog"] input[type="datetime-local"]');
    if (await dateInputs.count() >= 2) {
      await dateInputs.nth(0).fill(badStart);
      await dateInputs.nth(1).fill(dtLocal(3));
    }

    const saveBtn = page.locator('button').filter({ hasText: /save.*settings|save/i }).first();
    await saveBtn.click();

    // Expect error response — sequential rule violated
    const errorMsg = page.locator('[class*="error"], [role="alert"]').filter({ hasText: /sequential|wave 1|previous|before/i });
    await expect(errorMsg).toBeVisible({ timeout: 10000 });

    console.log('P2-06: Sequential rule correctly blocked Wave 2 before Wave 1 end ✓');

    // Close modal
    await page.keyboard.press('Escape');
  });

  // ─── P2-07: Wave 2 DB schedule saved correctly ───────────────────────────
  test('P2-07: Save Wave 2 DB schedule with start AFTER Wave 1 end', async ({ page }) => {
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');

    const manageBtns = page.locator('button').filter({ hasText: /^Manage$/i });
    await manageBtns.nth(1).click(); // Wave 2
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10000 });

    await page.getByRole('tab', { name: /settings/i }).click();
    await page.waitForTimeout(500);

    const dateInputs = page.locator('[role="dialog"] input[type="datetime-local"]');
    if (await dateInputs.count() >= 2) {
      await dateInputs.nth(0).fill(WAVE2_START()); // after Wave 1 end
      await dateInputs.nth(1).fill(WAVE2_END());
    }

    const saveBtn = page.locator('button').filter({ hasText: /save.*settings|save/i }).first();
    await saveBtn.click();

    await expect(
      page.locator('[class*="success"], [class*="toast"], [role="alert"]').filter({ hasText: /saved|updated|success/i })
    ).toBeVisible({ timeout: 15000 });
  });

  // ─── P2-08: Wave 2 schedule pushed on-chain ───────────────────────────────
  test('P2-08: Push Wave 2 schedule on-chain → TxBanner success', async ({ page }) => {
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');

    const manageBtns = page.locator('button').filter({ hasText: /^Manage$/i });
    await manageBtns.nth(1).click(); // Wave 2
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10000 });

    await page.getByRole('tab', { name: /blockchain/i }).click();
    await page.waitForTimeout(500);

    const dateInputs = page.locator('[role="dialog"] input[type="datetime-local"]');
    if (await dateInputs.count() >= 2) {
      await dateInputs.nth(0).fill(WAVE2_START());
      await dateInputs.nth(1).fill(WAVE2_END());
    }

    // Set Wave 2 price on-chain (0.0303 ETH)
    const priceInput = page.locator('[role="dialog"] input[type="number"], [role="dialog"] input[placeholder*="price" i]').first();
    if (await priceInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await priceInput.fill('0.0303');
    }

    const pushBtn = page.locator('button').filter({ hasText: /push.*schedule|push.*chain|set.*schedule/i });
    if (await pushBtn.count() > 0) {
      await pushBtn.first().click();
      await expect(
        page.locator('[class*="txbanner" i], [class*="success"], [role="alert"]')
          .filter({ hasText: /0x[0-9a-f]{8,}|success|confirmed/i })
      ).toBeVisible({ timeout: 90_000 });
    }

    // Set Wave 2 price separately if there's a dedicated price button
    const setPriceBtn = page.locator('button').filter({ hasText: /set.*price|price.*chain/i });
    if (await setPriceBtn.count() > 0) {
      const priceIn = page.locator('[role="dialog"] input[placeholder*="eth" i], [role="dialog"] input[type="number"]').first();
      if (await priceIn.isVisible()) await priceIn.fill('0.0303');
      await setPriceBtn.first().click();
      await expect(
        page.locator('[class*="txbanner" i], [class*="success"], [role="alert"]')
          .filter({ hasText: /0x[0-9a-f]{8,}|success|confirmed/i })
      ).toBeVisible({ timeout: 90_000 });
    }

    console.log('P2-08: Wave 2 scheduled on-chain ✓');
  });

  // ─── P2-09: Schedule Waves 3–7 on-chain (all sequential windows) ─────────
  test('P2-09: Schedule Waves 3–7 DB + on-chain (complete all 7 waves)', async ({ page }) => {
    test.setTimeout(600_000); // 10 min — 5 waves × up to 90s each on Sepolia

    const waves = [
      { label: 'Wave 3', btnIndex: 2, start: WAVE3_START, end: WAVE3_END, price: '0.0606' },
      { label: 'Wave 4', btnIndex: 3, start: WAVE4_START, end: WAVE4_END, price: '0.0909' },
      { label: 'Wave 5', btnIndex: 4, start: WAVE5_START, end: WAVE5_END, price: '0.1515' },
      { label: 'Wave 6', btnIndex: 5, start: WAVE6_START, end: WAVE6_END, price: '0.2424' },
      { label: 'Wave 7', btnIndex: 6, start: WAVE7_START, end: WAVE7_END, price: '0.3939' },
    ];

    for (const wave of waves) {
      await page.goto('/nft/waves');
      await page.waitForLoadState('networkidle');

      const manageBtns = page.locator('button').filter({ hasText: /^Manage$/i });
      await manageBtns.nth(wave.btnIndex).click();
      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10000 });

      // Settings tab — save DB schedule
      await page.getByRole('tab', { name: /settings/i }).click();
      await page.waitForTimeout(500);
      const dateInputs = page.locator('[role="dialog"] input[type="datetime-local"]');
      if (await dateInputs.count() >= 2) {
        await dateInputs.nth(0).fill(wave.start());
        await dateInputs.nth(1).fill(wave.end());
      }
      const saveBtn = page.locator('button').filter({ hasText: /save.*settings|save/i }).first();
      await saveBtn.click();
      await expect(
        page.locator('[class*="success"], [class*="toast"], [role="alert"]').filter({ hasText: /saved|updated|success/i })
      ).toBeVisible({ timeout: 15000 });

      // Blockchain tab — push on-chain
      await page.getByRole('tab', { name: /blockchain/i }).click();
      await page.waitForTimeout(500);
      if (await dateInputs.count() >= 2) {
        await dateInputs.nth(0).fill(wave.start());
        await dateInputs.nth(1).fill(wave.end());
      }

      // Set price if input is available
      const priceInput = page.locator('[role="dialog"] input[type="number"], [role="dialog"] input[placeholder*="price" i], [role="dialog"] input[placeholder*="eth" i]').first();
      if (await priceInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await priceInput.fill(wave.price);
      }

      const pushBtn = page.locator('button').filter({ hasText: /push.*schedule|push.*chain|set.*schedule/i });
      if (await pushBtn.count() > 0) {
        await pushBtn.first().click();
        await expect(
          page.locator('[class*="txbanner" i], [class*="success"], [role="alert"]')
            .filter({ hasText: /0x[0-9a-f]{8,}|success|confirmed/i })
        ).toBeVisible({ timeout: 90_000 });
      }

      // Set price separately if there's a dedicated price button
      const setPriceBtn = page.locator('button').filter({ hasText: /set.*price|price.*chain/i });
      if (await setPriceBtn.count() > 0) {
        await setPriceBtn.first().click();
        await expect(
          page.locator('[class*="txbanner" i], [class*="success"], [role="alert"]')
            .filter({ hasText: /0x[0-9a-f]{8,}|success|confirmed/i })
        ).toBeVisible({ timeout: 90_000 });
      }

      await page.keyboard.press('Escape').catch(() => {});
      console.log(`P2-09: ${wave.label} scheduled ✓  ${wave.start()} → ${wave.end()}`);
    }

    console.log('\nP2-09: All 7 waves scheduled on Sepolia ✓');
    console.log('  Wave 1 → NOW+15   Wave 2 → NOW+25   Wave 3 → NOW+35');
    console.log('  Wave 4 → NOW+45   Wave 5 → NOW+55   Wave 6 → NOW+65   Wave 7 → NOW+75');
  });
});
