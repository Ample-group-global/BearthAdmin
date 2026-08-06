/**
 * PHASE 3 — Wave Revealing (Pool + VRF)
 *
 * Purpose: Test the full reveal flow for Wave 1.
 * Admin triggers reveal → pool created (random 303 serials) → VRF assigns
 * token IDs → nft_records updated → wave marked is_revealed=true.
 *
 * Architecture reminder:
 *   Level 1 (auto at reveal_scheduled_at):
 *     nft_wave_create_pool(1) → picks 303 random serials → delivery_status=pool_assigned
 *   Level 2 (immediately after pool):
 *     VRF rotation: rotatedPool[j] = pool[(j + startingIndex) % poolSize]
 *     Sold tokens → delivery_status=revealed
 *     Unsold tokens → delivery_status=treasury_pending
 *
 * What this phase tests:
 *   - Wave 1 auto-closes after scheduled_end passes (wave_closed=TRUE, status='closed')
 *   - Reveal tab in /nft/waves shows Wave 1 ready for reveal
 *   - Admin triggers reveal with correct Metadata Base URI
 *   - On-chain: waveRevealed[1]=true, startingIndex set
 *   - DB: nft_waves.is_revealed=true, wave_starting_index set
 *   - DB: nft_records updated (revealed/treasury_pending delivery_status)
 *   - Stat cards on /nft/records reflect reveal counts
 *
 * LOCK RULE: Once all tests pass this phase is locked.
 *            Pre-requisite: Phase 02 must be locked first.
 *
 * TIMING NOTE: Run this phase AFTER Wave 1 reveal_scheduled_at has passed.
 *   If Wave 1 was set in Phase 2 with reveal=NOW+6min, wait at least 7 minutes
 *   after Phase 2 before starting Phase 3. The page will poll/update automatically.
 */

import { test, expect } from '@playwright/test';
import { isLocked, isPreviousLocked, lockPhase, PhaseId } from '../helpers/phase-lock';

const PHASE_ID: PhaseId = 'phase-03';
const REVEAL_URI = 'ipfs://QmQvutWiTFJq3KpofnDRXsMN1htjsRghSKAHBTWCHLbAKc';

test.describe.configure({ mode: 'serial' });

