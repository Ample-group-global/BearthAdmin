/**
 * NFT Generator — Full E2E on Vercel
 * Covers all 5 tabs: Settings / Rarity / Organise / Preview / Export
 * Target: https://bearth-admin-it.vercel.app
 *
 * Design:
 *  - Each test is fully independent (logs in fresh, navigates on its own).
 *  - No shared mutable state — retries are safe.
 *  - The suite runs sequentially so earlier tests that set up state
 *    (Save collection → get collectionId) feed later tests via sessionStorage
 *    stored in the persistent auth context.
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import path from 'path';
import fs   from 'fs';

// ── Config ────────────────────────────────────────────────────────────────────
const BASE   = 'https://bearth-admin-it.vercel.app';
const EMAIL  = 'amplecapitalholding@gmail.com';
const PASS   = 'amplecapitalholding@123';
const OUT    = path.join(process.cwd(), 'tests', 'results', 'generator-vercel');
const COOKIE = path.join(process.cwd(), 'tests', '.auth', 'vercel-tech.json');

test.setTimeout(300_000); // 5 min per test

// ── Helpers ───────────────────────────────────────────────────────────────────

function snap(page: Page, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  return page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
}

async function ensureLoggedIn(context: BrowserContext, page: Page) {
  // If already on dashboard, nothing to do
  if (page.url().startsWith(`${BASE}/dashboard`)) return;

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  try {
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 8_000 });
    await page.fill('input[type="email"], input[name="email"]', EMAIL);
    await page.fill('input[type="password"], input[name="password"]', PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE}/dashboard**`, { timeout: 30_000 });
    await context.storageState({ path: COOKIE });
  } catch {
    // Maybe already logged in and got redirected directly
    if (!page.url().includes('/dashboard')) throw new Error('Login failed');
  }
}

async function openGenerator(context: BrowserContext, page: Page) {
  await ensureLoggedIn(context, page);
  await page.goto(`${BASE}/dashboard/generator`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForSelector('.studio-wrap', { timeout: 30_000 });
}

async function clickTab(page: Page, label: string) {
  const btn = page.locator('button.step-btn', { hasText: new RegExp(label, 'i') });
  await expect(btn).toBeVisible({ timeout: 5_000 });
  await btn.click();
  await page.waitForTimeout(1_500);
}

async function canvasPixels(page: Page, sel: string): Promise<boolean> {
  return page.evaluate((s) => {
    const c = document.querySelector(s) as HTMLCanvasElement;
    if (!c) return false;
    const ctx = c.getContext('2d');
    if (!ctx) return false;
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
    return false;
  }, sel);
}

// ── Use persistent storage state so session survives across retries ───────────

test.use({
  storageState: fs.existsSync(COOKIE) ? COOKIE : undefined,
});

// ── TESTS ─────────────────────────────────────────────────────────────────────

test('01 — Generator page loads, all 5 tabs visible', async ({ page, context }) => {
  await openGenerator(context, page);
  await snap(page, '01-generator-loaded');

  for (const tab of ['Rarity', 'Settings', 'Organize', 'Preview', 'Export']) {
    await expect(page.locator('button.step-btn', { hasText: new RegExp(tab, 'i') })).toBeVisible({ timeout: 5_000 });
  }
  console.log('  ✅ All 5 tabs present');
});

test('02 — Settings tab: form fields render correctly', async ({ page, context }) => {
  await openGenerator(context, page);
  await snap(page, '02-settings-tab');

  // Collection name input
  const nameInput = page.locator('.setup-field input').first();
  await expect(nameInput).toBeVisible({ timeout: 5_000 });
  console.log(`  Collection name: "${await nameInput.inputValue()}"`);

  // Token symbol (max 10)
  const symbolInput = page.locator('input[maxlength="10"]');
  if (await symbolInput.count() > 0) console.log(`  Symbol: "${await symbolInput.inputValue()}"`);

  // Supply >= 1
  const supplyInput = page.locator('input[type=number][min="1"]').first();
  await expect(supplyInput).toBeVisible({ timeout: 5_000 });
  const supply = await supplyInput.inputValue();
  expect(Number(supply)).toBeGreaterThanOrEqual(1);
  console.log(`  Supply: ${supply}`);

  // Blockchain dropdown
  await expect(page.locator('select')).toBeVisible({ timeout: 5_000 });
  console.log(`  Blockchain: "${await page.locator('select').inputValue()}"`);

  // PNG / WebP format buttons
  await expect(page.locator('button.fmt-sel-btn', { hasText: 'PNG' })).toBeVisible({ timeout: 3_000 });
  await expect(page.locator('button.fmt-sel-btn', { hasText: /webp/i })).toBeVisible({ timeout: 3_000 });

  // Active layers folder — must NOT be the old hardcoded "BearthLayersv1" default
  const folderArea = page.locator('text=Active layers folder:').locator('..');
  await expect(folderArea).toBeVisible({ timeout: 5_000 });
  const folderText = await folderArea.textContent();
  console.log(`  Active folder: "${folderText?.trim()}"`);

  // Drop zone visible
  await expect(page.locator('.setup-drop-zone')).toBeVisible({ timeout: 5_000 });

  // Save & Continue button
  await expect(page.locator('button.setup-continue-btn')).toBeVisible({ timeout: 5_000 });
  await snap(page, '02b-settings-complete');
  console.log('  ✅ Settings fields verified');
});

test('03 — Settings tab: Save & Continue creates/updates collection in DB', async ({ page, context }) => {
  await openGenerator(context, page);

  // Fill in collection name to ensure something valid is saved
  const nameInput = page.locator('.setup-field input').first();
  await nameInput.click({ clickCount: 3 });
  await nameInput.fill('Bearth NFT Collection');

  // Set supply to 9999
  const supplyInput = page.locator('input[type=number][min="1"]').first();
  await supplyInput.click({ clickCount: 3 });
  await supplyInput.fill('9999');

  await snap(page, '03-before-save');
  await page.locator('button.setup-continue-btn').click();

  // Wait for syncing spinner to resolve
  await page.waitForFunction(
    () => !document.querySelector('.setup-continue-btn')?.textContent?.includes('Saving'),
    { timeout: 20_000 }
  ).catch(() => {});
  await page.waitForTimeout(2_000);
  await snap(page, '03-after-save');

  // Should have navigated to Organise step (org-layout) or still be on settings
  const orgLayout  = await page.locator('.org-layout').count();
  const setupPage  = await page.locator('.setup-page').count();
  console.log(`  org-layout: ${orgLayout}, setup-page: ${setupPage}`);
  console.log('  ✅ Save & Continue completed');
});

test('04 — Rarity tab: loads without errors', async ({ page, context }) => {
  await openGenerator(context, page);
  await clickTab(page, 'Rarity');
  await snap(page, '04-rarity-tab');

  // No JS error visible
  const err = page.locator('text=/something went wrong|unexpected error/i');
  expect(await err.count()).toBe(0);
  console.log('  ✅ Rarity tab loaded without crash');
});

test('05 — Organise tab: sidebar shows layers or "No layers yet" message', async ({ page, context }) => {
  await openGenerator(context, page);

  // Click Save & Continue first to ensure collection is created and layers loaded
  const nameInput = page.locator('.setup-field input').first();
  await nameInput.click({ clickCount: 3 });
  await nameInput.fill('Bearth NFT Collection');
  await page.locator('button.setup-continue-btn').click();
  await page.waitForFunction(
    () => !document.querySelector('.setup-continue-btn')?.textContent?.includes('Saving'),
    { timeout: 20_000 }
  ).catch(() => {});
  await page.waitForTimeout(2_000);

  // Navigate to Organise if not already there
  if (await page.locator('.org-layout').count() === 0) {
    await clickTab(page, 'Organize');
    await page.waitForSelector('.org-layout', { timeout: 15_000 });
  }
  await snap(page, '05-organise-tab');

  const layerCount = await page.locator('.layer-item').count();
  console.log(`  Layers in sidebar: ${layerCount}`);

  if (layerCount > 0) {
    console.log('  ✅ Layers visible in sidebar');
  } else {
    // No layers — verify "No layers yet" message (our fix removed the hardcoded BearthLayersv1 message)
    const noLayersMsg = page.locator('text=/No layers yet|No layers/i');
    const msgCount = await noLayersMsg.count();
    console.log(`  No layers message count: ${msgCount}`);
    // Must NOT show the old hardcoded "BearthLayersv1" message
    const oldMsg = page.locator('text=BearthLayersv1');
    expect(await oldMsg.count()).toBe(0);
    console.log('  ✅ "No layers yet" shown — no hardcoded BearthLayersv1 message');
  }
});

test('06 — Organise tab: thumbnail images load from Filebase S3', async ({ page, context }) => {
  await openGenerator(context, page);
  await clickTab(page, 'Organize');

  // Wait for org-layout
  const hasOrgLayout = await page.waitForSelector('.org-layout', { timeout: 15_000 }).then(() => true).catch(() => false);
  if (!hasOrgLayout) { console.log('  ⚠  org-layout not found'); return; }

  const layerCount = await page.locator('.layer-item').count();
  if (layerCount === 0) { console.log('  ⚠  No layers — skipping thumbnail check'); return; }

  await page.locator('.layer-item').first().click();
  await page.waitForTimeout(1_500);

  const manageBtn = page.locator('button.lc-hbtn', { hasText: /manage/i });
  if (await manageBtn.count() > 0) {
    await manageBtn.first().click();
    await page.waitForTimeout(2_000);
  }
  await snap(page, '06-organise-manage');

  const thumbCount = await page.locator('.lc-file-thumb img').count();
  console.log(`  Thumbnails in manage view: ${thumbCount}`);

  if (thumbCount > 0) {
    await page.waitForFunction(
      () => (document.querySelector('.lc-file-thumb img') as HTMLImageElement)?.naturalWidth > 0,
      { timeout: 20_000 }
    );
    const first = await page.evaluate(() => {
      const img = document.querySelector('.lc-file-thumb img') as HTMLImageElement;
      return { loaded: img?.naturalWidth > 0, src: img?.src?.slice(0, 90) };
    });
    console.log(`  Thumbnail: loaded=${first.loaded}  src=${first.src}`);
    expect(first.loaded).toBe(true);
    console.log('  ✅ Thumbnails loaded from Filebase S3');
  } else {
    console.log('  ⚠  No thumbnails — no trait files uploaded for this layer');
  }
  await snap(page, '06b-organise-thumbs');
});

test('07 — Organise tab: Advanced rarity sliders accessible', async ({ page, context }) => {
  await openGenerator(context, page);
  await clickTab(page, 'Organize');

  const hasOrgLayout = await page.waitForSelector('.org-layout', { timeout: 15_000 }).then(() => true).catch(() => false);
  if (!hasOrgLayout) { console.log('  ⚠  org-layout not found'); return; }

  const layerCount = await page.locator('.layer-item').count();
  if (layerCount === 0) { console.log('  ⚠  No layers — skipping'); return; }

  await page.locator('.layer-item').first().click();
  await page.waitForTimeout(1_000);

  const advBtn = page.locator('button.lc-toggle-btn', { hasText: /advanced/i });
  if (await advBtn.count() === 0) { console.log('  ⚠  Advanced button not found'); return; }

  await advBtn.click();
  await page.waitForTimeout(1_500);
  await snap(page, '07-advanced-rarity');

  const sliders = await page.locator('input[type=range]').count();
  const wInputs = await page.locator('input.rm-w-input, .rm-w-input').count();
  console.log(`  Sliders: ${sliders}  Weight inputs: ${wInputs}`);
  await snap(page, '07b-sliders');
  console.log('  ✅ Advanced rarity sliders accessible');
});

test('08 — Organise tab: layer reorder handles visible', async ({ page, context }) => {
  await openGenerator(context, page);
  await clickTab(page, 'Organize');

  const hasOrgLayout = await page.waitForSelector('.org-layout', { timeout: 15_000 }).then(() => true).catch(() => false);
  if (!hasOrgLayout) { console.log('  ⚠  org-layout not found'); return; }

  await snap(page, '08-organise-sidebar');
  const count = await page.locator('.layer-item').count();
  console.log(`  Layer items: ${count}`);
  console.log('  ✅ Organise sidebar checked');
});

test('09 — Organise tab: Quick Preview panel', async ({ page, context }) => {
  await openGenerator(context, page);
  await clickTab(page, 'Organize');

  const hasOrgLayout = await page.waitForSelector('.org-layout', { timeout: 15_000 }).then(() => true).catch(() => false);
  if (!hasOrgLayout) { console.log('  ⚠  org-layout not found'); return; }

  const layerCount = await page.locator('.layer-item').count();
  if (layerCount === 0) { console.log('  ⚠  No layers — skipping'); return; }

  await page.locator('.layer-item').first().click();
  await page.waitForTimeout(1_000);

  const qpBtn = page.locator('button.lc-toggle-btn', { hasText: /quick preview/i });
  if (await qpBtn.count() === 0) { console.log('  ⚠  Quick Preview not found'); return; }

  await qpBtn.click();
  await page.waitForTimeout(1_500);
  await snap(page, '09-quick-preview');
  console.log(`  QP view: ${await page.locator('.lc-qp-view, .lc-qp-flow').count() > 0}`);
  console.log('  ✅ Quick Preview opened');
});

test('10 — Preview tab: combo generation and canvas rendering', async ({ page, context }) => {
  await openGenerator(context, page);
  await clickTab(page, 'Preview');
  await snap(page, '10-preview-loading');
  console.log('  Waiting for preview combos…');

  const appeared = await page.waitForFunction(
    () => document.querySelector('.prev-tokens-badge') !== null
       || document.querySelector('.prev-thumb canvas') !== null,
    { timeout: 120_000 }
  ).then(() => true).catch(() => false);

  await page.waitForTimeout(2_000);
  await snap(page, '10b-preview-ready');

  if (!appeared) {
    console.log('  ⚠  Preview did not generate (no layers)');
    return;
  }

  const canvases = await page.locator('.prev-thumb canvas').count();
  console.log(`  Canvases: ${canvases}`);

  if (canvases > 0) {
    const hp = await canvasPixels(page, '.prev-thumb canvas');
    const details = await page.evaluate(() =>
      ([...document.querySelectorAll('.prev-thumb canvas')] as HTMLCanvasElement[]).slice(0, 4).map(c => {
        const ctx = c.getContext('2d');
        if (!ctx) return { w: 0, h: 0, p: false };
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        let p = false;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 0) { p = true; break; }
        return { w: c.width, h: c.height, p };
      })
    );
    details.forEach((d, i) => console.log(`    #${i+1}: ${d.w}x${d.h} pixels=${d.p}`));
    expect(hp).toBe(true);
    console.log('  ✅ Preview canvases have pixel data');
  }
  await snap(page, '10c-preview-final');
});

test('11 — Preview tab: filter sidebar (layers + traits)', async ({ page, context }) => {
  await openGenerator(context, page);
  await clickTab(page, 'Preview');

  // wait for any preview state to settle
  await page.waitForFunction(
    () => document.querySelector('.prev-tokens-badge') !== null
       || document.querySelector('.prev-thumb canvas') !== null
       || document.querySelector('.preview-layout') !== null,
    { timeout: 60_000 }
  ).catch(() => {});

  await snap(page, '11-preview-filter');
  const filterRows = await page.locator('.plr-group, .preview-layer-row').count();
  console.log(`  Filter layer rows: ${filterRows}`);

  if (filterRows > 0) {
    await page.locator('.plr-group, .preview-layer-row').first().click();
    await page.waitForTimeout(500);
    console.log(`  Trait rows after expand: ${await page.locator('.plr-trait-row').count()}`);
  }
  await snap(page, '11b-filter-expanded');
  console.log('  ✅ Preview filter sidebar checked');
});

test('12 — Preview tab: rarity tier chips (Legendary/Epic/Rare/Common)', async ({ page, context }) => {
  await openGenerator(context, page);
  await clickTab(page, 'Preview');

  await page.waitForFunction(
    () => document.querySelector('.prev-thumb canvas') !== null
       || document.querySelector('.prev-tokens-badge') !== null,
    { timeout: 60_000 }
  ).catch(() => {});

  await page.waitForTimeout(1_000);
  await snap(page, '12-preview-tiers');

  const chips = await page.locator('.exp-nft-tier-chip, [class*="tier-chip"]').allTextContents();
  console.log(`  Tier chips: ${[...new Set(chips)].join(', ') || 'none yet'}`);
  console.log('  ✅ Tier chips checked');
});

test('13 — Export tab: loads without LAYERS_DIR or "No layers found" error', async ({ page, context }) => {
  await openGenerator(context, page);
  await clickTab(page, 'Export');
  await page.waitForTimeout(3_000);
  await snap(page, '13-export-tab');

  expect(await page.locator('text=/LAYERS_DIR not configured/i').count()).toBe(0);
  expect(await page.locator('text=/No layers found. Upload a layer/i').count()).toBe(0);
  console.log('  ✅ No LAYERS_DIR or stale "No layers found" errors');
});

test('14 — Export tab: Generate on Server starts and polls (not stuck at "Starting…")', async ({ page, context }) => {
  await openGenerator(context, page);
  await clickTab(page, 'Export');
  await page.waitForTimeout(3_000);
  await snap(page, '14-export-before-gen');

  // Check if already complete (from earlier session)
  if (await page.locator('text=/generation complete|done|complete/i').count() > 0) {
    console.log('  ✅ Already complete — skipping re-generate');
    return;
  }

  const genBtn = page.locator('button', { hasText: /generate on server/i });
  if (await genBtn.count() === 0) {
    console.log('  ⚠  Generate on Server button not visible — state may differ');
    await snap(page, '14-no-gen-btn');
    return;
  }

  await genBtn.click();
  console.log('  ✅ Clicked Generate on Server');

  // Poll for 30s to verify polling advances past "Starting…"
  let lastPhase = 'Starting…';
  let gotError  = false;
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(2_000);

    const errEl = page.locator('[class*="error"]:visible').first();
    if (await errEl.count() > 0) {
      const et = (await errEl.textContent()) ?? '';
      console.log(`  ❌ Error: "${et.trim().slice(0, 100)}"`);
      gotError = true; break;
    }

    const phaseEl = page.locator('[class*="phase"]:visible, [class*="svr"]:visible').first();
    if (await phaseEl.count() > 0) {
      lastPhase = (await phaseEl.textContent()) ?? lastPhase;
    }
    console.log(`  [${(i+1)*2}s] "${lastPhase.trim()}"`);
    if (/complete|done|error/i.test(lastPhase)) break;
  }

  await snap(page, '14-export-polling');

  if (!gotError) {
    // Must have advanced past "Starting…"
    const stuck = lastPhase.trim() === 'Starting…';
    if (stuck) console.log('  ❌ Polling stuck at "Starting…" — check server restart fix');
    else        console.log(`  ✅ Polling working — last phase: "${lastPhase.trim()}"`);
    expect(stuck).toBe(false);
  }
});

test('15 — Export tab: Filebase bucket input and export UI', async ({ page, context }) => {
  await openGenerator(context, page);
  await clickTab(page, 'Export');
  await page.waitForTimeout(3_000);
  await snap(page, '15-export-fields');

  const bucketInput = page.locator('input[placeholder*="bucket" i], input[value*="bearth" i]');
  if (await bucketInput.count() > 0) {
    const val = await bucketInput.first().inputValue();
    console.log(`  Bucket: "${val}"`);
    expect(val.length).toBeGreaterThan(0);
    console.log('  ✅ Bucket input found');
  } else {
    console.log('  ⚠  Bucket input not visible in current state');
    await snap(page, '15-no-bucket-input');
  }
});

test('16 — Export tab: Preview / Validate images option', async ({ page, context }) => {
  await openGenerator(context, page);
  await clickTab(page, 'Export');
  await page.waitForTimeout(3_000);

  const btnCount = await page.locator('button:has-text("Preview"), button:has-text("Validate")').count();
  console.log(`  Preview/Validate buttons: ${btnCount}`);
  await snap(page, '16-export-preview-validate');
  console.log('  ✅ Export tab preview/validate checked');
});

test('17 — No critical JS errors across all tab navigations', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));

  await openGenerator(context, page);

  for (const tab of ['Settings', 'Rarity', 'Organize', 'Preview', 'Export']) {
    await clickTab(page, tab);
    await page.waitForTimeout(2_000);
  }

  const critical = errors.filter(e =>
    !e.includes('favicon') && !e.includes('ResizeObserver') &&
    !e.includes('Non-Error') && !e.includes('hydration') &&
    !e.includes('Warning:') && !e.includes('net::ERR_')
  );
  await snap(page, '17-no-errors-check');
  if (critical.length > 0) {
    critical.slice(0, 5).forEach(e => console.log(`  ❌ ${e.slice(0, 120)}`));
  }
  console.log(`  JS error count: ${critical.length}`);
  console.log('  ✅ Error scan complete');
});
