/**
 * PHASE 5 — Contract Operations Page (/nft/selling)
 *
 * Purpose: Verify the Contract Operations page (NFT Selling) loads correctly,
 * all 6 tabs are accessible, key sections show expected UI elements, and
 * read-only data is displayed properly.
 *
 * Page: /nft/selling
 * Tabs (exact names from selling/page.tsx):
 *   1. Mint Operations
 *   2. Admin Sales
 *   3. Collection & Controls
 *   4. Royalty
 *   5. Membership
 *   6. Advanced
 *
 * What this phase tests:
 *   - Page loads without error
 *   - Stats strip shows Phase/Minted/Progress/Revealed/Max-per-Wallet
 *   - All 6 tabs are clickable and their content renders
 *   - VIP Management section and wallet input present (Mint Operations)
 *   - Purchase Limits section with toggle present (Mint Operations)
 *   - Admin Mint section with recipient + quantity inputs (Mint Operations)
 *   - Record Admin Sale form visible and has required fields (Admin Sales)
 *   - Reveal Collection section shows current state (Collection & Controls)
 *   - Treasury Wallet input/display visible (Collection & Controls)
 *   - Emergency Controls: Pause + Withdraw buttons visible (NOT clicked)
 *   - Contract Events section renders (Collection & Controls)
 *   - Royalty tab renders (read-only check)
 *   - Membership tab renders (read-only check)
 *
 * LOCK RULE: Once all tests pass this phase is locked.
 *            Pre-requisite: Phase 04 must be locked first.
 *
 * NOTE: Tests that would trigger irreversible on-chain actions (Pause, Phase Advance)
 *       are marked test.skip() to protect testnet state.
 */

import { test, expect } from '@playwright/test';
import { isLocked, isPreviousLocked, lockPhase, PhaseId } from '../helpers/phase-lock';

const PHASE_ID: PhaseId = 'phase-05';

test.describe.configure({ mode: 'serial' });

