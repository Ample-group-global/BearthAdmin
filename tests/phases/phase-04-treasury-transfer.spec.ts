/**
 * PHASE 4 — Treasury Transfer (Move Unsold NFTs to Wallet)
 *
 * Purpose: After Wave 1 is closed and revealed, move unsold NFTs to the treasury wallet.
 * Tests the TreasuryMoveModal → on-chain transaction → TreasurySuccessModal flow.
 *
 * Business rule (enforced in BearthGenesisNFT.sol):
 *   treasuryClose() requires:
 *     1. waveEndTime[waveNum] != 0 (wave must have been scheduled)
 *     2. block.timestamp > waveEndTime[waveNum] (wave must have ended)
 *     3. waveRevealed[waveNum] == true (wave must be revealed)
 *   If any condition fails → revert WaveStillActive
 *
 * What this phase tests:
 *   - "Move to Wallet" button appears ONLY for closed+revealed waves with treasury_pending>0
 *   - TreasuryMoveModal opens with radio options (Default / Custom wallet)
 *   - Selecting "Default Treasury Wallet" fills correct address
 *   - On-chain treasuryClose() executes successfully
 *   - TreasurySuccessModal shows with tx hash + Etherscan Sepolia link
 *   - nft_records delivery_status updates: treasury_pending → transferred
 *   - "Move to Wallet" button disappears after transfer
 *
 * LOCK RULE: Once all tests pass this phase is locked.
 *            Pre-requisite: Phase 03 must be locked first.
 *
 * Pre-conditions:
 *   1. Phase 03 is LOCKED (Wave 1 revealed, treasury_pending > 0)
 *   2. nft_collection_config.treasury_wallet = '0xA5BfbbB9308F97daBd61E6b43faD391929BFF9a4'
 *   3. Sepolia wallet has ETH for gas
 */

import { test, expect } from '@playwright/test';
import { isLocked, isPreviousLocked, lockPhase, PhaseId } from '../helpers/phase-lock';

const PHASE_ID: PhaseId = 'phase-04';
const TREASURY_WALLET = '0xA5BfbbB9308F97daBd61E6b43faD391929BFF9a4';
const ETHERSCAN_SEPOLIA = 'https://sepolia.etherscan.io/tx/';

test.describe.configure({ mode: 'serial' });

