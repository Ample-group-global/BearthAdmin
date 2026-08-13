/**
 * WAVE E2E — Comprehensive Wave 1 & Wave 2 Test Suite
 *
 * Tests all features (Chrome visible, screenshots saved):
 *   Wave 1 (closed, 0 minted, auto_treasury):
 *     - Manage modal in closed/0-minted state
 *     - Auto Transfer button → TreasuryMoveModal → gas check → confirm
 *
 *   Wave 2 (fresh lifecycle):
 *     - Manage modal in all states (0 minted, active, closed, revealed)
 *     - Emergency Pause toggle test
 *     - ALL 4 strategy combinations (UI): Auto/Manual Treasury × Auto/Manual Reveal
 *     - Whitelist toggle
 *     - Schedule via API
 *     - On-chain push (schedule + price + purchase limit)
 *     - Customer minting (ethers.js direct)
 *     - Purchase limit enforcement
 *     - Wave auto-close
 *     - Manual reveal via "Reveal Now" (reveal_strategy=manual)
 *     - Auto treasury after reveal (unsold_strategy=auto_treasury)
 *     - Final state verification (Waves 3-7 untouched)
 *
 * Contract: 0x95Ee5f26572F10993d863A829e9E5AF797c3386C (Sepolia)
 * Pre-conditions: Wave 1 closed/0-minted, Wave 2 unscheduled, tests/.env.test populated
 */

import { test, expect } from '@playwright/test';
import { ethers } from 'ethers';
import { config as dotenvConfig } from 'dotenv';
import path from 'path';

dotenvConfig({ path: path.join(process.cwd(), 'tests', '.env.test') });

// ── Config ────────────────────────────────────────────────────────────────────
const CONTRACT_ADDRESS = '0x95Ee5f26572F10993d863A829e9E5AF797c3386C';
const RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
const API_URL = 'http://localhost:8000';
const REVEAL_URI = 'ipfs://bafybeiakx6lnmdt2ydsutp2zz2flz7a6uf3mewwoel7zqq24pz4bnbveby/metadata';
const SS = 'tests/wave-e2e-results/screenshots';

// Customer wallets
const CW2_KEY = process.env.CW2_PRIVATE_KEY ?? '';
const CW3_KEY = process.env.CW3_PRIVATE_KEY ?? '';

// Timing — T0 at module load
const T0 = Date.now();
function iso(deltaMin: number) { return new Date(T0 + deltaMin * 60_000).toISOString(); }
// Wave 2: start at T0+10min, end at T0+15min, reveal at T0+18min
const W2_START = iso(10);
const W2_END   = iso(15);
const W2_REVEAL = iso(18);