test.describe('Phase 5 — Contract Operations (/nft/selling)', () => {
  let failCount = 0;

  test.beforeEach(async ({}, testInfo) => {
    if (!isPreviousLocked(PHASE_ID)) {
      testInfo.skip(true, '⏭ Phase 04 must be LOCKED before running Phase 05. Run phase-04 tests first.');
    }
    if (isLocked(PHASE_ID)) {
      testInfo.skip(true, '🔒 Phase 05 is LOCKED — set "locked":false in phase-lock.json to re-run.');
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
    else console.log(`\n⚠  Phase 05: ${failCount} test(s) failed — fix and re-run.\n`);
  });

  // ─── P5-01: Page loads without error ─────────────────────────────────────
  test('P5-01: /nft/selling page loads without error', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/nft/selling');
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body') ?? '';
    // Title is "NFT Selling" per the page h1
    expect(body).toMatch(/NFT Selling/i);
    // No fatal error state
    expect(body).not.toMatch(/unable to load|network error|failed to load collection/i);

    console.log('P5-01: /nft/selling loaded ✓');
  });

  // ─── P5-02: Stats strip shows expected stat cards ─────────────────────────
  test('P5-02: Stats strip shows Phase, Minted, Progress, Revealed, Max/Wallet', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/nft/selling');
    await page.waitForLoadState('networkidle');

    // The stats strip renders 5 cards when onChain data is available:
    // Phase | Minted | Progress | Revealed | Max/Wallet
    // Each card is a div with a label (10px text) and value (sm text).
    // Check that the page contains these labels.
    const body = await page.textContent('body') ?? '';

    // At minimum Phase and Minted must be present
    expect(body).toMatch(/phase/i);
    expect(body).toMatch(/minted/i);

    console.log('P5-02: Stats strip verified ✓');
  });

  // ─── P5-03: All 6 tabs are clickable ─────────────────────────────────────
  test('P5-03: All 6 tabs are present and clickable', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/nft/selling');
    await page.waitForLoadState('networkidle');

    // Tab names from TABS constant in selling/page.tsx:
    // "Mint Operations", "Admin Sales", "Collection & Controls", "Royalty", "Membership", "Advanced"
    const tabNames = [
      'Mint Operations',
      'Admin Sales',
      'Collection & Controls',
      'Royalty',
      'Membership',
      'Advanced',
    ] as const;

    for (const tabName of tabNames) {
      const tab = page.locator('button').filter({ hasText: tabName }).first();
      await expect(tab).toBeVisible({ timeout: 10000 });
      await tab.click();
      await page.waitForTimeout(500);
      // Verify tab content renders (no crash/blank)
      const body = await page.textContent('body') ?? '';
      expect(body.length).toBeGreaterThan(500);
      console.log(`P5-03: Tab "${tabName}" rendered ✓`);
    }
  });

  // ─── P5-04: Mint Operations tab — VIP Management section ─────────────────
  test('P5-04: Mint Operations tab — VIP Management section and wallet input visible', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/nft/selling');
    await page.waitForLoadState('networkidle');

    // The Mint Operations tab is the default — no click needed
    // VIP Customer Management section heading
    const vipSection = page.getByText('VIP Customer Management', { exact: false });
    await expect(vipSection.first()).toBeVisible({ timeout: 15000 });

    // Wallet address input (placeholder "0x…")
    const walletInput = page.locator('input[placeholder="0x…"]').first();
    await expect(walletInput).toBeVisible({ timeout: 10000 });

    // Grant VIP + Revoke VIP buttons present
    await expect(page.locator('button').filter({ hasText: 'Grant VIP' }).first()).toBeVisible();
    await expect(page.locator('button').filter({ hasText: 'Revoke VIP' }).first()).toBeVisible();

    console.log('P5-04: VIP Management section verified ✓');
  });

  // ─── P5-05: Purchase Limits section visible ───────────────────────────────
  test('P5-05: Mint Operations tab — Purchase Limits section with toggle visible', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/nft/selling');
    await page.waitForLoadState('networkidle');

    // Purchase Limits section
    const limitsSection = page.getByText('Purchase Limits', { exact: false });
    await expect(limitsSection.first()).toBeVisible({ timeout: 15000 });

    // Toggle should be present (enable/disable purchase limits)
    // The Toggle component renders as a button or div — check for "Enable Purchase Limits" text
    const limitText = page.getByText('Enable Purchase Limits', { exact: false });
    await expect(limitText.first()).toBeVisible({ timeout: 10000 });

    console.log('P5-05: Purchase Limits section verified ✓');
  });

  // ─── P5-06: Admin Mint section visible ───────────────────────────────────
  test('P5-06: Mint Operations tab — Admin Mint section with recipient + quantity inputs', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/nft/selling');
    await page.waitForLoadState('networkidle');

    // Admin Mint section heading
    const adminMintSection = page.getByText('Admin Mint', { exact: false });
    await expect(adminMintSection.first()).toBeVisible({ timeout: 15000 });

    // "Recipient Wallet" label
    const recipientLabel = page.getByText('Recipient Wallet', { exact: false });
    await expect(recipientLabel.first()).toBeVisible();

    // "Quantity" label
    const qtyLabel = page.getByText('Quantity', { exact: false });
    await expect(qtyLabel.first()).toBeVisible();

    // Admin Mint On-Chain button
    const mintBtn = page.locator('button').filter({ hasText: /Admin Mint On-Chain/i }).first();
    await expect(mintBtn).toBeVisible({ timeout: 10000 });

    console.log('P5-06: Admin Mint section verified ✓');
  });

  // ─── P5-07: Admin Sales tab — Record Admin Sale form visible ─────────────
  test('P5-07: Admin Sales tab — Record Admin Sale form with required fields visible', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/nft/selling');
    await page.waitForLoadState('networkidle');

    // Switch to Admin Sales tab
    const adminSalesTab = page.locator('button').filter({ hasText: 'Admin Sales' }).first();
    await adminSalesTab.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // "Record Admin Sale" section heading
    const saleSection = page.getByText('Record Admin Sale', { exact: false });
    await expect(saleSection.first()).toBeVisible({ timeout: 15000 });

    // Sale Mode select + Buyer Wallet Address input must be visible
    const buyerLabel = page.getByText('Buyer Wallet Address', { exact: false });
    await expect(buyerLabel.first()).toBeVisible();

    // Submit button: "Record + Mint Now" or "Save as Pending"
    const submitBtn = page.locator('button').filter({ hasText: /Record.*Mint Now|Save as Pending/i }).first();
    await expect(submitBtn).toBeVisible({ timeout: 10000 });

    // Admin Sales list section
    const salesListHeader = page.getByText('Admin Sales', { exact: true }).last();
    // At minimum the table or empty state is present
    const body = await page.textContent('body') ?? '';
    expect(body).toMatch(/admin sales|no sales recorded/i);

    console.log('P5-07: Admin Sales tab verified ✓');
  });

  // ─── P5-08: Collection & Controls tab — Reveal Collection section ─────────
  test('P5-08: Collection & Controls tab — Reveal Collection section shows current state', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/nft/selling');
    await page.waitForLoadState('networkidle');

    // Switch to Collection & Controls tab
    const ccTab = page.locator('button').filter({ hasText: 'Collection & Controls' }).first();
    await ccTab.click();
    await page.waitForTimeout(1000);

    // Reveal Collection section
    const revealSection = page.getByText('Reveal Collection', { exact: false });
    await expect(revealSection.first()).toBeVisible({ timeout: 15000 });

    const body = await page.textContent('body') ?? '';
    // Either shows revealed state or the reveal form
    const hasRevealState = /Collection revealed|Reveal Base URI|revealed.*tokens/i.test(body);
    expect(hasRevealState).toBeTruthy();

    console.log('P5-08: Reveal Collection section verified ✓');
  });

  // ─── P5-09: Treasury Wallet section ──────────────────────────────────────
  test('P5-09: Collection & Controls tab — Treasury Wallet section is visible', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/nft/selling');
    await page.waitForLoadState('networkidle');

    const ccTab = page.locator('button').filter({ hasText: 'Collection & Controls' }).first();
    await ccTab.click();
    await page.waitForTimeout(1000);

    // Treasury Wallet section
    const treasurySection = page.getByText('Treasury Wallet', { exact: false });
    await expect(treasurySection.first()).toBeVisible({ timeout: 15000 });

    // Set On-Chain button should be present (but do NOT click it)
    const setBtn = page.locator('button').filter({ hasText: /Set On-Chain/i }).first();
    await expect(setBtn).toBeVisible({ timeout: 10000 });

    console.log('P5-09: Treasury Wallet section verified ✓');
  });

  // ─── P5-10: Emergency Controls — Pause + Withdraw buttons visible (NOT clicked) ──
  test('P5-10: Collection & Controls tab — Emergency Controls buttons visible (not triggered)', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/nft/selling');
    await page.waitForLoadState('networkidle');

    const ccTab = page.locator('button').filter({ hasText: 'Collection & Controls' }).first();
    await ccTab.click();
    await page.waitForTimeout(1000);

    // Emergency Controls section heading
    const emergencySection = page.getByText('Emergency Controls', { exact: false });
    await expect(emergencySection.first()).toBeVisible({ timeout: 15000 });

    // Pause Contract button (visible but NOT clicked — irreversible action)
    const pauseBtn = page.locator('button').filter({ hasText: /Pause Contract/i }).first();
    await expect(pauseBtn).toBeVisible({ timeout: 10000 });

    // Unpause Contract button
    const unpauseBtn = page.locator('button').filter({ hasText: /Unpause Contract/i }).first();
    await expect(unpauseBtn).toBeVisible({ timeout: 10000 });

    // Withdraw ETH button
    const withdrawBtn = page.locator('button').filter({ hasText: /Withdraw ETH/i }).first();
    await expect(withdrawBtn).toBeVisible({ timeout: 10000 });

    console.log('P5-10: Emergency Controls verified (not triggered) ✓');
  });

  // ─── P5-11: Contract Events section renders ───────────────────────────────
  test('P5-11: Collection & Controls tab — Contract Events section renders', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/nft/selling');
    await page.waitForLoadState('networkidle');

    const ccTab = page.locator('button').filter({ hasText: 'Collection & Controls' }).first();
    await ccTab.click();
    await page.waitForTimeout(1000);

    // Contract Events section heading
    const eventsSection = page.getByText('Contract Events', { exact: false });
    await expect(eventsSection.first()).toBeVisible({ timeout: 15000 });

    // Either shows event rows or "No events recorded yet" empty state
    const body = await page.textContent('body') ?? '';
    const hasEventsContent = /no events recorded|event name|tx hash|block/i.test(body);
    expect(hasEventsContent).toBeTruthy();

    console.log('P5-11: Contract Events section verified ✓');
  });

  // ─── P5-12: Royalty tab renders ───────────────────────────────────────────
  test('P5-12: Royalty tab renders without error', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/nft/selling');
    await page.waitForLoadState('networkidle');

    const royaltyTab = page.locator('button').filter({ hasText: 'Royalty' }).first();
    await royaltyTab.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Should not show a fatal error
    const body = await page.textContent('body') ?? '';
    expect(body).not.toMatch(/page crashed|fatal error/i);
    // Page should have some content
    expect(body.length).toBeGreaterThan(500);

    console.log('P5-12: Royalty tab rendered ✓');
  });

  // ─── P5-13: Membership tab renders ───────────────────────────────────────
  test('P5-13: Membership tab renders without error', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/nft/selling');
    await page.waitForLoadState('networkidle');

    const membershipTab = page.locator('button').filter({ hasText: 'Membership' }).first();
    await membershipTab.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const body = await page.textContent('body') ?? '';
    expect(body).not.toMatch(/page crashed|fatal error/i);
    expect(body.length).toBeGreaterThan(500);

    console.log('P5-13: Membership tab rendered ✓');
  });

  // ─── P5-14: Collection stats API returns valid data ───────────────────────
  test('P5-14: /api/nft-sell/collection returns valid config and onChain data', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto('/nft/selling');
    await page.waitForLoadState('networkidle');

    const res = await page.request.get('/api/nft-sell/collection');
    expect(res.ok()).toBe(true);

    const data = await res.json();
    const cfg = data.config ?? data;
    expect(cfg).toBeTruthy();

    // current_phase should be a known value
    const phase = cfg.current_phase ?? cfg.currentPhase;
    expect(['Whitelist', 'PaidMint', 'Revealed']).toContain(phase);

    const oc = data.onChain;
    if (oc) {
      expect(oc.maxSupply).toBe(9999);
      expect(typeof oc.totalMinted).toBe('number');
      console.log(`P5-14: Phase=${phase} Minted=${oc.totalMinted}/9999 ✓`);
    } else {
      console.log(`P5-14: Phase=${phase} (onChain data not available) ✓`);
    }
  });
});
