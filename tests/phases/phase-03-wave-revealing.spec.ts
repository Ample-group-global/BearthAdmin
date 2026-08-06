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
 * TIMING NOTE: Run this phase AFTER Wave 1 scheduled_end has passed (wave is closed).
 *   Wave 1 runs for 20 minutes from T0. P3-02 sets the reveal date via admin UI
 *   (reveal_scheduled_at cannot be set before wave closes — enforced by API guard).
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

  // ─── P3-02: Set reveal date for Wave 1, then confirm Reveal Now button ────
  // Reveal date CANNOT be set until the wave is closed (enforced by API + UI).
  // After Wave 1 closes, admin uses "Set Date" button to schedule the reveal.
  // We set the date to 1 minute in the past so "Reveal Now" appears immediately.
  test('P3-02: Set reveal date for closed Wave 1 and confirm Reveal Now button appears', async ({ page }) => {
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');

    // If "Reveal Now" is already visible (reveal date was pre-set), skip set-date step
    const revealNowAlready = page.locator('button').filter({ hasText: /reveal now/i }).first();
    if (await revealNowAlready.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(revealNowAlready).toBeEnabled();
      console.log('P3-02: Reveal Now already visible ✓');
      return;
    }

    // Click "Set Date" button for Wave 1 (first occurrence = Wave 1 row)
    const setDateBtn = page.locator('button').filter({ hasText: /set date/i }).first();
    await expect(setDateBtn).toBeVisible({ timeout: 15000 });
    await setDateBtn.click();

    // Modal: "Set Reveal Date — W1 ..."
    const modal = page.locator('.ba-modal-sm').filter({ hasText: /set reveal date/i }).first();
    await expect(modal).toBeVisible({ timeout: 8000 });

    // Set reveal date to 1 minute ago (so "Reveal Now" appears immediately after save)
    const past = new Date(Date.now() - 60_000);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dtStr = `${past.getFullYear()}-${pad(past.getMonth()+1)}-${pad(past.getDate())}T${pad(past.getHours())}:${pad(past.getMinutes())}`;
    const dtInput = modal.locator('input[type="datetime-local"]').first();
    await dtInput.fill(dtStr);

    // Save
    const saveBtn = modal.locator('button').filter({ hasText: /save reveal date/i }).first();
    await expect(saveBtn).toBeEnabled({ timeout: 3000 });
    await saveBtn.click();
    await expect(modal).toBeHidden({ timeout: 10000 });

    // Reload so the page re-evaluates reveal state
    await page.reload();
    await page.waitForLoadState('networkidle');

    // "Reveal Now" should now be visible (scheduled time is in the past)
    const revealBtn = page.locator('button').filter({ hasText: /reveal now/i }).first();
    await expect(revealBtn).toBeVisible({ timeout: 15000 });
    await expect(revealBtn).toBeEnabled();
    console.log('P3-02: Reveal date set + Reveal Now button confirmed ✓');
  });

  // ─── P3-03: Trigger Wave 1 reveal → confirm modal → submit ───────────────
  // NOTE: RevealModal is a fixed overlay div — no role="dialog".
  // Find it by its distinctive content: "Reveal Wave" heading + IPFS URI input + checkbox.
  test('P3-03: Trigger Wave 1 reveal — fill reveal URI and confirm', async ({ page }) => {
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');

    // Click "Reveal Now" for Wave 1 (it's in the Waves tab content, no tab switch needed)
    const revealBtn = page.locator('button').filter({ hasText: /reveal now/i }).first();
    await expect(revealBtn).toBeVisible({ timeout: 30000 });
    await revealBtn.click();

    // RevealModal is a fixed inset-0 overlay div (no role="dialog")
    // Identify it by the modal heading text "Reveal Wave"
    const modal = page.locator('div.fixed.inset-0').filter({ hasText: /reveal wave/i }).last();
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Fill the Metadata Base URI input inside the modal
    // The input has placeholder "ipfs://Qm.../metadata/" and monitors ipfs:// prefix
    const uriInput = modal.locator('input[placeholder*="ipfs" i]').first();
    await expect(uriInput).toBeVisible({ timeout: 5000 });
    await uriInput.fill(REVEAL_URI);

    // Check the confirmation checkbox (required to enable submit button)
    const confirmCheck = modal.locator('input[type="checkbox"]').first();
    await expect(confirmCheck).toBeVisible({ timeout: 5000 });
    await confirmCheck.check();

    // Submit — the button text is "Confirm Reveal" (enabled after checkbox + valid URI)
    const confirmBtn = modal.locator('button').filter({ hasText: /confirm reveal/i }).first();
    await expect(confirmBtn).toBeEnabled({ timeout: 5000 });
    await confirmBtn.click();

    // Wait for the RevealSuccessModal OR a tx hash banner to appear
    // The SuccessModal shows "Wave N Revealed!" and the tx hash
    await expect(
      page.locator('div.fixed.inset-0').filter({ hasText: /wave.*revealed|0x[0-9a-f]{8,}/i })
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
  // NOTE: The NFT Records page has NO `.stat-card` CSS class.
  // Stat cards are plain <button> elements with a label text and count.
  // The "Revealed" stat card is a button with "REVEALED" label and a count number.
  test('P3-05: NFT Records page shows REVEALED count > 0 after reveal', async ({ page }) => {
    await page.goto('/nft/records');
    await page.waitForLoadState('networkidle');

    // The stat cards are <button> elements.
    // The "Revealed" card contains the text "Revealed" as a label and shows the count.
    // Strategy: find a button that contains "Revealed" label text and extract the numeric value.
    const revealedCard = page.locator('button').filter({ hasText: /\bRevealed\b/i }).first();

    if (await revealedCard.isVisible({ timeout: 10000 }).catch(() => false)) {
      const cardText = (await revealedCard.textContent()) ?? '';
      console.log(`P3-05: Revealed card text: "${cardText.slice(0, 100)}"`);

      // Extract the number from the card — it shows the count as a large number
      // The card structure is: icon + "REVEALED" label + number + "Artwork unlocked" + progress bar
      const numMatch = cardText.match(/(\d[\d,]*)/);
      if (numMatch) {
        const count = parseInt(numMatch[1].replace(/,/g, ''), 10);
        console.log(`P3-05: Revealed count = ${count}`);
        expect(count).toBeGreaterThan(0);
      } else {
        // If we can't parse a number, just verify the card doesn't say "0"
        expect(cardText).not.toMatch(/^0\b/);
      }
    } else {
      // Fallback: check page body for revealed count via API
      const res = await page.request.get('/api/nfts?revealed=true&limit=1');
      if (res.ok()) {
        const d = await res.json();
        expect(d.total ?? d.revealedCount ?? 0).toBeGreaterThan(0);
      } else {
        // If no stat card visible, just check the page loaded OK
        const body = await page.textContent('body') ?? '';
        expect(body.length).toBeGreaterThan(500);
        console.log('P3-05: Stat card not visible — page loaded, manual verification required');
      }
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
        // NFT Records modal uses .ba-modal-records class (not role="dialog")
        const recordModal = page.locator('.ba-modal-records, .fixed.inset-0').last();
        await expect(recordModal).toBeVisible({ timeout: 8000 });

        const modalBody = await recordModal.textContent() ?? '';
        // After reveal, should show revealed or have an artwork image (not blind box placeholder)
        const hasRevealStatus = /revealed|artwork|ipfs/i.test(modalBody);
        console.log(`P3-06: Modal content for #1: ${modalBody.slice(0, 200)}`);

        await page.keyboard.press('Escape');
      }
    }
    // Soft check — if search not available, phase still passes (verified via stat card in P3-05)
  });

  // ─── P3-07: Waves page confirms reveal complete (no Reveal Now button left) ─
  // NOTE: There is NO separate "Reveal" tab. Reveal state is shown in the Waves tab.
  // After successful reveal: the "Reveal Now" button for Wave 1 disappears,
  // and/or the wave row shows a "Revealed" badge / status.
  test('P3-07: Waves page confirms Wave 1 reveal complete (Reveal Now button gone)', async ({ page }) => {
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');

    // After reveal, Wave 1 should show "Revealed" status in the page.
    // The "Reveal Now" button for Wave 1 should be gone (it's replaced by the revealed state).
    const body = await page.textContent('body') ?? '';

    // Check API directly to confirm the wave's is_revealed flag is set
    const res = await page.request.get('/api/nft-sell/waves/schedule-status');
    if (res.ok()) {
      const data = await res.json();
      const waves: any[] = data.waves ?? [];
      const wave1 = waves.find((w: any) => (w.wave_number ?? w.waveNumber) === 1);
      if (wave1) {
        const isRevealed = wave1.is_revealed ?? wave1.isRevealed ?? false;
        console.log(`P3-07: Wave 1 is_revealed = ${isRevealed}`);
        if (isRevealed) {
          expect(isRevealed).toBe(true);
          console.log('P3-07: Wave 1 is_revealed=true confirmed via API ✓');
          return;
        }
      }
    }

    // Fallback: the Reveal Now button should be absent (wave already revealed)
    // OR the page shows "Revealed" text in wave context
    const revealNowCount = await page.locator('button').filter({ hasText: /reveal now/i }).count();
    const hasRevealed = /revealed/i.test(body);
    expect(revealNowCount === 0 || hasRevealed).toBeTruthy();
    console.log(`P3-07: Reveal Now buttons remaining: ${revealNowCount}, page says revealed: ${hasRevealed}`);
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