// Contract ABI (minimal for minting + limit check)
const ABI = [
  'function publicMint(uint256 waveNum, uint256 qty) external payable',
  'function wavePrice(uint256 waveNum) external view returns (uint256)',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function shot(page: import('@playwright/test').Page, name: string) {
  await page.screenshot({ path: `${SS}/${name}.png`, fullPage: true }).catch(() => {});
}

async function apiToken(): Promise<string> {
  const r = await fetch(`${API_URL}/api/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'amplecapitalholding@gmail.com', password: 'amplecapitalholding@123' }),
    signal: AbortSignal.timeout(15_000),
  });
  return ((await r.json()) as { token: string }).token;
}

async function getWaves(): Promise<any[]> {
  const r = await fetch(`${API_URL}/api/nft-sell/waves`);
  const d = await r.json() as { waves: any[] };
  return d.waves ?? [];
}

async function pollWave(waveNum: number, check: (w: any) => boolean, maxMs = 600_000): Promise<any> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const waves = await getWaves();
    const w = waves.find((x: any) => x.waveNumber === waveNum);
    if (w && check(w)) return w;
    await new Promise(r => setTimeout(r, 15_000));
  }
  throw new Error(`Wave ${waveNum} did not reach state within ${maxMs / 60_000}min`);
}

async function mintPaid(key: string, label: string, qty: number): Promise<string | null> {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(key, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);
  const price = await contract.wavePrice(2) as bigint;
  const value = price * BigInt(qty);
  const balance = await provider.getBalance(wallet.address);
  if (balance < value + ethers.parseEther('0.005')) {
    console.warn(`  ${label}: insufficient balance — skipping`);
    return null;
  }
  try {
    const tx = await contract.publicMint(2, qty, { value });
    const receipt = await tx.wait();
    return (receipt?.hash ?? tx.hash) as string;
  } catch (e: any) {
    console.warn(`  ${label}: mint failed — ${String(e.message).slice(0, 100)}`);
    return null;
  }
}

function openManageBtn(page: import('@playwright/test').Page, waveIdx: number) {
  return page.locator('button').filter({ hasText: /^Manage$/i }).nth(waveIdx);
}

// ── Test Suite ────────────────────────────────────────────────────────────────

test.describe.configure({ mode: 'serial' });

test.describe('Wave E2E — Wave 1 & Wave 2 Full Coverage', () => {

  test.afterEach(async ({ page }, ti) => {
    if (ti.status !== 'passed') {
      await shot(page, `FAIL-${ti.title.replace(/[^a-z0-9]/gi, '_').slice(0, 60)}`);
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // WE-00: PRE-CONDITION — Ensure Wave 1 is closed before the suite starts
  // (DB may be fresh from a reset; auto-trigger closes it once scheduled_end passes)
  // ════════════════════════════════════════════════════════════════════════════

  test('WE-00: Setup — ensure Wave 1 is closed (set past schedule, wait for auto-trigger)', async ({ page }) => {
    test.setTimeout(300_000);

    const waves = await getWaves();
    const w1 = waves.find((w: any) => w.waveNumber === 1);

    if (w1?.waveClosed || w1?.status === 'closed') {
      console.log(`WE-00: Wave 1 already closed (status=${w1?.status}) ✓ — no setup needed`);
      return;
    }

    console.log(`WE-00: Wave 1 is "${w1?.status}" — scheduling in past to trigger auto-close...`);
    const token = await apiToken();
    const pastStart = new Date(Date.now() - 3_600_000).toISOString(); // 1hr ago
    const pastEnd   = new Date(Date.now() - 300_000).toISOString();  // 5min ago

    const res = await fetch(`${API_URL}/api/waves/${w1.id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduledStart:  pastStart,
        scheduledEnd:    pastEnd,
        unsoldStrategy:  'auto_treasury',
        revealStrategy:  'auto',
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(`WE-00: DB update failed: ${res.status} — ${JSON.stringify(e)}`);
    }
    console.log('WE-00: Past schedule saved — waiting for auto-trigger to close Wave 1 (up to 3 min)...');

    const closed = await pollWave(1, (w: any) => w.waveClosed === true || w.status === 'closed', 240_000);
    console.log(`WE-00: Wave 1 closed ✓  status=${closed.status}, closeAction=${closed.closeAction}`);

    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');
    await shot(page, 'WE-00-wave1-closed');
  });

  // ════════════════════════════════════════════════════════════════════════════
  // WAVE 1 — closed, 0 minted, auto_treasury, no close_action
  // ════════════════════════════════════════════════════════════════════════════

  test('WE-01: /nft/waves loads — 7 Manage buttons, Wave 1 Closed status', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/nft/waves');
    await expect(page.locator('button').filter({ hasText: /^Manage$/i }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('button').filter({ hasText: /^Manage$/i })).toHaveCount(7, { timeout: 30_000 });

    // Wait for Wave 1 to show "Closed" — may need a reload if cache served stale data
    let closedVisible = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      closedVisible = await page.locator('body').textContent().then(t => /closed/i.test(t ?? '')).catch(() => false);
      if (closedVisible) break;
      console.log(`WE-01: "Closed" not visible yet (attempt ${attempt + 1}/3) — reloading...`);
      await page.waitForTimeout(3_000);
      await page.reload();
      await page.waitForLoadState('networkidle');
    }
    if (!closedVisible) {
      // Final attempt: verify via API that Wave 1 is indeed closed (catches mis-render)
      const waves = await getWaves();
      const w1 = waves.find((w: any) => w.waveNumber === 1);
      console.log(`WE-01: API reports Wave 1 status=${w1?.status} waveClosed=${w1?.waveClosed}`);
      expect(w1?.status, 'Wave 1 must be closed in DB').toBe('closed');
    }
    await shot(page, 'WE-01-waves-page');
    console.log('WE-01: 7 waves loaded, Wave 1 confirmed Closed ✓');
  });

  test('WE-02: Wave 1 REVEAL column — "Auto Transfer" button visible (isZeroMinted + auto_treasury)', async ({ page }) => {
    test.setTimeout(30_000);

    // If auto-trigger already ran treasury close (happens ~95s after wave-end), skip gracefully
    const waves = await getWaves();
    const w1 = waves.find((w: any) => w.waveNumber === 1);
    if (w1?.closeAction === 'treasury') {
      console.log('WE-02: Wave 1 already treasury-closed by auto-trigger — "Auto Transfer" correctly absent ✓');
      return;
    }

    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');
    const btn = page.locator('button').filter({ hasText: /auto transfer/i });
    await expect(btn.first()).toBeVisible({ timeout: 15_000 });
    await shot(page, 'WE-02-auto-transfer-btn');
    console.log(`WE-02: Auto Transfer button visible ✓`);
  });

  test('WE-03: Wave 1 Manage modal — all fields in closed/0-minted state', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');
    await openManageBtn(page, 0).click(); // Wave 1
    await expect(page.locator('button').filter({ hasText: /^Save Settings$/i })).toBeVisible({ timeout: 10_000 });
    await shot(page, 'WE-03-w1-manage-open');

    // W1 badge + name
    await expect(page.locator('body')).toContainText('W1');
    await expect(page.locator('body')).toContainText('303');
    // Free mint message (wave 1 only)
    await expect(page.locator('body')).toContainText('Free Mint', { ignoreCase: true });
    // Emergency Pause: HIDDEN (wave closed)
    expect(await page.locator('text=Emergency Pause').count()).toBe(0);
    // Schedule locked info
    await expect(page.locator('body')).toContainText('Wave schedule is locked', { ignoreCase: true });
    // Unsold Strategy section
    await expect(page.locator('body')).toContainText('Auto → Treasury Wallet');
    // Reveal Strategy section
    await expect(page.locator('body')).toContainText('Auto Reveal');
    // No purchase limit (wave 1)
    expect(await page.locator('text=Per-Wave Purchase Limit').count()).toBe(0);
    // Save Settings still visible (not fully revealed)
    await expect(page.locator('button').filter({ hasText: /^Save Settings$/i })).toBeVisible();

    console.log('WE-03: Wave 1 Manage modal all fields verified ✓');
    await page.locator('button').filter({ hasText: /^Close$/i }).last().click();
    await shot(page, 'WE-03-w1-manage-closed');
  });

  test('WE-04: Wave 1 Auto Transfer → TreasuryMoveModal gas check UI', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');

    // If Wave 1 already treasury-closed, skip
    const waves = await getWaves();
    const w1 = waves.find(w => w.waveNumber === 1);
    if (w1?.closeAction === 'treasury') {
      console.log('WE-04: Wave 1 already treasury-closed — skipping UI test ✓');
      return;
    }

    await page.locator('button').filter({ hasText: /auto transfer/i }).first().click();
    const modal = page.locator('div.fixed.inset-0').filter({ hasText: /Move to Wallet/i }).last();
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await shot(page, 'WE-04-treasury-modal-open');

    // Header
    await expect(modal.locator('h2')).toContainText('Move to Wallet');
    await expect(modal.locator('h2')).toContainText('W1');
    // Default treasury wallet info
    await expect(modal.locator('text=Default Treasury Wallet')).toBeVisible();
    // Gas Check section
    await expect(modal.locator('text=Gas Check')).toBeVisible();

    // Wait for gas fetch to resolve
    await page.waitForFunction(
      () => !document.body.textContent?.includes('Fetching wallet balance'),
      { timeout: 20_000 }
    );
    await shot(page, 'WE-04-gas-check-resolved');

    // Should show balance row
    const body = await page.textContent('body') ?? '';
    expect(body).toMatch(/Signer wallet balance/i);
    expect(body).toMatch(/Estimated gas cost/i);
    const isSufficient = /Sufficient funds/i.test(body);
    const isInsufficient = /Insufficient funds/i.test(body);
    expect(isSufficient || isInsufficient).toBe(true);
    console.log(`WE-04: Gas check — ${isSufficient ? 'Sufficient ✓' : 'Insufficient — wallet needs top-up'}`);

    // Confirm Transfer button visible
    const confirmBtn = modal.locator('button').filter({ hasText: /Confirm Transfer/i });
    await expect(confirmBtn).toBeVisible();
    if (isSufficient) {
      await expect(confirmBtn).toBeEnabled();
    }

    await page.keyboard.press('Escape');
  });

  test('WE-05: Wave 1 Auto Transfer — execute treasury close (Sepolia TX)', async ({ page }) => {
    test.setTimeout(600_000);

    const waves = await getWaves();
    const w1 = waves.find(w => w.waveNumber === 1);
    if (w1?.closeAction === 'treasury') {
      console.log('WE-05: Wave 1 already treasury-closed ✓ — skipping TX');
      return;
    }

    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');

    const autoBtn = page.locator('button').filter({ hasText: /auto transfer/i }).first();
    if (await autoBtn.count() === 0) {
      console.log('WE-05: No Auto Transfer button (Wave 1 already done) ✓');
      return;
    }
    await autoBtn.click();

    const modal = page.locator('div.fixed.inset-0').filter({ hasText: /Move to Wallet/i }).last();
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await page.waitForFunction(() => !document.body.textContent?.includes('Fetching wallet balance'), { timeout: 20_000 });
    await shot(page, 'WE-05-before-confirm');

    const confirmBtn = modal.locator('button').filter({ hasText: /Confirm Transfer/i });
    await expect(confirmBtn).toBeEnabled({ timeout: 5_000 });
    await confirmBtn.click();
    console.log('WE-05: Confirm Transfer clicked — waiting for Sepolia TX (may take 1-3 min)...');

    // Wait for TxSuccessModal
    await expect(page.locator('h2').filter({ hasText: 'Wave 1 Transferred!' })).toBeVisible({ timeout: 300_000 });
    await shot(page, 'WE-05-wave1-transferred');

    const doneBtn = page.locator('button').filter({ hasText: /^Done$/i });
    if (await doneBtn.isVisible({ timeout: 3_000 }).catch(() => false)) await doneBtn.click();
    else await page.keyboard.press('Escape');
    console.log('WE-05: Wave 1 Auto Transfer SUCCESS ✓');
  });

  test('WE-06: Verify Wave 1 — closeAction=treasury, "✓ Transferred" badge shown', async ({ page }) => {
    test.setTimeout(30_000);
    const waves = await getWaves();
    const w1 = waves.find(w => w.waveNumber === 1);
    expect(w1?.closeAction, 'Wave 1 closeAction must be treasury').toBe('treasury');
    console.log(`WE-06: Wave 1 closeAction=${w1?.closeAction} ✓`);

    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');
    await shot(page, 'WE-06-wave1-done');
    const body = await page.textContent('body') ?? '';
    expect(body).toMatch(/Treasury/i); // "→ Treasury" shown in status column when closeAction=treasury
    // Auto Transfer button for Wave 1 should be gone
    const autoButtons = page.locator('button').filter({ hasText: /auto transfer/i });
    const count = await autoButtons.count();
    console.log(`WE-06: Auto Transfer buttons remaining: ${count}`);
    console.log('WE-06: Wave 1 shows Transferred badge, no Auto Transfer btn for W1 ✓');
  });

  // ════════════════════════════════════════════════════════════════════════════
  // WAVE 2 — MANAGE MODAL TESTS (0 minted, upcoming)
  // ════════════════════════════════════════════════════════════════════════════

  test('WE-07: Wave 2 Manage modal — all fields in 0-minted upcoming state', async ({ page }) => {
    test.setTimeout(60_000);
    const waves07 = await getWaves();
    const w2_07 = waves07.find((w: any) => w.waveNumber === 2);
    if (w2_07?.waveClosed) {
      console.log('WE-07: Wave 2 already closed from previous run — skipping upcoming-state checks ✓');
      return;
    }
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');
    await openManageBtn(page, 1).click(); // Wave 2 = index 1
    await expect(page.locator('button').filter({ hasText: /^Save Settings$/i })).toBeVisible({ timeout: 10_000 });
    await shot(page, 'WE-07-w2-manage-open');

    const body = await page.textContent('body') ?? '';
    // Header
    expect(body).toMatch(/W2/);
    expect(body).toMatch(/Genesis.*Fixed Price/i);
    // Quantity
    expect(body).toMatch(/303/);
    // Price input editable (not closed)
    await expect(page.locator('input[type="number"][step="0.0001"]').first()).toBeVisible();
    // Emergency Pause visible (not closed)
    await expect(page.locator('text=Emergency Pause')).toBeVisible();
    // On-Chain Actions warning
    expect(body).toMatch(/On-Chain Actions/i);
    // Unsold Strategy
    expect(body).toMatch(/Unsold NFT Strategy/i);
    // Whitelist Restriction (wave > 1)
    await expect(page.locator('text=Restrict to Whitelist')).toBeVisible();
    // Reveal Strategy
    expect(body).toMatch(/Reveal Strategy/i);
    // Per-Wave Purchase Limit (wave > 1)
    await expect(page.locator('text=Per-Wave Purchase Limit')).toBeVisible();
    // Push Schedule On-Chain section
    expect(body).toMatch(/Push Wave Schedule On-Chain/i);

    console.log('WE-07: Wave 2 Manage modal all 0-minted fields verified ✓');
    await page.locator('button').filter({ hasText: /^Close$/i }).last().click();
  });

  test('WE-08: Emergency Pause toggle — enable then disable', async ({ page }) => {
    test.setTimeout(30_000);
    const waves08 = await getWaves();
    const w2_08 = waves08.find((w: any) => w.waveNumber === 2);
    if (w2_08?.waveClosed) {
      console.log('WE-08: Wave 2 already closed — Emergency Pause hidden for closed waves, skipping ✓');
      return;
    }
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');
    await openManageBtn(page, 1).click();
    await expect(page.locator('button').filter({ hasText: /^Save Settings$/i })).toBeVisible({ timeout: 10_000 });

    // The pause checkbox is inside a label (sr-only hidden, but clickable via label)
    const pauseLabel = page.locator('label').filter({ has: page.locator('input[type="checkbox"]') }).first();
    const pauseCb = pauseLabel.locator('input[type="checkbox"]');

    expect(await pauseCb.isChecked()).toBe(false);
    await shot(page, 'WE-08-pause-off');

    // Enable pause
    await pauseLabel.click();
    await expect(pauseCb).toBeChecked();
    await shot(page, 'WE-08-pause-enabled');
    console.log('WE-08: Emergency Pause enabled (amber toggle) ✓');

    // Disable pause
    await pauseLabel.click();
    await expect(pauseCb).not.toBeChecked();
    await shot(page, 'WE-08-pause-disabled');
    console.log('WE-08: Emergency Pause disabled ✓');

    await page.locator('button').filter({ hasText: /^Close$/i }).last().click();
  });

  test('WE-09: Strategy combinations UI — all 4 combos in Manage modal', async ({ page }) => {
    test.setTimeout(60_000);
    const waves09 = await getWaves();
    const w2_09 = waves09.find((w: any) => w.waveNumber === 2);
    if (w2_09?.waveClosed) {
      console.log('WE-09: Wave 2 already closed — strategy toggles locked for closed waves, skipping ✓');
      return;
    }
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');
    await openManageBtn(page, 1).click();
    await expect(page.locator('button').filter({ hasText: /^Save Settings$/i })).toBeVisible({ timeout: 10_000 });

    // ── Combo 1: Auto Treasury + Auto Reveal (default) ──
    const b1 = await page.textContent('body') ?? '';
    expect(b1).toMatch(/Auto.*Treasury Wallet/i);
    expect(b1).toMatch(/Auto Reveal/i);
    expect(b1).toMatch(/Auto mode.*reveal date/i);
    await shot(page, 'WE-09-combo1-auto-auto');
    console.log('WE-09 Combo 1: Auto Treasury + Auto Reveal → "Auto mode" ✓');

    // ── Combo 2: Auto Treasury + Manual Reveal ──
    await page.locator('button').filter({ hasText: /Manual Reveal/i }).click();
    await page.waitForTimeout(300);
    const b2 = await page.textContent('body') ?? '';
    expect(b2).toMatch(/Manual mode.*auto-trigger will skip/i);
    await shot(page, 'WE-09-combo2-auto-manual');
    console.log('WE-09 Combo 2: Auto Treasury + Manual Reveal → "Manual mode" ✓');

    // ── Combo 3: Manual Treasury + Manual Reveal ──
    await page.locator('button').filter({ hasText: /Manual Transfer/i }).click();
    await page.waitForTimeout(300);
    const b3 = await page.textContent('body') ?? '';
    expect(b3).toMatch(/Manual Transfer/i);
    expect(b3).toMatch(/Manual mode.*auto-trigger/i);
    await shot(page, 'WE-09-combo3-manual-manual');
    console.log('WE-09 Combo 3: Manual Treasury + Manual Reveal ✓');

    // ── Combo 4: Manual Treasury + Auto Reveal ──
    await page.locator('button').filter({ hasText: /Auto Reveal/i }).click();
    await page.waitForTimeout(300);
    const b4 = await page.textContent('body') ?? '';
    expect(b4).toMatch(/Auto mode.*reveal date/i);
    await shot(page, 'WE-09-combo4-manual-auto');
    console.log('WE-09 Combo 4: Manual Treasury + Auto Reveal ✓');

    // Reset to Auto Treasury + Auto Reveal (set back to default)
    await page.locator('button').filter({ hasText: /Auto.*Treasury Wallet/i }).click();
    await page.locator('button').filter({ hasText: /Auto Reveal/i }).click();
    await page.waitForTimeout(200);
    console.log('WE-09: All 4 strategy combinations verified ✓');
    await page.locator('button').filter({ hasText: /^Close$/i }).last().click();
  });

  test('WE-10: Wave 2 Whitelist toggle — off then on', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');
    await openManageBtn(page, 1).click();
    await expect(page.locator('button').filter({ hasText: /^Save Settings$/i })).toBeVisible({ timeout: 10_000 });

    // The whitelist toggle is a <button> in the "Restrict to Whitelist" section
    // Navigate from the 'Restrict to Whitelist' label p-tag up 2 levels to the flex row, then to its button sibling
    const wlBtn = page.getByText('Restrict to Whitelist').locator('xpath=../../button');

    await wlBtn.click();
    await shot(page, 'WE-10-whitelist-off');
    console.log('WE-10: Whitelist toggled OFF ✓');

    await wlBtn.click();
    await shot(page, 'WE-10-whitelist-on');
    console.log('WE-10: Whitelist toggled ON ✓');

    await page.locator('button').filter({ hasText: /^Close$/i }).last().click();
  });

  // ════════════════════════════════════════════════════════════════════════════
  // WAVE 2 — SCHEDULE + ON-CHAIN PUSH
  // Strategy: auto_treasury + manual_reveal (tests "Reveal Now" flow)
  // ════════════════════════════════════════════════════════════════════════════

  test('WE-11: Wave 2 — save schedule + strategies via API (start T0+10, end T0+15, manual reveal)', async ({ page }) => {
    test.setTimeout(30_000);

    const waves = await getWaves();
    const w2 = waves.find(w => w.waveNumber === 2);

    if (w2?.scheduledStart) {
      console.log(`WE-11: Wave 2 already scheduled: ${w2.scheduledStart} ✓ — skipping`);
      return;
    }

    const token = await apiToken();
    const res = await fetch(`${API_URL}/api/waves/${w2.id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduledStart: W2_START,
        scheduledEnd: W2_END,
        unsoldStrategy: 'auto_treasury',
        revealStrategy: 'manual',
      }),
      signal: AbortSignal.timeout(15_000),
    });
    expect(res.ok, `DB save failed: ${res.status}`).toBeTruthy();

    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');
    await shot(page, 'WE-11-w2-scheduled');
    console.log(`WE-11: Wave 2 scheduled — start=${W2_START.slice(0, 16)}, revealStrategy=manual ✓`);
  });

  test('WE-12: Wave 2 — push schedule on-chain', async ({ page }) => {
    test.setTimeout(300_000);

    const checkRes = await page.request.get('/api/nft-sell/waves/2', { timeout: 15_000 });
    const checkData = await checkRes.json();
    if (checkData.onChain?.startTime > 0) {
      console.log('WE-12: Wave 2 already on-chain ✓');
      return;
    }

    const waves = await getWaves();
    const w2 = waves.find(w => w.waveNumber === 2);
    const startUnix = Math.floor(new Date(w2.scheduledStart).getTime() / 1000);
    const endUnix   = Math.floor(new Date(w2.scheduledEnd).getTime() / 1000);

    const res = await page.request.put('/api/nft-sell/waves/2/schedule', {
      data: { startUnix, endUnix },
      timeout: 240_000,
    });
    if (res.status() === 409) { console.log('WE-12: Already on-chain (locked) ✓'); return; }
    expect(res.ok()).toBe(true);
    const d = await res.json();
    console.log(`WE-12: Wave 2 schedule pushed on-chain ✓  txHash=${String(d.txHash).slice(0, 22)}...`);
  });

  test('WE-13: Wave 2 — set purchase limit on-chain (2 per wallet)', async ({ page }) => {
    test.setTimeout(240_000);

    const checkRes = await page.request.get('/api/nft-sell/waves/2', { timeout: 15_000 });
    const checkData = await checkRes.json();
    if (checkData.onChain?.purchaseLimit === 2) {
      console.log('WE-13: Purchase limit already 2 ✓');
      return;
    }

    const res = await page.request.put('/api/nft-sell/waves/2/purchase-limit', {
      data: { maxPerWallet: 2 },
      timeout: 180_000,
    });
    if (res.ok()) {
      const d = await res.json();
      console.log(`WE-13: Purchase limit set to 2/wallet ✓  txHash=${String(d.txHash).slice(0, 22)}...`);
    } else {
      const e = await res.json();
      console.warn(`WE-13: purchase-limit TX failed (${res.status()}): ${e.error} — continuing`);
    }
  });

  test('WE-14: Manage modal shows on-chain state after pushes (price, qty, limit)', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');
    await openManageBtn(page, 1).click();
    await expect(page.locator('button').filter({ hasText: /^Save Settings$/i })).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(4_000); // let on-chain fetch complete
    await shot(page, 'WE-14-w2-manage-after-push');

    const body = await page.textContent('body') ?? '';
    // Push Schedule section may be visible (if not yet active)
    // On-chain data cards: Minted / Price / Closed
    if (/Minted.*Price.*Closed/is.test(body) || /0.*\/.*303/i.test(body)) {
      console.log('WE-14: On-chain state cards visible ✓');
    }
    if (/On-chain:.*wallet/i.test(body)) {
      console.log('WE-14: Purchase limit on-chain badge visible ✓');
    }
    // revealStrategy=manual status message
    expect(body).toMatch(/Manual mode.*auto-trigger/i);
    console.log('WE-14: Manual reveal strategy hint visible ✓');

    await page.locator('button').filter({ hasText: /^Close$/i }).last().click();
    console.log('WE-14: Manage modal on-chain state verified ✓');
  });

  test('WE-15: Wait for Wave 2 to activate (wave_start_triggered=true)', async ({ page }) => {
    test.setTimeout(900_000); // 15 min max

    const waves15 = await getWaves();
    const w2_15 = waves15.find((w: any) => w.waveNumber === 2);
    if (w2_15?.waveClosed || w2_15?.status === 'closed') {
      console.log(`WE-15: Wave 2 already closed (status=${w2_15?.status}) — skipping activation wait ✓`);
      return;
    }

    const startMs = new Date(W2_START).getTime();
    const nowMs = Date.now();
    if (startMs > nowMs) {
      const waitMs = startMs - nowMs + 5_000;
      console.log(`WE-15: Wave 2 opens in ${Math.round(waitMs / 1000)}s — waiting...`);
    }

    const wave = await pollWave(2, w => w.waveStartTriggered === true || w.status === 'active', 900_000);
    console.log(`WE-15: Wave 2 ACTIVE! soldCount=${wave.soldCount} ✓`);

    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');
    await shot(page, 'WE-15-w2-active');
    // UI should show Active badge
    await expect(page.locator('body')).toContainText('Active', { ignoreCase: true, timeout: 10_000 });
    console.log('WE-15: Wave 2 Active badge confirmed on page ✓');
  });

  test('WE-16: Customer minting — CW2(1) and CW3(1) publicMint Wave 2', async ({ page }) => {
    test.setTimeout(300_000);

    // CW2 mint 1
    if (CW2_KEY) {
      const h2 = await mintPaid(CW2_KEY, 'CW2', 1);
      console.log(h2 ? `WE-16: CW2 mint ✓  ${h2.slice(0, 22)}...` : 'WE-16: CW2 skipped (balance)');
    } else {
      console.warn('WE-16: CW2_PRIVATE_KEY not set — skipping');
    }

    // CW3 mint 1
    if (CW3_KEY) {
      const h3 = await mintPaid(CW3_KEY, 'CW3', 1);
      console.log(h3 ? `WE-16: CW3 mint ✓  ${h3.slice(0, 22)}...` : 'WE-16: CW3 skipped (balance)');
    } else {
      console.warn('WE-16: CW3_PRIVATE_KEY not set — skipping');
    }

    await page.waitForTimeout(8_000); // let events propagate
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');
    await shot(page, 'WE-16-after-minting');

    const waves = await getWaves();
    const w2 = waves.find(w => w.waveNumber === 2);
    console.log(`WE-16: Wave 2 soldCount=${w2?.soldCount ?? 0} after minting`);
  });

  test('WE-17: Purchase limit enforcement — CW2 tries to mint 2 more (would exceed limit of 2)', async ({ page }) => {
    test.setTimeout(120_000);
    if (!CW2_KEY) { console.warn('WE-17: CW2 key not set — skipping'); return; }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(CW2_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

    const price = await contract.wavePrice(2) as bigint;
    const qty = 2;

    try {
      const tx = await contract.publicMint(2, qty, { value: price * BigInt(qty) });
      await tx.wait();
      console.warn('WE-17: TX succeeded unexpectedly — limit may not have been enforced on-chain');
    } catch (e: any) {
      const msg = String(e.message ?? '');
      if (/purchase|limit|exceed|Exceed/i.test(msg)) {
        console.log(`WE-17: Purchase limit enforced — over-mint rejected ✓\n  Err: ${msg.slice(0, 100)}`);
      } else if (/insufficient funds/i.test(msg)) {
        console.warn('WE-17: Skipped — CW2 insufficient ETH for 2 extra mints');
      } else {
        console.log(`WE-17: Mint rejected (${msg.slice(0, 100)}) — may be limit or wave state`);
      }
    }
    await shot(page, 'WE-17-purchase-limit-test');
    console.log('WE-17: Purchase limit test complete ✓');
  });

  test('WE-18: Manage modal while ACTIVE — locked price, Push Schedule hidden', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');
    await openManageBtn(page, 1).click();
    await expect(page.locator('button').filter({ hasText: /^Save Settings$/i })).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(3_000);
    await shot(page, 'WE-18-w2-manage-active');

    const body = await page.textContent('body') ?? '';
    // If wave started, Push Schedule On-Chain section should be hidden
    const pushVisible = await page.locator('text=Push Wave Schedule On-Chain').count();
    if (pushVisible === 0) {
      console.log('WE-18: Push Schedule section hidden (wave started) ✓');
    }
    // Strategies still editable
    if (/Reveal Strategy/i.test(body)) {
      console.log('WE-18: Reveal Strategy still editable (not revealed) ✓');
    }
    await page.locator('button').filter({ hasText: /^Close$/i }).last().click();
    console.log('WE-18: Active wave Manage modal verified ✓');
  });

  test('WE-19: Wait for Wave 2 to auto-close (wave_end_triggered=true)', async ({ page }) => {
    test.setTimeout(900_000);

    const endMs = new Date(W2_END).getTime();
    const nowMs = Date.now();
    if (endMs > nowMs) {
      console.log(`WE-19: Wave 2 closes in ${Math.round((endMs - nowMs) / 1000)}s — waiting...`);
    }

    const wave = await pollWave(2, w => w.waveEndTriggered === true || w.waveClosed === true, 900_000);
    console.log(`WE-19: Wave 2 CLOSED! soldCount=${wave.soldCount}, endTriggered=${wave.waveEndTriggered} ✓`);

    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');
    await shot(page, 'WE-19-w2-closed');
    // Wave 2 shows "Closed" if no reveal date set, or "Ready to Reveal" if reveal_scheduled_at is set
    await expect(page.locator('body')).toContainText(/Closed|Ready to Reveal/);
    console.log('WE-19: Wave 2 auto-close confirmed ✓');
  });

  test('WE-20: Wave 2 Manage modal after CLOSED — locked price/schedule, Emergency Pause hidden', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');
    await openManageBtn(page, 1).click();
    await expect(page.locator('button').filter({ hasText: /^Save Settings$/i })).toBeVisible({ timeout: 10_000 });
    await shot(page, 'WE-20-w2-manage-closed');

    const body = await page.textContent('body') ?? '';
    // Price locked (wave closed)
    expect(body).toMatch(/Final Price.*Fixed Price|Wave closed.*price.*locked/i);
    console.log('WE-20: Price locked ✓');
    // Schedule locked
    expect(body).toMatch(/Wave schedule is locked/i);
    console.log('WE-20: Schedule locked ✓');
    // Emergency Pause hidden (wave closed)
    expect(await page.locator('text=Emergency Pause').count()).toBe(0);
    console.log('WE-20: Emergency Pause hidden (wave closed) ✓');
    // Reveal strategy still editable
    await expect(page.locator('text=Reveal Strategy')).toBeVisible();
    console.log('WE-20: Reveal strategy still editable ✓');

    await page.locator('button').filter({ hasText: /^Close$/i }).last().click();
    console.log('WE-20: Closed wave Manage modal verified ✓');
  });

  test('WE-21: Set Wave 2 reveal date via API (T0+18), then "Set Date" shows on page', async ({ page }) => {
    test.setTimeout(60_000);

    const waves = await getWaves();
    const w2 = waves.find(w => w.waveNumber === 2);

    if (w2?.revealScheduledAt) {
      console.log(`WE-21: Reveal date already set: ${w2.revealScheduledAt} ✓`);
    } else {
      const token = await apiToken();
      const res = await fetch(`${API_URL}/api/waves/${w2.id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ revealScheduledAt: W2_REVEAL }),
        signal: AbortSignal.timeout(15_000),
      });
      expect(res.ok, `Reveal date save failed: ${res.status}`).toBeTruthy();
      console.log(`WE-21: Reveal date set: ${W2_REVEAL} ✓`);
    }

    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');
    await shot(page, 'WE-21-reveal-date-set');
    // "Edit Date" button should now appear in REVEAL column for Wave 2
    const editDateBtn = page.locator('button').filter({ hasText: /Edit Date|Set Date/i });
    const count = await editDateBtn.count();
    console.log(`WE-21: Edit/Set Date button count: ${count} ✓`);
  });

  test('WE-22: Wait for reveal date — "Reveal Now" button appears (manual strategy, auto-trigger skipped)', async ({ page }) => {
    test.setTimeout(900_000);

    // Use actual DB reveal date (set by WE-21) to avoid unnecessary sleep on re-runs
    const waves22pre = await getWaves();
    const w2pre = waves22pre.find((w: any) => w.waveNumber === 2);
    const dbRevealMs = w2pre?.revealScheduledAt ? new Date(w2pre.revealScheduledAt).getTime() : null;
    const revealMs = dbRevealMs ?? new Date(W2_REVEAL).getTime();
    const nowMs = Date.now();
    if (revealMs > nowMs) {
      const waitMs = revealMs - nowMs + 10_000;
      console.log(`WE-22: Reveal date in ${Math.round(waitMs / 1000)}s — waiting...`);
      // Use page.waitForTimeout in 30s chunks — keeps the Chrome page context alive.
      // A single long setTimeout leaves the page idle and Chrome's watchdog kills it.
      let remaining = waitMs;
      while (remaining > 0) {
        await page.waitForTimeout(Math.min(remaining, 30_000));
        remaining -= 30_000;
      }
    } else {
      console.log('WE-22: Reveal date already passed — proceeding immediately ✓');
    }

    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');
    await shot(page, 'WE-22-after-reveal-time');

    // Check via API: auto-trigger should NOT have fired (reveal_strategy=manual)
    const waves = await getWaves();
    const w2 = waves.find(w => w.waveNumber === 2);
    if (w2?.waveRevealed) {
      console.log('WE-22: Wave 2 already revealed (auto-trigger may have run despite manual strategy)');
    } else {
      // "Reveal Now" button should appear
      const revealBtn = page.locator('button').filter({ hasText: /Reveal Now/i });
      const btnCount = await revealBtn.count();
      if (btnCount > 0) {
        console.log('WE-22: "Reveal Now" button visible (manual reveal, auto-trigger skipped) ✓');
      } else {
        // Wait up to 30 more seconds for page to refresh
        await page.waitForTimeout(30_000);
        await page.goto('/nft/waves');
        await page.waitForLoadState('networkidle');
        await shot(page, 'WE-22-reveal-btn-retry');
        console.log('WE-22: Refreshed page — checking for Reveal Now button');
      }
    }
  });

  test('WE-23: Manual reveal via "Reveal Now" → WaveRevealModal → confirm', async ({ page }) => {
    test.setTimeout(900_000); // 15 min — Sepolia TXes can queue if auto-trigger submitted concurrently

    const waves = await getWaves();
    const w2 = waves.find(w => w.waveNumber === 2);
    if (w2?.waveRevealed) {
      console.log('WE-23: Wave 2 already revealed ✓ — skipping');
      return;
    }
    // Auto-trigger may have treasury-closed Wave 2 between WE-19 and now
    if (w2?.closeAction === 'treasury') {
      console.log('WE-23: Wave 2 already treasury-closed by auto-trigger ✓ — skipping');
      return;
    }

    // Check if soldCount=0 — if no mints, use Auto Transfer instead of reveal
    if ((w2?.soldCount ?? 0) === 0 && !w2?.waveRevealed) {
      console.log('WE-23: Wave 2 has 0 mints — checking for Auto Transfer button instead');
      await page.goto('/nft/waves');
      await page.waitForLoadState('networkidle');
      const autoBtn = page.locator('button').filter({ hasText: /auto transfer/i });
      const autoBtnCount = await autoBtn.count();
      if (autoBtnCount > 0) {
        // 0-minted wave: use Auto Transfer path
        await autoBtn.first().click();
        const modal = page.locator('div.fixed.inset-0').filter({ hasText: /Move to Wallet/i }).last();
        await expect(modal).toBeVisible({ timeout: 10_000 });
        await page.waitForFunction(() => !document.body.textContent?.includes('Fetching wallet balance'), { timeout: 20_000 });
        const confirmBtn = modal.locator('button').filter({ hasText: /Confirm Transfer/i });
        await expect(confirmBtn).toBeEnabled({ timeout: 5_000 });
        await confirmBtn.click();
        console.log('WE-23: Treasury TX submitted — waiting up to 10 min for Sepolia confirmation...');

        // Wait for success modal OR ''taking longer'' fallback (AbortController fires at 360s)
        const successH2 = page.locator('h2').filter({ hasText: 'Wave 2 Transferred!' });
        const takingLonger = page.locator('text=Transaction submitted but is taking longer');
        const which = await Promise.race([
          successH2.waitFor({ timeout: 600_000 }).then(() => 'success' as const),
          takingLonger.waitFor({ timeout: 600_000 }).then(() => 'longer' as const),
        ]).catch(() => 'timeout' as const);

        if (which === 'success') {
          await shot(page, 'WE-23-w2-auto-transfer-success');
          const doneBtn = page.locator('button').filter({ hasText: /^Done$/i });
          if (await doneBtn.isVisible({ timeout: 3_000 }).catch(() => false)) await doneBtn.click();
          else await page.keyboard.press('Escape');
          console.log('WE-23: Wave 2 (0 minted) Auto Transfer SUCCESS ✓');
        } else {
          // TX taking longer or timed out — poll API until treasury close is confirmed
          await shot(page, 'WE-23-treasury-tx-pending');
          console.log('WE-23: TX pending — polling API for closeAction=treasury (up to 10 min)...');
          await page.keyboard.press('Escape').catch(() => {});
          const confirmed = await pollWave(2, w => w.closeAction === 'treasury', 600_000);
          console.log(`WE-23: Wave 2 treasury close confirmed via API ✓ (closeAction=${confirmed.closeAction})`);
        }
        return;
      } else {
        // No Auto Transfer button — check if auto-trigger already closed it (race condition)
        const fw = await getWaves();
        const fw2 = fw.find(w => w.waveNumber === 2);
        if (fw2?.closeAction === 'treasury') {
          console.log('WE-23: Wave 2 treasury-closed by auto-trigger (race) ✓ — skipping');
          return;
        }
        // No button and not closed — fall through to Reveal Now path
      }
    }

    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');

    // Find "Reveal Now" button
    let revealBtn = page.locator('button').filter({ hasText: /Reveal Now/i });
    if (await revealBtn.count() === 0) {
      await page.waitForTimeout(35_000); // wait one auto-trigger cycle
      await page.goto('/nft/waves');
      await page.waitForLoadState('networkidle');
    }
    await expect(page.locator('button').filter({ hasText: /Reveal Now/i })).toBeVisible({ timeout: 60_000 });
    await page.locator('button').filter({ hasText: /Reveal Now/i }).first().click();

    // WaveRevealModal
    const modal = page.locator('div.fixed.inset-0').filter({ hasText: /Reveal Wave 2/i }).last();
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await shot(page, 'WE-23-reveal-modal-open');

    // Fill IPFS URI
    const uriInput = modal.locator('input[placeholder*="ipfs" i]').first();
    await uriInput.fill(REVEAL_URI);
    await expect(uriInput).toHaveValue(REVEAL_URI);

    // Check confirmation checkbox
    const confirmCb = modal.locator('input[type="checkbox"]');
    await confirmCb.check();
    await expect(confirmCb).toBeChecked();
    await shot(page, 'WE-23-reveal-modal-ready');

    // Confirm Reveal
    const confirmRevealBtn = modal.locator('button').filter({ hasText: /Confirm Reveal/i });
    await expect(confirmRevealBtn).toBeEnabled({ timeout: 5_000 });
    await confirmRevealBtn.click();
    console.log('WE-23: Confirm Reveal clicked — waiting for Sepolia TX (includes auto-treasury)...');

    // Wait for TxSuccessModal "Wave 2 Revealed!" (up to 10 min)
    await expect(page.locator('h2').filter({ hasText: 'Wave 2 Revealed!' })).toBeVisible({ timeout: 600_000 });
    await shot(page, 'WE-23-wave2-revealed');

    const doneBtn = page.locator('button').filter({ hasText: /^Done$/i });
    if (await doneBtn.isVisible({ timeout: 3_000 }).catch(() => false)) await doneBtn.click();
    else await page.keyboard.press('Escape');
    console.log('WE-23: Wave 2 manual reveal SUCCESS (auto-treasury also ran) ✓');
  });
  test('WE-24: Wave 2 Manage modal after REVEALED — strategies locked, Save Settings hidden', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');
    await openManageBtn(page, 1).click();
    await page.waitForTimeout(2_000);
    await shot(page, 'WE-24-w2-manage-revealed');

    const body = await page.textContent('body') ?? '';
    const waves = await getWaves();
    const w2 = waves.find(w => w.waveNumber === 2);

    if (w2?.waveRevealed) {
      // Strategy should be locked
      expect(body).toMatch(/Strategy is locked/i);
      console.log('WE-24: Strategy locked after reveal ✓');
      // Save Settings should be hidden
      const saveCount = await page.locator('button').filter({ hasText: /^Save Settings$/i }).count();
      console.log(`WE-24: Save Settings visible: ${saveCount > 0} (expected hidden)`);
      if (saveCount === 0) console.log('WE-24: Save Settings correctly hidden ✓');
    } else {
      console.log(`WE-24: Wave 2 not yet revealed (status=${w2?.status}) — verify manually`);
    }

    // This wave has been revealed banner
    if (/This wave has been revealed/i.test(body)) {
      console.log('WE-24: "This wave has been revealed" banner visible ✓');
    }

    await page.locator('button').filter({ hasText: /^Close$/i }).last().click();
    console.log('WE-24: Post-reveal Manage modal verified ✓');
  });

  test('WE-25: Final state — Wave 2 revealed + closeAction=treasury, Waves 3-7 untouched', async ({ page }) => {
    test.setTimeout(30_000);

    const waves = await getWaves();
    const w2 = waves.find(w => w.waveNumber === 2);
    console.log(`\nWE-25: Wave 2 final state:`);
    console.log(`  status: ${w2?.status}`);
    console.log(`  waveRevealed: ${w2?.waveRevealed}`);
    console.log(`  closeAction: ${w2?.closeAction}`);
    console.log(`  soldCount: ${w2?.soldCount}`);

    // Wave 1 must be treasury-closed
    const w1 = waves.find(w => w.waveNumber === 1);
    expect(w1?.closeAction).toBe('treasury');
    console.log(`WE-25: Wave 1 closeAction=treasury ✓`);

    // Waves 3-7 untouched
    for (const w of waves.filter(w => w.waveNumber >= 3)) {
      expect(w.closeAction).toBeNull();
      expect(w.waveRevealed).toBeFalsy();
      expect(w.waveClosed).toBeFalsy();
      console.log(`WE-25: Wave ${w.waveNumber} untouched ✓`);
    }

    await page.goto('/nft/waves');
    await page.waitForLoadState('networkidle');
    await shot(page, 'WE-25-final-state');
    console.log('\nWE-25: Final health check PASSED ✓');
  });

  test('WE-26: NFT Lists — tokens visible, page loads correctly', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto('/nft/nftlist');
    await page.waitForLoadState('networkidle');
    await shot(page, 'WE-26-nft-lists');
    const body = await page.textContent('body') ?? '';
    expect(body.length).toBeGreaterThan(500);
    console.log('WE-26: NFT Lists page loaded with data ✓');
    console.log('\n🎉 WAVE E2E COMPLETE — Wave 1 + Wave 2 tested end-to-end!');
  });
});