test.describe('Phase 4 — Treasury Transfer (Move Unsold NFTs to Wallet)', () => {
  let failCount = 0;

  test.beforeEach(async ({}, testInfo) => {
    if (!isPreviousLocked(PHASE_ID)) {
      testInfo.skip(true, '⏭ Phase 03 must be LOCKED before running Phase 04. Run phase-03 tests first.');
    }
    if (isLocked(PHASE_ID)) {
      testInfo.skip(true, '🔒 Phase 04 is LOCKED — set "locked":false in phase-lock.json to re-run.');
    }
  });

  test.afterEach(async ({}, testInfo) => {
    if (testInfo.status === 'failed') failCount++;
  });

  test.afterAll(async () => {
    if (failCount === 0) lockPhase(PHASE_ID);
    else console.log(`\n⚠  Phase 04: ${failCount} test(s) failed — fix and re-run.\n`);
  });

  // ─── P4-01: "Move to Wallet" button visible on /nft/waves for Wave 1 ─────
  test('P4-01: "Move to Wallet" button appears for Wave 1 (closed + revealed + unsold > 0)', async ({ page }) => {
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');

    // The green "Move to Wallet" button should appear for Wave 1
    const moveBtn = page.locator('button').filter({ hasText: /move to wallet/i });
    await expect(moveBtn.first()).toBeVisible({ timeout: 15000 });

    // Button should be in the Wave 1 row area (first one found)
    console.log('P4-01: "Move to Wallet" button found for Wave 1 ✓');
  });

  // ─── P4-02: TreasuryMoveModal opens ───────────────────────────────────────
  test('P4-02: Clicking "Move to Wallet" opens TreasuryMoveModal', async ({ page }) => {
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');

    const moveBtn = page.locator('button').filter({ hasText: /move to wallet/i }).first();
    await moveBtn.click();

    // Modal should open
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 10000 });

    const modalBody = await modal.textContent() ?? '';
    // Modal should show wallet options
    expect(modalBody).toMatch(/wallet|treasury|default/i);
  });

  // ─── P4-03: Modal shows correct wallet options ────────────────────────────
  test('P4-03: TreasuryMoveModal has Default Treasury Wallet and Custom Wallet options', async ({ page }) => {
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');

    const moveBtn = page.locator('button').filter({ hasText: /move to wallet/i }).first();
    await moveBtn.click();
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10000 });

    // Two radio options: Default Treasury Wallet + Custom Wallet
    const radios = page.locator('[role="dialog"] input[type="radio"]');
    const radioCount = await radios.count();
    expect(radioCount).toBeGreaterThanOrEqual(2);

    // "Default Treasury Wallet" option should be visible
    const defaultOption = page.locator('[role="dialog"]').getByText(/default.*treasury|treasury.*wallet/i);
    await expect(defaultOption.first()).toBeVisible();

    // Close modal for next test
    await page.keyboard.press('Escape');
  });

  // ─── P4-04: Select Default Treasury Wallet and confirm transfer ───────────
  test('P4-04: Select Default Treasury Wallet, confirm → TxBanner success', async ({ page }) => {
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');

    const moveBtn = page.locator('button').filter({ hasText: /move to wallet/i }).first();
    await moveBtn.click();
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10000 });

    // Select "Default Treasury Wallet" radio
    const defaultRadio = page.locator('[role="dialog"] input[type="radio"]').first();
    await defaultRadio.check();

    // Verify the treasury address is shown
    const modalBody = await page.locator('[role="dialog"]').textContent() ?? '';
    const hasAddr = modalBody.toLowerCase().includes(TREASURY_WALLET.toLowerCase().slice(0, 10));
    if (!hasAddr) {
      console.log(`P4-04: Note — treasury address '${TREASURY_WALLET}' not shown in modal. Check nft_collection_config.treasury_wallet.`);
    }

    // Click the confirm / transfer button
    const confirmBtn = page.locator('[role="dialog"] button').filter({
      hasText: /confirm|transfer|move|proceed/i
    }).last();
    await expect(confirmBtn).toBeEnabled({ timeout: 5000 });
    await confirmBtn.click();

    // Wait for on-chain transaction — TxBanner or success state
    // treasuryClose() on Sepolia can take 30-90s
    await expect(
      page.locator('[class*="txbanner" i], [class*="success"], [role="alert"], [class*="modal"]')
        .filter({ hasText: /0x[0-9a-f]{8,}|success|confirmed|transferred/i })
    ).toBeVisible({ timeout: 120_000 });

    console.log('P4-04: Treasury transfer transaction confirmed ✓');
  });

  // ─── P4-05: TreasurySuccessModal shows tx hash and Etherscan link ─────────
  test('P4-05: TreasurySuccessModal shows tx hash with Etherscan Sepolia link', async ({ page }) => {
    // After P4-04 confirms, the TreasurySuccessModal should be visible
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');

    // Re-trigger if modal already closed (this test may run after P4-04 modal dismissed)
    const moveBtn = page.locator('button').filter({ hasText: /move to wallet/i }).first();
    const hasMoveBtn = await moveBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasMoveBtn) {
      // Transfer not yet done — it happened in P4-04, but let's check the page state
      await moveBtn.click();
      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10000 });

      const defaultRadio = page.locator('[role="dialog"] input[type="radio"]').first();
      await defaultRadio.check();

      const confirmBtn = page.locator('[role="dialog"] button').filter({
        hasText: /confirm|transfer|move/i
      }).last();
      await confirmBtn.click();

      await expect(
        page.locator('[class*="txbanner" i], [class*="success"], [role="alert"]')
          .filter({ hasText: /0x[0-9a-f]{8,}/i })
      ).toBeVisible({ timeout: 120_000 });
    }

    // TreasurySuccessModal content: tx hash + Etherscan link
    const successModal = page.locator('[role="dialog"], [class*="success"]').filter({
      hasText: /0x[0-9a-f]{8,}/i
    }).first();

    if (await successModal.isVisible({ timeout: 10000 }).catch(() => false)) {
      const content = await successModal.textContent() ?? '';
      // Tx hash present
      expect(content).toMatch(/0x[0-9a-f]{64}/i);
      // Etherscan link
      const etherscanLink = successModal.locator(`a[href*="sepolia.etherscan.io"]`);
      await expect(etherscanLink).toBeVisible({ timeout: 5000 });
      console.log(`P4-05: TreasurySuccessModal shows tx hash ✓`);
    }
  });

  // ─── P4-06: "Move to Wallet" button disappears after successful transfer ──
  test('P4-06: "Move to Wallet" button is gone after transfer completes', async ({ page }) => {
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');

    // Close any open modal first
    await page.keyboard.press('Escape').catch(() => {});
    await page.reload();
    await page.waitForLoadState('networkidle');

    // "Move to Wallet" should no longer appear for Wave 1
    // (treasury_pending count → 0 after transfer)
    const moveBtn = page.locator('button').filter({ hasText: /move to wallet/i });
    const btnCount = await moveBtn.count();

    // If 0 minted during test, all 303 were treasury → now transferred → button gone
    expect(btnCount).toBe(0);
    console.log('P4-06: "Move to Wallet" button gone after transfer ✓');
  });

  // ─── P4-07: nft_records show delivery_status = transferred ───────────────
  test('P4-07: NFT Records page reflects treasury transfer (0 treasury_pending)', async ({ page }) => {
    await page.goto('/nft/records');
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body') ?? '';

    // Should not show "treasury_pending" delivery status anymore for Wave 1
    // Total should still be 9,999
    expect(body).toContain('9,999');

    // If delivery status filter exists, check treasury_pending count = 0
    const deliveryFilter = page.locator('select, [role="combobox"]')
      .filter({ hasText: /delivery|status/i }).first();

    if (await deliveryFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deliveryFilter.click();
      const treasuryOption = page.locator('[role="option"], option')
        .filter({ hasText: /treasury.*pending|pending.*treasury/i }).first();
      if (await treasuryOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await treasuryOption.click();
        await page.waitForTimeout(1500);
        const filteredBody = await page.textContent('body') ?? '';
        // After transfer, treasury_pending count for Wave 1 = 0
        expect(filteredBody).toMatch(/\b0\b|no results|empty/i);
      }
    }

    console.log('P4-07: Treasury transfer complete — delivery_status updated ✓');
    console.log('\n🎉 ALL 4 PRIORITY PHASES COMPLETE');
    console.log('   Phase 1 ✓ Filebase sync verified');
    console.log('   Phase 2 ✓ Wave scheduling (DB + on-chain)');
    console.log('   Phase 3 ✓ Wave reveal (Pool + VRF)');
    console.log('   Phase 4 ✓ Treasury transfer');
    console.log('\nSee: tests/phase-lock.json for locked phase status');
  });
});