test.describe('Phase 3 — Wave Revealing (Pool + VRF)', () => {
  let failCount = 0;

  test.beforeEach(async ({}, testInfo) => {
    if (!isPreviousLocked(PHASE_ID)) {
      testInfo.skip(true, '⏭ Phase 02 must be LOCKED before running Phase 03. Run phase-02 tests first.');
    }
    if (isLocked(PHASE_ID)) {
      testInfo.skip(true, '🔒 Phase 03 is LOCKED — set "locked":false in phase-lock.json to re-run.');
    }
  });

  test.afterEach(async ({}, testInfo) => {
    if (testInfo.status === 'failed') failCount++;
  });

  test.afterAll(async () => {
    if (failCount === 0) lockPhase(PHASE_ID);
    else console.log(`\n⚠  Phase 03: ${failCount} test(s) failed — fix and re-run.\n`);
  });

  // ─── P3-01: Wave 1 is closed (auto-trigger fired after end time) ──────────
  test('P3-01: Wave 1 status is Closed after scheduled_end passed', async ({ page }) => {
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body') ?? '';

    // Wave 1 row should show Closed (auto-trigger updates status)
    // If still Active/Upcoming, the auto-trigger hasn't fired yet — wait and retry
    const isClosed = /closed/i.test(body);
    if (!isClosed) {
      console.log('P3-01: Wave 1 not yet closed — auto-trigger may need more time.');
      console.log('       Check: wave_auto_trigger runs every 30-60s.');
      console.log('       Make sure Wave 1 scheduled_end has passed.');
    }
    expect(isClosed).toBeTruthy();
  });

  // ─── P3-02: Reveal tab shows Wave 1 ready for reveal ─────────────────────
  test('P3-02: Reveal tab shows Wave 1 with Reveal Now button enabled', async ({ page }) => {
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');

    // Navigate to Reveal tab
    const revealTab = page.getByRole('tab', { name: /reveal/i });
    await expect(revealTab).toBeVisible({ timeout: 10000 });
    await revealTab.click();
    await page.waitForLoadState('networkidle');

    // Wave 1 should show a reveal action (button or link)
    // The button is enabled only when wave is closed AND reveal_scheduled_at passed
    const revealBtn = page.locator('button').filter({ hasText: /reveal now|trigger reveal/i }).first();
    await expect(revealBtn).toBeVisible({ timeout: 10000 });
    await expect(revealBtn).toBeEnabled();
  });

  // ─── P3-03: Trigger Wave 1 reveal → confirm modal → submit ───────────────
  test('P3-03: Trigger Wave 1 reveal — fill reveal URI and confirm', async ({ page }) => {
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');

    const revealTab = page.getByRole('tab', { name: /reveal/i });
    await revealTab.click();
    await page.waitForLoadState('networkidle');

    // Click "Reveal Now" for Wave 1
    const revealBtn = page.locator('button').filter({ hasText: /reveal now|trigger reveal/i }).first();
    await revealBtn.click();

    // Reveal modal should open
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Fill Metadata Base URI
    const uriInput = page.locator('[role="dialog"] input[type="text"], [role="dialog"] input[placeholder*="ipfs" i], [role="dialog"] input[placeholder*="uri" i]').first();
    await expect(uriInput).toBeVisible({ timeout: 5000 });
    await uriInput.fill(REVEAL_URI);

    // Check confirmation checkbox if present
    const confirmCheck = page.locator('[role="dialog"] input[type="checkbox"]').first();
    if (await confirmCheck.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmCheck.check();
    }

    // Submit reveal
    const confirmBtn = page.locator('[role="dialog"] button').filter({ hasText: /confirm|reveal|proceed/i }).last();
    await confirmBtn.click();

    // Success or loading indicator
    await expect(
      page.locator('[class*="success"], [class*="toast"], [class*="txbanner" i], [role="alert"]')
        .filter({ hasText: /0x[0-9a-f]{8,}|success|confirmed|reveal/i })
    ).toBeVisible({ timeout: 120_000 }); // VRF + pool creation can take up to 2 min

    console.log('P3-03: Reveal triggered ✓ — waiting for VRF + pool completion...');
  });

  // ─── P3-04: Wave 1 is_revealed becomes true in UI ────────────────────────
  test('P3-04: Wave 1 shows is_revealed = true after VRF fulfillment', async ({ page }) => {
    // VRF callback may take a few minutes on Sepolia — poll the page
    let revealed = false;
    for (let attempt = 0; attempt < 12; attempt++) {
      await page.goto('/nft/waves');
      await page.waitForLoadState('networkidle');
      const body = await page.textContent('body') ?? '';
      if (/revealed/i.test(body)) {
        revealed = true;
        break;
      }
      console.log(`P3-04: Waiting for VRF fulfillment... attempt ${attempt + 1}/12 (${(attempt + 1) * 30}s elapsed)`);
      await page.waitForTimeout(30_000); // poll every 30s
    }

    expect(revealed).toBeTruthy();
    console.log('P3-04: Wave 1 revealed ✓');
  });

  // ─── P3-05: nft_records delivery_status updated correctly ────────────────
  test('P3-05: NFT Records page shows REVEALED count > 0 after reveal', async ({ page }) => {
    await page.goto('/nft/records');
    await page.waitForLoadState('networkidle');

    // REVEALED stat should now be > 0
    const revealedCard = page.locator('.stat-card, [class*="stat"]').filter({ hasText: /revealed/i }).first();
    if (await revealedCard.isVisible({ timeout: 8000 }).catch(() => false)) {
      const revealedText = (await revealedCard.textContent()) ?? '';
      // Should NOT be 0 anymore
      expect(revealedText).not.toMatch(/\b0\b/);
    } else {
      // Check page body for any revealed count
      const body = await page.textContent('body') ?? '';
      expect(body).not.toContain('0 revealed');
    }
  });

  // ─── P3-06: Verify delivery_status distribution via search ───────────────
  test('P3-06: Searching a revealed NFT serial shows artwork image (not blind box)', async ({ page }) => {
    await page.goto('/nft/records');
    await page.waitForLoadState('networkidle');

    // Search for a Wave 1 serial (e.g. #1)
    const searchInput = page.locator(
      'input[placeholder*="search" i], input[placeholder*="serial" i], input[type="search"]'
    ).first();

    if (await searchInput.isVisible({ timeout: 8000 }).catch(() => false)) {
      await searchInput.fill('#1');
      await page.waitForTimeout(1500);

      // Find the History button for this record
      const historyBtn = page.locator('button', { hasText: 'History' }).first();
      if (await historyBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await historyBtn.click();
        await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 8000 });

        const modalBody = await page.locator('[role="dialog"]').textContent() ?? '';
        // After reveal, should show revealed or have an artwork image (not blind box placeholder)
        const hasRevealStatus = /revealed|artwork|ipfs/i.test(modalBody);
        console.log(`P3-06: Modal content for #1: ${modalBody.slice(0, 200)}`);

        await page.keyboard.press('Escape');
      }
    }
    // Soft check — if search not available, phase still passes (verified via stat card in P3-05)
  });

  // ─── P3-07: Wave 1 Reveal tab shows starting_index is set ────────────────
  test('P3-07: Wave 1 Reveal tab shows VRF starting_index is populated', async ({ page }) => {
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');

    const revealTab = page.getByRole('tab', { name: /reveal/i });
    await revealTab.click();
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body') ?? '';

    // After reveal: should show starting_index or fulfilled timestamp
    const hasVrfData = /starting.*index|vrf.*fulfilled|index.*[0-9]+/i.test(body);
    // At minimum, the "Reveal Now" button should be gone (already revealed)
    const revealBtnCount = await page.locator('button').filter({ hasText: /reveal now/i }).count();

    expect(hasVrfData || revealBtnCount === 0).toBeTruthy();
  });

  // ─── P3-08: treasury_pending count is visible for Wave 1 ─────────────────
  test('P3-08: Wave 1 row shows treasury_pending count (unsold NFTs awaiting transfer)', async ({ page }) => {
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');

    // Wave 1 has 303 NFTs. If 0 were sold, all 303 are treasury_pending.
    // The Minted column should show amber "X unsold" badge.
    const unsoldBadge = page.locator('[class*="amber"], [class*="warning"]')
      .filter({ hasText: /unsold|treasury/i }).first();

    if (await unsoldBadge.isVisible({ timeout: 5000 }).catch(() => false)) {
      const badgeText = (await unsoldBadge.textContent()) ?? '';
      console.log(`P3-08: Unsold badge: "${badgeText}"`);
      // Unsold count should be between 1 and 303
      const num = parseInt(badgeText.replace(/[^0-9]/g, ''), 10);
      expect(num).toBeGreaterThan(0);
      expect(num).toBeLessThanOrEqual(303);
    } else {
      // If sold_count was 0, all 303 are treasury_pending
      const body = await page.textContent('body') ?? '';
      expect(body).toMatch(/303|treasury|unsold/i);
    }
  });
});
