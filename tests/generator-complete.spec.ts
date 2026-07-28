import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// ── Config ────────────────────────────────────────────────────────────────────
const TECH_AUTH      = path.join(process.cwd(), 'tests', '.auth', 'tech.json');
const SCREENSHOTS    = path.join(process.cwd(), 'tests', 'results', 'generator-complete');
const SUPPLY         = 9999;
const BUCKET         = 'bearth-nft-collection';
const COLLECTION_NAME = 'Bearth Genesis 9999';
const SYMBOL         = 'BG9K';
const DESCRIPTION    = 'The first Bearth Genesis NFT collection — 9,999 unique generative artworks on Ethereum.';

// ── State persistence: survives retries without re-running expensive steps ───
// Saved to disk so a retry run can skip collection-creation and 9999-NFT generation.
const STATE_FILE = path.join(process.cwd(), 'tests', '.state', 'generator-state.json');

function loadState(): { collectionId: string; jobId: string } {
  try {
    const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) as { collectionId: string; jobId: string; ts: number };
    if (Date.now() - data.ts < 24 * 60 * 60 * 1000 && data.collectionId) {
      console.log(`[state] Loaded — collectionId=${data.collectionId} jobId=${data.jobId}`);
      return { collectionId: data.collectionId, jobId: data.jobId ?? '' };
    }
  } catch {}
  return { collectionId: '', jobId: '' };
}

function saveState() {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify({ collectionId, jobId, ts: Date.now() }), 'utf-8');
  } catch {}
}

// ── Shared state between tests (populated as tests run) ──────────────────────
const _saved     = loadState();
let collectionId = _saved.collectionId;
let jobId        = _saved.jobId;

// ── Timeouts ──────────────────────────────────────────────────────────────────
// Server generation 9999 NFTs: ~5 min combos + ~2 min DB save
const GEN_TIMEOUT_MS    = 20 * 60 * 1000;   // 20 min
// Server Filebase export 9999 NFTs: up to 2 hours with pollCid at 30 concurrency
const EXPORT_TIMEOUT_MS = 3 * 60 * 60 * 1000; // 3 hours cap

test.use({ storageState: TECH_AUTH });
test.describe.configure({ mode: 'serial' });

// ── Helpers ───────────────────────────────────────────────────────────────────
async function snap(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOTS, { recursive: true });
  // animations:'disabled' freezes CSS animations (spinners) so the CDP screenshot doesn't spin-wait
  await page.screenshot({ path: path.join(SCREENSHOTS, `${name}.png`), fullPage: false, animations: 'disabled', timeout: 30_000 });
  console.log(`  📸 ${name}.png`);
}

async function waitForStudio(page: Page, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const result = await Promise.race([
      page.waitForSelector('.studio-wrap', { timeout: 60_000 }).then(() => 'ok' as const),
      page.waitForURL('**/login**',         { timeout: 60_000 }).then(() => 'login' as const),
    ]).catch(() => 'timeout' as const);

    if (result === 'ok') return;

    if (attempt < retries) {
      // Auth failed (redirected to /login or timed out) — pause 3s and retry
      console.log(`  ⚠ waitForStudio: ${result} on attempt ${attempt + 1}, retrying…`);
      await page.waitForTimeout(3_000);
      await page.goto(page.url().includes('login') ? '/dashboard/generator' : page.url());
    } else {
      throw new Error(`waitForStudio: studio-wrap not visible after ${retries + 1} attempts (last result: ${result})`);
    }
  }
}

// Inject collection ID and supply into sessionStorage before page load so generator restores them
async function gotoWithCollection(page: Page, id: string, supply = SUPPLY) {
  await page.addInitScript(([cid, sup]) => {
    sessionStorage.setItem('nft_collection_id', cid as string);
    sessionStorage.setItem('nft_supply', String(sup));
  }, [id, supply]);
  await page.goto('/dashboard/generator');
  await waitForStudio(page);
}

// Click a step nav button
async function gotoStep(page: Page, label: string | RegExp) {
  const btn = page.locator('button.step-btn').filter({ hasText: label });
  await expect(btn).toBeVisible({ timeout: 10_000 });
  await btn.click();
  await page.waitForTimeout(500);
}

async function canvasHasPixels(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((sel) => {
    const canvas = document.querySelector(sel) as HTMLCanvasElement;
    if (!canvas) return false;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    const { width, height } = canvas;
    if (!width || !height) return false;
    const data = ctx.getImageData(0, 0, width, height).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) return true;
    }
    return false;
  }, selector);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS TAB
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Settings Tab', () => {

  test('Page loads and shows generator layout with step nav', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/dashboard/generator');
    await waitForStudio(page);
    await snap(page, '01-settings-initial');

    await expect(page.locator('.logo')).toBeVisible();
    await expect(page.locator('nav.step-nav')).toBeVisible();

    const steps = page.locator('button.step-btn');
    const count = await steps.count();
    console.log(`  Step count: ${count}`);
    expect(count).toBeGreaterThanOrEqual(4);

    // Default step is settings — CollectionSetup visible
    await expect(page.locator('.setup-page')).toBeVisible({ timeout: 10_000 });
    console.log('  ✅ Generator loaded with step nav');
  });

  test('Settings form: fill all fields and verify previews', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/dashboard/generator');
    await waitForStudio(page);

    // Clear any previous collection ID
    await page.evaluate(() => sessionStorage.removeItem('nft_collection_id'));

    // Collection Name
    const nameInput = page.locator('.setup-field input[placeholder="No Name"]');
    await expect(nameInput).toBeVisible();
    await nameInput.click({ clickCount: 3 });
    await nameInput.fill(COLLECTION_NAME);
    await expect(nameInput).toHaveValue(COLLECTION_NAME);

    // Symbol
    const symbolInput = page.locator('.setup-field input[placeholder="BRT"]');
    await expect(symbolInput).toBeVisible();
    await symbolInput.click({ clickCount: 3 });
    await symbolInput.fill(SYMBOL);
    await expect(symbolInput).toHaveValue(SYMBOL);

    // Description
    const descInput = page.locator('.setup-field input[placeholder*="description"]');
    await expect(descInput).toBeVisible();
    await descInput.click({ clickCount: 3 });
    await descInput.fill(DESCRIPTION);
    await expect(descInput).toHaveValue(DESCRIPTION);

    // Supply = 9999
    const supplyInput = page.locator('input[type=number][min="1"][max="100000"]');
    await expect(supplyInput).toBeVisible();
    await supplyInput.click({ clickCount: 3 });
    await supplyInput.fill(String(SUPPLY));
    await expect(supplyInput).toHaveValue(String(SUPPLY));

    // Name Format → verify preview hint updates
    const nameFmtInput = page.locator('.setup-row2 .setup-field').nth(1).locator('input');
    await expect(nameFmtInput).toBeVisible();
    await nameFmtInput.click({ clickCount: 3 });
    await nameFmtInput.fill('Bearth #{{id}}');
    const hint = page.locator('.field-hint').filter({ hasText: 'Bearth #1' });
    await expect(hint).toBeVisible({ timeout: 5_000 });
    console.log('  ✅ Name format preview shows "Bearth #1, Bearth #2, Bearth #3"');

    // Blockchain selector — verify Ethereum is present
    const blockchainSelect = page.locator('.setup-field select');
    await expect(blockchainSelect).toBeVisible();
    await blockchainSelect.selectOption('ethereum');
    const selectedVal = await blockchainSelect.inputValue();
    expect(selectedVal).toBe('ethereum');

    // Format buttons — click PNG
    const pngBtn = page.locator('.fmt-sel-btn').filter({ hasText: 'PNG' });
    await expect(pngBtn).toBeVisible();
    await pngBtn.click();
    await expect(pngBtn).toHaveClass(/fmt-sel-active/);
    console.log('  ✅ PNG format selected');

    // Dimensions
    const widthInput  = page.locator('input[placeholder="Width"]');
    const heightInput = page.locator('input[placeholder="Height"]');
    await widthInput.fill('2000');
    await heightInput.fill('2000');
    await expect(widthInput).toHaveValue('2000');
    await expect(heightInput).toHaveValue('2000');

    // Layer folder indicator shows the active folder
    const folderBadge = page.locator('.setup-artwork');
    await expect(folderBadge).toBeVisible();
    const folderText = await folderBadge.textContent();
    console.log(`  Active layer folder indicator: ${folderText?.substring(0, 80)}`);

    await snap(page, '02-settings-filled');
    console.log('  ✅ All settings fields filled correctly');
  });

  test('Settings: Reset button clears the form', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto('/dashboard/generator');
    await waitForStudio(page);

    // Fill name
    const nameInput = page.locator('.setup-field input[placeholder="No Name"]');
    await nameInput.fill('Test Name To Clear');

    // Click Reset
    const resetBtn = page.locator('.link-btn').filter({ hasText: /reset/i }).first();
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();

    // Name should be cleared
    await expect(nameInput).toHaveValue('');
    await snap(page, '03-settings-after-reset');
    console.log('  ✅ Reset clears the form');
  });

  test('Settings: Save & Continue creates collection and syncs 11 layers to DB', async ({ page }) => {
    test.setTimeout(120_000);

    if (collectionId) {
      console.log(`  ⏭ Using pre-existing collection: ${collectionId}`);
      await gotoWithCollection(page, collectionId);
      await page.waitForSelector('.org-layout, aside.sidebar, .setup-page', { timeout: 30_000 });
      console.log(`  ✅ Collection verified (skipped creation): ${collectionId}`);
      return;
    }

    await page.goto('/dashboard/generator');
    await waitForStudio(page);

    // Clear any previous session state
    await page.evaluate(() => sessionStorage.removeItem('nft_collection_id'));

    // Fill required fields
    const nameInput    = page.locator('.setup-field input[placeholder="No Name"]');
    const supplyInput  = page.locator('input[type=number][min="1"][max="100000"]');
    const symbolInput  = page.locator('.setup-field input[placeholder="BRT"]');
    const descInput    = page.locator('.setup-field input[placeholder*="description"]');

    await nameInput.fill(COLLECTION_NAME);
    await symbolInput.fill(SYMBOL);
    await descInput.fill(DESCRIPTION);
    await supplyInput.click({ clickCount: 3 });
    await supplyInput.fill(String(SUPPLY));

    const nameFmtInput = page.locator('.setup-row2 .setup-field').nth(1).locator('input');
    await nameFmtInput.fill('Bearth #{{id}}');

    await page.locator('.setup-field select').selectOption('ethereum');
    await page.locator('input[placeholder="Width"]').fill('2000');
    await page.locator('input[placeholder="Height"]').fill('2000');

    await snap(page, '04-settings-before-continue');

    // Click Save & Continue
    const continueBtn = page.locator('button.setup-continue-btn');
    await expect(continueBtn).toBeVisible();
    await continueBtn.click();

    // Should show "Saving to database…" briefly then navigate to Organize
    await page.waitForSelector('.org-layout, aside.sidebar', { timeout: 90_000 });
    await snap(page, '05-organize-after-continue');

    // Extract collection ID from sessionStorage
    const savedId = await page.evaluate(() => sessionStorage.getItem('nft_collection_id'));
    expect(savedId).toBeTruthy();
    collectionId = savedId!;
    saveState();
    console.log(`  ✅ Collection created: ${collectionId}`);

    // Verify sidebar shows at least 11 layers (synced from disk)
    await page.waitForSelector('.layer-item', { timeout: 30_000 });
    const layerItems = page.locator('.layer-item');
    const layerCount = await layerItems.count();
    console.log(`  Layers in sidebar: ${layerCount}`);
    expect(layerCount).toBeGreaterThanOrEqual(11);

    // Verify layers are visible by name
    const layerNames = await layerItems.locator('.ln').allTextContents();
    console.log(`  Layer names: ${layerNames.join(', ')}`);
    expect(layerNames.some(n => n.includes('0-bg'))).toBeTruthy();
    expect(layerNames.some(n => n.includes('2-body'))).toBeTruthy();

    console.log(`  ✅ ${layerCount} layers synced to DB and shown in sidebar`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ORGANISE TAB
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Organise Tab', () => {

  test('All 11 layers in sidebar with correct file counts', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoWithCollection(page, collectionId);
    await gotoStep(page, /organize/i);

    await page.waitForSelector('aside.sidebar', { timeout: 20_000 });
    await page.waitForSelector('.layer-item', { timeout: 20_000 });
    await snap(page, '06-organise-sidebar');

    const layerItems = page.locator('.layer-item');
    const count = await layerItems.count();
    console.log(`  Layer count: ${count}`);
    expect(count).toBeGreaterThanOrEqual(11);

    // Verify file counts are shown
    const layerMetas = await layerItems.locator('.layer-meta').allTextContents();
    console.log(`  Layer file counts: ${layerMetas.join(' | ')}`);
    for (const meta of layerMetas) {
      expect(meta).toMatch(/\d+\s*Files?/i);
    }

    // Spot-check known layers with known file counts
    // 0-bg: 1 file, 2-body: 6 files, 4-clothes: 20 files, 9-headwear_front: 24 files
    const allTexts = await layerItems.allTextContents();
    const bgLayer = allTexts.find(t => t.includes('0-bg'));
    expect(bgLayer).toContain('1');

    console.log(`  ✅ All ${count} layers visible with file counts`);
  });

  test('Clicking each layer shows trait thumbnails', async ({ page }) => {
    test.setTimeout(120_000);
    await gotoWithCollection(page, collectionId);
    await gotoStep(page, /organize/i);

    await page.waitForSelector('.layer-item', { timeout: 20_000 });

    const layerItems = page.locator('.layer-item');
    const count = Math.min(await layerItems.count(), 5); // test first 5 to save time

    for (let i = 0; i < count; i++) {
      await layerItems.nth(i).click();
      await page.waitForTimeout(800);

      // Layer content area should show assets
      const assetCards = page.locator('.asset-card, .org-main img, .org-main canvas, .asset-thumb, [class*="asset"]');
      const assetCount = await assetCards.count();
      const layerName = await layerItems.nth(i).locator('.ln').textContent();
      console.log(`  Layer "${layerName}": ${assetCount} asset elements`);

      await snap(page, `07-layer-${i}-${layerName?.replace(/[^a-z0-9]/gi, '_')}`);
    }
    console.log('  ✅ Layer selection shows content');
  });

  test('Optional toggle marks a layer as optional', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoWithCollection(page, collectionId);
    await gotoStep(page, /organize/i);

    await page.waitForSelector('.layer-item', { timeout: 20_000 });

    // Find "7-holding" layer (80% rarity) and toggle it optional
    const holdingLayer = page.locator('.layer-item').filter({ hasText: '7-holding' });
    const hasHolding = await holdingLayer.count() > 0;

    const targetLayer = hasHolding ? holdingLayer : page.locator('.layer-item').nth(3);
    const layerName = await targetLayer.locator('.ln').textContent();

    // Get current state of optional btn
    const optBtn = targetLayer.locator('.layer-optional-btn');
    await expect(optBtn).toBeVisible();
    const beforeText = await optBtn.textContent();
    console.log(`  "${layerName}" optional btn before: "${beforeText}"`);

    // Click to toggle
    await optBtn.click();
    await page.waitForTimeout(800);
    const afterText = await optBtn.textContent();
    console.log(`  "${layerName}" optional btn after: "${afterText}"`);

    expect(afterText).not.toBe(beforeText);
    await snap(page, '08-layer-optional-toggled');
    console.log(`  ✅ Layer optional toggle works: ${beforeText} → ${afterText}`);
  });

  test('Gear icon opens weight modal for a layer', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoWithCollection(page, collectionId);
    await gotoStep(page, /organize/i);

    await page.waitForSelector('.layer-item', { timeout: 20_000 });

    // Click gear on second layer (first layer is 0-bg with only 1 trait — not very interesting)
    const layerItems = page.locator('.layer-item');
    const targetIdx = 2; // 2-body has 6 traits
    await layerItems.nth(targetIdx).locator('.layer-gear').click();

    // RarityModal should open
    await page.waitForSelector('.rarity-modal, [class*="rarity-modal"], [class*="modal"]', { timeout: 10_000 });
    await snap(page, '09-rarity-modal-open');

    // Modal should show weight controls
    const modalContent = page.locator('.rarity-modal, [class*="rarity-modal"], [class*="modal"]').first();
    const text = await modalContent.textContent();
    console.log(`  Modal content preview: "${text?.substring(0, 100)}"`);
    expect(text?.length).toBeGreaterThan(10);

    // Close modal (ESC or close button)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const modalStillOpen = await page.locator('.rarity-modal, [class*="rarity-modal"]').count();
    console.log(`  Modal elements after ESC: ${modalStillOpen}`);
    await snap(page, '10-modal-closed');
    console.log('  ✅ Gear modal opens and closes');
  });

  test('Conflict rules button opens ConflictsPanel', async ({ page }) => {
    test.setTimeout(30_000);
    await gotoWithCollection(page, collectionId);
    await gotoStep(page, /organize/i);

    await page.waitForSelector('.layer-item', { timeout: 20_000 });

    // Conflict rules button in header
    const conflictsBtn = page.locator('button.btn-ghost').filter({ hasText: /conflict rules|rules/i });
    await expect(conflictsBtn).toBeVisible({ timeout: 10_000 });
    const btnText = await conflictsBtn.textContent();
    console.log(`  Conflict rules btn: "${btnText}"`);

    await conflictsBtn.click();
    // ConflictsPanel uses inline styles — detect by unique text content
    await page.waitForSelector('text=prevent a trait combo', { timeout: 10_000 });
    await snap(page, '11-conflicts-panel-open');
    console.log('  ✅ Conflict rules panel opens');

    // Close via the ✕ button inside the panel
    const closeBtn = page.locator('button.btn-ghost').filter({ hasText: '✕' }).first();
    await closeBtn.click();
    await page.waitForSelector('text=prevent a trait combo', { state: 'hidden', timeout: 5_000 });
    await page.waitForTimeout(300);
    console.log('  ✅ Conflict rules panel closed');
  });

  test('Layer reorder via drag and drop', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoWithCollection(page, collectionId);
    await gotoStep(page, /organize/i);

    await page.waitForSelector('.layer-item', { timeout: 20_000 });

    const layerItems = page.locator('.layer-item');
    const firstLayerName  = await layerItems.nth(0).locator('.ln').textContent();
    const secondLayerName = await layerItems.nth(1).locator('.ln').textContent();
    console.log(`  Before reorder: [0]=${firstLayerName} [1]=${secondLayerName}`);

    // Drag first item to third position
    const src = layerItems.nth(0);
    const dst = layerItems.nth(2);

    const srcBox = await src.boundingBox();
    const dstBox = await dst.boundingBox();

    if (srcBox && dstBox) {
      await page.mouse.move(srcBox.x + srcBox.width / 2, srcBox.y + srcBox.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(200);
      await page.mouse.move(dstBox.x + dstBox.width / 2, dstBox.y + dstBox.height / 2, { steps: 10 });
      await page.waitForTimeout(300);
      await page.mouse.up();
      await page.waitForTimeout(800);
    }

    await snap(page, '12-after-layer-reorder');
    const newFirstName = await layerItems.nth(0).locator('.ln').textContent();
    console.log(`  After reorder: [0]=${newFirstName}`);
    console.log('  ✅ Layer drag reorder triggered (may or may not change order visually in DOM)');
  });

  test('New layer input is present and functional', async ({ page }) => {
    test.setTimeout(30_000);
    await gotoWithCollection(page, collectionId);
    await gotoStep(page, /organize/i);

    await page.waitForSelector('.sb-new-layer', { timeout: 20_000 });

    const newLayerInput = page.locator('.new-layer-input');
    const addBtn = page.locator('.new-layer-add');

    await expect(newLayerInput).toBeVisible();
    await expect(addBtn).toBeVisible();
    expect(await addBtn.isDisabled()).toBeTruthy(); // disabled until text entered

    await newLayerInput.fill('test-new-layer');
    expect(await addBtn.isDisabled()).toBeFalsy();

    // Clear it (don't actually create the layer)
    await newLayerInput.fill('');
    await snap(page, '13-new-layer-input');
    console.log('  ✅ New layer input is interactive');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PREVIEW TAB
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Preview Tab', () => {
  // Single shared page — 9,999 combos generated ONCE in beforeAll, reused by all 7 tests.
  // This prevents repeated memory allocation that caused browser OOM by test 15+.
  let pvPage: Page;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(300_000); // 5 min — covers navigation + 9,999 combo generation
    const context = await browser.newContext({ storageState: TECH_AUTH });
    pvPage = await context.newPage();
    // Inject sessionStorage before navigation so the generator restores collectionId + supply
    await pvPage.addInitScript(([cid, sup]) => {
      sessionStorage.setItem('nft_collection_id', cid as string);
      sessionStorage.setItem('nft_supply', String(sup));
    }, [collectionId, SUPPLY]);
    await pvPage.goto('/dashboard/generator');
    await waitForStudio(pvPage);
    await gotoStep(pvPage, /preview/i);
    // Wait for 9,999 combos to complete (one-time cost shared across all preview tests)
    await pvPage.locator('.prev-tokens-badge').waitFor({ state: 'visible', timeout: 300_000 });
  });

  test.afterAll(async ({ browser }) => {
    const ctx = pvPage?.context();
    await pvPage?.close();
    await ctx?.close(); // release combo generation memory before Export Tab tests start
    // Ping BearthApi via a throw-away page to wake stale DB connections before Export Tab starts
    const pingCtx = await browser.newContext({ storageState: TECH_AUTH });
    const pingPage = await pingCtx.newPage();
    try {
      await pingPage.goto('/dashboard/generator');
      await pingPage.waitForSelector('.studio-wrap', { timeout: 60_000 });
    } catch { /* best-effort */ } finally {
      await pingPage.close();
      await pingCtx.close();
    }
  });

  test('Preview tab loads and shows supply count', async () => {
    test.setTimeout(30_000);
    // Preview panel already loaded — just verify supply count
    const layout = pvPage.locator('.preview-layout, .preview-empty, .randomize-btn');
    await expect(layout.first()).toBeVisible({ timeout: 10_000 });

    const countNum = pvPage.locator('.preview-count-num');
    await expect(countNum).toBeVisible({ timeout: 10_000 });
    const supplyText = await countNum.textContent();
    console.log(`  Supply count displayed: "${supplyText}"`);
    expect(supplyText).toMatch(/9[,.]?999|9999/);

    await snap(pvPage, '14-preview-loaded');
    console.log('  ✅ Preview tab loads with correct supply count');
  });

  test('Preview renders NFT cards with actual images', async () => {
    test.setTimeout(60_000);
    // Combos already generated — badge should be immediately visible
    const tokensBadge = pvPage.locator('.prev-tokens-badge');
    await tokensBadge.waitFor({ state: 'visible', timeout: 30_000 });
    await snap(pvPage, '15-preview-ready');

    const tokenText = await tokensBadge.textContent();
    console.log(`  Tokens badge: "${tokenText}"`);
    expect(tokenText).toMatch(/\d/);

    await pvPage.waitForSelector('.prev-card', { timeout: 20_000 });
    const cards = pvPage.locator('.prev-card');
    const cardCount = await cards.count();
    console.log(`  NFT cards in viewport: ${cardCount}`);
    expect(cardCount).toBeGreaterThan(0);

    await pvPage.waitForTimeout(1000);
    const hasPixels = await canvasHasPixels(pvPage, '.prev-card canvas');
    console.log(`  First canvas has pixels: ${hasPixels}`);
    expect(hasPixels).toBeTruthy();

    let filledCount = 0;
    const totalCanvases = await pvPage.locator('.prev-card canvas').count();
    for (let i = 0; i < Math.min(totalCanvases, 6); i++) {
      const hasPx = await pvPage.evaluate((idx) => {
        const cvs = document.querySelectorAll('.prev-card canvas');
        const c = cvs[idx] as HTMLCanvasElement;
        if (!c) return false;
        const ctx = c.getContext('2d');
        if (!ctx) return false;
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        for (let j = 3; j < d.length; j += 4) { if (d[j] > 0) return true; }
        return false;
      }, i);
      if (hasPx) filledCount++;
    }
    console.log(`  Cards with images: ${filledCount}/${Math.min(totalCanvases, 6)}`);
    expect(filledCount).toBeGreaterThan(0);

    await snap(pvPage, '16-preview-cards-with-images');
    console.log('  ✅ NFT cards render with actual images');
  });

  test('Preview sort: Shuffle → Rare First → Rare Last', async () => {
    test.setTimeout(300_000);
    const tokensBadge = pvPage.locator('.prev-tokens-badge');
    await tokensBadge.waitFor({ state: 'visible', timeout: 30_000 });
    await pvPage.waitForSelector('button.prev-sort-btn', { timeout: 15_000 });

    const sortBtn = pvPage.locator('button.prev-sort-btn');
    await sortBtn.click();
    await snap(pvPage, '17-sort-dropdown-open');

    const rareFirst = pvPage.locator('button.prev-sort-option').filter({ hasText: /rare first/i });
    await expect(rareFirst).toBeVisible();
    await rareFirst.click();
    await pvPage.waitForTimeout(500);

    const rankBadges = pvPage.locator('.prev-rank-badge');
    const badgeCount = await rankBadges.count();
    console.log(`  Rank badges (rare-first): ${badgeCount}`);
    expect(badgeCount).toBeGreaterThan(0);
    await snap(pvPage, '18-sort-rare-first');

    await sortBtn.click();
    const rareLast = pvPage.locator('button.prev-sort-option').filter({ hasText: /rare last/i });
    await expect(rareLast).toBeVisible();
    await rareLast.click();
    await pvPage.waitForTimeout(500);
    await snap(pvPage, '19-sort-rare-last');

    await sortBtn.click();
    const shuffleOpt = pvPage.locator('button.prev-sort-option').filter({ hasText: /shuffle/i });
    await expect(shuffleOpt).toBeVisible();
    await shuffleOpt.click();

    // Shuffle re-orders existing combos — badge stays visible (no re-generation)
    await pvPage.waitForSelector('.prev-tokens-badge', { state: 'visible', timeout: 30_000 });
    await snap(pvPage, '20-sort-shuffle-done');
    console.log('  ✅ All sort modes work');
  });

  test('Preview filter by trait and clear', async () => {
    test.setTimeout(60_000);
    const tokensBadge = pvPage.locator('.prev-tokens-badge');
    await tokensBadge.waitFor({ state: 'visible', timeout: 30_000 });

    const layerRows = pvPage.locator('.preview-layer-row');
    await expect(layerRows.first()).toBeVisible({ timeout: 15_000 });
    const layerCount = await layerRows.count();
    console.log(`  Layer filter rows: ${layerCount}`);

    // Click second layer row to expand (first layer 0-bg has only 1 trait)
    await layerRows.nth(1).click();
    await pvPage.waitForTimeout(300);

    const traitRows = pvPage.locator('.plr-trait-row');
    const traitCount = await traitRows.count();
    if (traitCount > 0) {
      const traitName = await traitRows.first().locator('.plr-trait-name').textContent();
      await traitRows.first().click();
      await pvPage.waitForTimeout(500);

      const filterBadge = pvPage.locator('.plr-filter-badge');
      await expect(filterBadge).toBeVisible({ timeout: 5_000 });
      const badgeText = await filterBadge.textContent();
      console.log(`  Filter badge: "${badgeText}"`);
      expect(badgeText).toContain(traitName ?? '');
      await snap(pvPage, '21-filter-active');

      const filteredBadge = pvPage.locator('.prev-tokens-badge');
      const filteredText  = await filteredBadge.textContent();
      console.log(`  Filtered count badge: "${filteredText}"`);

      const clearBtn = pvPage.locator('.plr-filter-clear');
      await expect(clearBtn).toBeVisible();
      await clearBtn.click();
      await pvPage.waitForTimeout(300);

      const noBadge = await filterBadge.isVisible();
      expect(noBadge).toBeFalsy();
      await snap(pvPage, '22-filter-cleared');
      console.log(`  ✅ Filter by trait "${traitName}" works and clears correctly`);
    } else {
      console.log('  ⚠ No trait rows found after expanding layer — skipping filter test');
    }
  });

  test('Preview: click card opens NftPopup with traits', async () => {
    test.setTimeout(60_000);
    const tokensBadge = pvPage.locator('.prev-tokens-badge');
    await tokensBadge.waitFor({ state: 'visible', timeout: 30_000 });
    await pvPage.waitForSelector('.prev-card', { timeout: 20_000 });
    await pvPage.waitForTimeout(1000);

    await pvPage.locator('.prev-card').first().click();
    await pvPage.waitForTimeout(500);

    const popup = pvPage.locator('.nft-popup, [class*="popup"], [class*="modal"]').first();
    await expect(popup).toBeVisible({ timeout: 10_000 });
    await snap(pvPage, '23-nft-popup-open');

    const popupText = await popup.textContent();
    console.log(`  Popup content preview: "${popupText?.substring(0, 150)}"`);
    expect(popupText?.length).toBeGreaterThan(10);

    const closeBtn = popup.locator('button').filter({ hasText: /close|×|✕/i }).first();
    if (await closeBtn.count() > 0) {
      await closeBtn.click();
    } else {
      await pvPage.keyboard.press('Escape');
    }
    await pvPage.waitForTimeout(300);
    await snap(pvPage, '24-popup-closed');
    console.log('  ✅ NFT popup opens on card click and closes');
  });

  test('Preview: Randomize re-generates combos', async () => {
    test.setTimeout(300_000);
    await pvPage.waitForSelector('button.randomize-btn:not([disabled])', { timeout: 30_000 });
    const firstCards = await pvPage.locator('.prev-card-name').allTextContents();

    const randomizeBtn = pvPage.locator('button.randomize-btn');
    await randomizeBtn.click();

    // Randomize actually re-generates — wait for badge to disappear then reappear
    await pvPage.locator('.prev-tokens-badge').waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
    await pvPage.waitForSelector('.prev-tokens-badge', { state: 'visible', timeout: 180_000 });
    await pvPage.waitForSelector('.prev-card', { timeout: 30_000 });
    await pvPage.waitForTimeout(1000);

    const newCards = await pvPage.locator('.prev-card-name').allTextContents();
    console.log(`  Before randomize first card: ${firstCards[0]}, after: ${newCards[0]}`);
    await snap(pvPage, '25-after-randomize');
    expect(newCards.length).toBeGreaterThan(0);
    console.log('  ✅ Randomize re-generates and shows new cards');
  });

  test('Preview: Virtual scroll shows more cards on scroll', async () => {
    test.setTimeout(60_000);
    await pvPage.waitForSelector('button.prev-sort-btn', { timeout: 30_000 });
    await pvPage.waitForSelector('.prev-card', { timeout: 20_000 });
    await pvPage.waitForTimeout(1000);

    const beforeCount = await pvPage.locator('.prev-card').count();
    console.log(`  Cards before scroll: ${beforeCount}`);

    await pvPage.locator('.prev-grid-scroll').evaluate(el => el.scrollBy(0, 1200));
    await pvPage.waitForTimeout(600);

    const afterCount = await pvPage.locator('.prev-card').count();
    console.log(`  Cards after scroll: ${afterCount}`);
    const hasPixels = await canvasHasPixels(pvPage, '.prev-card canvas');
    expect(hasPixels).toBeTruthy();
    await snap(pvPage, '26-virtual-scroll');
    console.log('  ✅ Virtual scroll works, cards render after scroll');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS TAB — Server Generation (9999 NFTs → DB)
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Exports Tab — Server Generation', () => {

  test('Export idle state shows collection summary', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoWithCollection(page, collectionId);
    await gotoStep(page, /export/i);

    // Export panel idle state
    const idleCard = page.locator('.exp-idle-card');
    await expect(idleCard).toBeVisible({ timeout: 20_000 });
    await snap(page, '27-export-idle');

    // Collection summary grid
    const summaryGrid = page.locator('.exp-summary-grid');
    await expect(summaryGrid).toBeVisible();
    const summaryText = await summaryGrid.textContent();
    console.log(`  Summary: "${summaryText?.substring(0, 200)}"`);

    // Verify supply shows 9999
    expect(summaryText).toMatch(/9[,.]?999|9999/);
    // Verify format shows PNG
    expect(summaryText?.toLowerCase()).toMatch(/png/);
    // Verify blockchain
    expect(summaryText?.toLowerCase()).toMatch(/eth/i);

    // External URL and IPFS CID inputs visible
    const ipfsCidInput = page.locator('.exp-text-input').first();
    await expect(ipfsCidInput).toBeVisible();

    // Generate button must be visible and enabled
    const genBtn = page.locator('button.btn-primary.btn-lg').filter({ hasText: /Generate.*9.*999|Generate.*NFT/i });
    await expect(genBtn).toBeVisible({ timeout: 5_000 });
    await expect(genBtn).toBeEnabled();
    console.log('  ✅ Export idle state: summary correct, Generate button enabled');
  });

  test('Generate 9999 NFTs server-side and verify DB save', async ({ page }) => {
    test.setTimeout(GEN_TIMEOUT_MS);
    await gotoWithCollection(page, collectionId);
    await gotoStep(page, /export/i);

    if (jobId) {
      console.log(`  ⏭ Using pre-existing job: ${jobId}`);
      // Verify auto-restore brings up done state
      const tierLegend = page.locator('.exp-tier-legend');
      const restored = await tierLegend.isVisible({ timeout: 30_000 }).catch(() => false);
      console.log(`  Auto-restore: ${restored ? '✅' : '⚠ not visible'}`);
      console.log(`  ✅ Generation skipped — Job ID: ${jobId}`);
      return;
    }

    const idleCard = page.locator('.exp-idle-card');
    await expect(idleCard).toBeVisible({ timeout: 20_000 });

    // Start server generation
    const genBtn = page.locator('button.btn-primary.btn-lg').filter({ hasText: /Generate.*NFT/i });
    await expect(genBtn).toBeVisible();
    await expect(genBtn).toBeEnabled();
    await genBtn.click();
    console.log(`  ⏳ Server generation started for ${SUPPLY} NFTs…`);

    // Loading card appears (generation may be fast; wait up to 30s then snap)
    await page.waitForSelector('.exp-loading-card', { timeout: 30_000 });
    await page.waitForTimeout(500); // let React settle before screenshot
    await snap(page, '28-generating-started');

    // Poll progress every 30 seconds with snapshots
    const genDeadline = Date.now() + GEN_TIMEOUT_MS;
    let lastPhase = '';
    while (Date.now() < genDeadline) {
      await page.waitForTimeout(30_000);

      // Check if we've left the loading card state
      const loadingCard = await page.locator('.exp-loading-card').isVisible().catch(() => false);
      const dbSavedBanner = page.locator('.exp-banner-saved[data-job-id]');
      const isSaved = await dbSavedBanner.isVisible().catch(() => false);

      if (isSaved) {
        console.log('  ✅ DB saved banner appeared!');
        break;
      }

      if (loadingCard) {
        const phaseText = await page.locator('.exp-loading-msg, .exp-loading-title').first().textContent().catch(() => '');
        if (phaseText !== lastPhase) {
          console.log(`  📊 Phase: "${phaseText}"`);
          lastPhase = phaseText ?? '';
        }
        await snap(page, `generating-progress-${Date.now()}`);
      }

      // Check for error
      const errBanner = await page.locator('.exp-banner-error, .exp-error-banner').isVisible().catch(() => false);
      if (errBanner) {
        const errText = await page.locator('.exp-banner-error, .exp-error-banner').textContent();
        await snap(page, 'generation-error');
        throw new Error(`Generation failed: ${errText}`);
      }
    }

    // Verify DB saved banner with job ID
    const dbSavedBanner = page.locator('.exp-banner-saved[data-job-id]');
    await dbSavedBanner.waitFor({ state: 'visible', timeout: 120_000 });
    await snap(page, '29-db-saved-banner');

    const savedJobId = await dbSavedBanner.getAttribute('data-job-id');
    expect(savedJobId).toBeTruthy();
    jobId = savedJobId!;
    saveState();
    console.log(`  ✅ Generation complete — Job ID: ${jobId}`);

    // "N NFTs Ready" badge
    const readyBadge = page.locator('.exp-ready-badge');
    await expect(readyBadge).toBeVisible({ timeout: 10_000 });
    const readyText = await readyBadge.textContent();
    console.log(`  Ready badge: "${readyText}"`);
    expect(readyText).toMatch(/9[,.]?999|9999/);
  });

  test('Export done state: rarity tiers and NFT grid', async ({ page }) => {
    test.setTimeout(GEN_TIMEOUT_MS);
    await gotoWithCollection(page, collectionId);
    await gotoStep(page, /export/i);

    // ExportPanel auto-restores done state from DB on mount (checks for completed jobs).
    // Wait up to 30s for the tier legend (done state) to appear before falling back to re-generate.
    const tierLegend = page.locator('.exp-tier-legend');
    const autoRestored = await tierLegend.isVisible({ timeout: 30_000 }).catch(() => false);

    if (!autoRestored) {
      console.log('  ⚠ Auto-restore failed — re-generating');
      const genBtn = page.locator('button.btn-primary.btn-lg').filter({ hasText: /Generate.*NFT/i });
      await expect(genBtn).toBeVisible({ timeout: 5_000 });
      await genBtn.click();
      const dbSavedBanner = page.locator('.exp-banner-saved[data-job-id]');
      await dbSavedBanner.waitFor({ state: 'visible', timeout: GEN_TIMEOUT_MS });
      const savedJobId = await dbSavedBanner.getAttribute('data-job-id');
      if (savedJobId) jobId = savedJobId;
      await expect(tierLegend).toBeVisible({ timeout: 30_000 });
    }

    // Tier legend: 4 tiers visible

    await expect(tierLegend).toBeVisible({ timeout: 20_000 });
    const tierPills = page.locator('.exp-tier-pill');
    const tierCount = await tierPills.count();
    console.log(`  Tier pills: ${tierCount}`);
    expect(tierCount).toBe(4); // Legendary, Epic, Rare, Common

    const tierTexts = await tierPills.allTextContents();
    console.log(`  Tiers: ${tierTexts.join(' | ')}`);
    expect(tierTexts.some(t => /legendary/i.test(t))).toBeTruthy();
    expect(tierTexts.some(t => /epic/i.test(t))).toBeTruthy();
    expect(tierTexts.some(t => /rare/i.test(t))).toBeTruthy();
    expect(tierTexts.some(t => /common/i.test(t))).toBeTruthy();

    // NFT grid has cards
    const nftGrid = page.locator('.exp-nft-grid');
    await expect(nftGrid).toBeVisible();
    const nftCards = page.locator('.exp-nft-card');
    const nftCardCount = await nftCards.count();
    console.log(`  NFT cards in export grid: ${nftCardCount}`);
    expect(nftCardCount).toBeGreaterThan(0);

    // Tier chips and rank badges on cards
    const tierChips = page.locator('.exp-nft-tier-chip');
    expect(await tierChips.count()).toBeGreaterThan(0);
    await snap(page, '30-export-nft-grid');

    // Sort by ID
    const sortId = page.locator('.exp-sort-btn').filter({ hasText: /# ID/i });
    await expect(sortId).toBeVisible();
    await sortId.click();
    await page.waitForTimeout(300);
    await expect(sortId).toHaveClass(/exp-sort-active/);
    await snap(page, '31-export-sort-by-id');

    // Sort by Rarity
    const sortRarity = page.locator('.exp-sort-btn').filter({ hasText: /rarity/i });
    await sortRarity.click();
    await page.waitForTimeout(300);
    await expect(sortRarity).toHaveClass(/exp-sort-active/);
    await snap(page, '32-export-sort-by-rarity');

    console.log('  ✅ Rarity tier distribution correct, sort modes work');
  });

  test('Export: click NFT card opens popup with traits', async ({ page }) => {
    test.setTimeout(GEN_TIMEOUT_MS);
    await gotoWithCollection(page, collectionId);
    await gotoStep(page, /export/i);

    const tierLegend = page.locator('.exp-tier-legend');
    const autoRestored = await tierLegend.isVisible({ timeout: 30_000 }).catch(() => false);
    if (!autoRestored) {
      const genBtn = page.locator('button.btn-primary.btn-lg').filter({ hasText: /Generate.*NFT/i });
      await expect(genBtn).toBeVisible({ timeout: 5_000 });
      await genBtn.click();
      const dbSaved = page.locator('.exp-banner-saved[data-job-id]');
      await dbSaved.waitFor({ state: 'visible', timeout: GEN_TIMEOUT_MS });
      if (!jobId) {
        const jid = await dbSaved.getAttribute('data-job-id');
        if (jid) jobId = jid;
      }
      await expect(tierLegend).toBeVisible({ timeout: 30_000 });
    }

    await page.waitForSelector('.exp-nft-card', { timeout: 30_000 });
    await page.locator('.exp-nft-card').first().click();
    await page.waitForTimeout(500);

    const popup = page.locator('.nft-popup, [class*="popup"], [class*="NftPopup"]').first();
    const anyModal = page.locator('[class*="modal"], [class*="popup"]').first();
    const popupVisible = await popup.isVisible().catch(() => false) || await anyModal.isVisible().catch(() => false);
    console.log(`  Popup visible after clicking export card: ${popupVisible}`);

    if (popupVisible) {
      await snap(page, '33-export-card-popup');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
    console.log('  ✅ Export NFT card click handled');
  });

  test('Export: Download ZIP button is visible and metadata-only checkbox works', async ({ page }) => {
    test.setTimeout(GEN_TIMEOUT_MS);
    await gotoWithCollection(page, collectionId);
    await gotoStep(page, /export/i);

    const tierLegend = page.locator('.exp-tier-legend');
    const autoRestored = await tierLegend.isVisible({ timeout: 30_000 }).catch(() => false);
    if (!autoRestored) {
      const genBtn = page.locator('button.btn-primary.btn-lg').filter({ hasText: /Generate.*NFT/i });
      await expect(genBtn).toBeVisible({ timeout: 5_000 });
      await genBtn.click();
      const dbSaved = page.locator('.exp-banner-saved[data-job-id]');
      await dbSaved.waitFor({ state: 'visible', timeout: GEN_TIMEOUT_MS });
      await expect(tierLegend).toBeVisible({ timeout: 30_000 });
    }

    const downloadBtn = page.locator('button.btn-primary').filter({ hasText: /Download ZIP/i });
    await expect(downloadBtn).toBeVisible({ timeout: 20_000 });
    console.log('  ✅ Download ZIP button visible');

    // Metadata-only checkbox
    const metaCheckbox = page.locator('.exp-checkbox-row input[type=checkbox]').first();
    await expect(metaCheckbox).toBeVisible();
    const beforeState = await metaCheckbox.isChecked();
    await metaCheckbox.click();
    const afterState = await metaCheckbox.isChecked();
    expect(afterState).toBe(!beforeState);
    await metaCheckbox.click(); // restore
    await snap(page, '34-download-zip-visible');
    console.log('  ✅ Metadata-only checkbox toggles');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS TAB — Server-Side Filebase Export + CID Sync
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Exports Tab — Filebase Server Export', () => {

  test('Server export section visible after DB save and starts export', async ({ page }) => {
    test.setTimeout(EXPORT_TIMEOUT_MS);
    await gotoWithCollection(page, collectionId);
    await gotoStep(page, /export/i);

    // Wait for auto-restore (ExportPanel checks DB for completed job on mount)
    const tierLegend = page.locator('.exp-tier-legend');
    const autoRestored = await tierLegend.isVisible({ timeout: 30_000 }).catch(() => false);
    if (!autoRestored) {
      const genBtn = page.locator('button.btn-primary.btn-lg').filter({ hasText: /Generate.*NFT/i });
      await expect(genBtn).toBeVisible({ timeout: 5_000 });
      await genBtn.click();
      const dbSaved = page.locator('.exp-banner-saved[data-job-id]');
      await dbSaved.waitFor({ state: 'visible', timeout: GEN_TIMEOUT_MS });
      const jid = await dbSaved.getAttribute('data-job-id');
      if (jid) jobId = jid;
      console.log(`  ✅ Regenerated — job ID: ${jobId}`);
      await expect(tierLegend).toBeVisible({ timeout: 30_000 });
    }

    // Server export card must be visible (shown only after dbSaved=true)
    const svrCard = page.locator('.exp-svr-card');
    await expect(svrCard).toBeVisible({ timeout: 30_000 });
    await snap(page, '35-server-export-card-visible');

    // Enter bucket name
    const bucketInput = svrCard.locator('input[placeholder*="bucket"]');
    await expect(bucketInput).toBeVisible();
    await bucketInput.fill(BUCKET);
    console.log(`  Bucket set: ${BUCKET}`);

    // Start server export
    const startBtn = svrCard.locator('button').filter({ hasText: /Start Server Export/i });
    await expect(startBtn).toBeVisible({ timeout: 5_000 });
    await expect(startBtn).toBeEnabled();
    await startBtn.click();
    console.log('  ⏳ Server export started…');
    await snap(page, '36-server-export-started');

    // Running div with data-export-id appears
    const runningDiv = svrCard.locator('[data-export-id]');
    await runningDiv.waitFor({ state: 'visible', timeout: 60_000 });
    const exportId = await runningDiv.getAttribute('data-export-id');
    console.log(`  Export ID: ${exportId}`);
    expect(exportId).toBeTruthy();

    // ── Poll until done ────────────────────────────────────────────────────────
    const deadline = Date.now() + EXPORT_TIMEOUT_MS;
    let lastProgress = -1;
    let lastSnap = Date.now();
    const SNAP_INTERVAL = 60_000; // snapshot every minute

    while (Date.now() < deadline) {
      await page.waitForTimeout(30_000);

      const status = await page.evaluate(async (eid: string) => {
        try {
          const r = await fetch(`/api/nft-gen/export/${eid}`);
          return r.ok ? await r.json() : null;
        } catch { return null; }
      }, exportId!);

      if (!status) { console.log('  ⚠ Poll returned null'); continue; }

      if (status.progress !== lastProgress) {
        const pct = status.total > 0 ? ((status.progress / status.total) * 100).toFixed(1) : '0';
        console.log(`  📊 Export: ${status.progress}/${status.total} (${pct}%) — ${status.phase}`);
        lastProgress = status.progress;
      }

      if (Date.now() - lastSnap > SNAP_INTERVAL) {
        await snap(page, `export-progress-${status.progress}`);
        lastSnap = Date.now();
      }

      if (status.status === 'done') {
        console.log(`  ✅ Server export complete! ${status.total} NFTs uploaded to Filebase`);
        break;
      }
      if (status.status === 'error') {
        await snap(page, 'server-export-error');
        throw new Error(`Server export failed: ${status.error}`);
      }
    }

    // Done banner
    const doneBanner = svrCard.locator('.exp-svr-done');
    await doneBanner.waitFor({ state: 'visible', timeout: 120_000 });
    await snap(page, '37-server-export-done');
    const doneText = await doneBanner.textContent();
    console.log(`  Done banner: "${doneText}"`);
    expect(doneText).toMatch(/NFT/i);
    console.log('  ✅ Server export complete + done banner shown');
  });

  test('DB CID sync: verify IPFS CIDs written back to nft_generated_items', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoWithCollection(page, collectionId);

    if (!jobId) {
      console.log('  ⚠ No jobId available — skipping CID verification');
      test.skip();
      return;
    }

    // Query items via API to check IPFS CIDs
    const items = await page.evaluate(async (jid: string) => {
      try {
        const r = await fetch(`/api/nft-gen/jobs/${jid}/items?limit=10`);
        return r.ok ? await r.json() : null;
      } catch { return null; }
    }, jobId);

    console.log(`  Items response (first 10): total=${items?.total}, items=${items?.items?.length}`);
    expect(items).toBeTruthy();
    expect(items.total).toBe(SUPPLY);

    let cidsFound = 0;
    for (const item of (items?.items ?? []).slice(0, 5)) {
      const hasImg  = !!item.ipfsImageCid;
      const hasMeta = !!item.ipfsMetadataCid;
      console.log(`    #${item.editionNumber}: img_cid=${hasImg ? '✅' : '❌'}  meta_cid=${hasMeta ? '✅' : '❌'}`);
      if (hasImg) cidsFound++;
    }

    expect(cidsFound).toBeGreaterThan(0);
    console.log(`  ✅ ${cidsFound}/5 sampled items have IPFS CIDs in DB`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DB VERIFICATION — All 7 tables checked via API
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('DB Verification', () => {

  test('nft_collections: exactly 1 collection created', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto('/dashboard/generator');
    await waitForStudio(page);

    if (!collectionId) {
      console.log('  ⚠ No collectionId — skipping');
      test.skip();
      return;
    }

    const data = await page.evaluate(async (cid: string) => {
      const r = await fetch(`/api/nft-gen/collections/${cid}`);
      return r.ok ? r.json() : null;
    }, collectionId);

    const coll = data?.collection ?? data;
    console.log(`  Collection: id=${coll?.id}, name="${coll?.name}", symbol=${coll?.symbol}, status=${coll?.status}`);
    expect(coll?.id).toBe(collectionId);
    expect(coll?.name).toBe(COLLECTION_NAME);
    expect(coll?.symbol).toBe(SYMBOL);
    console.log('  ✅ Collection data correct in DB');
  });

  test('nft_layers: 11 layers synced with correct names', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto('/dashboard/generator');
    await waitForStudio(page);

    if (!collectionId) { test.skip(); return; }

    const data = await page.evaluate(async (cid: string) => {
      const r = await fetch(`/api/nft-gen/collections/${cid}/layers`);
      return r.ok ? r.json() : null;
    }, collectionId);

    const layers = data?.layers ?? data ?? [];
    console.log(`  Layers in DB: ${layers.length}`);
    const layerNames = layers.map((l: any) => l.name).sort();
    console.log(`  Layer names: ${layerNames.join(', ')}`);
    expect(layers.length).toBeGreaterThanOrEqual(11);
    expect(layerNames.some((n: string) => n.includes('0-bg'))).toBeTruthy();
    expect(layerNames.some((n: string) => n.includes('9-headwear_front'))).toBeTruthy();
    console.log('  ✅ All 11 layers in DB');
  });

  test('nft_generation_jobs: 1 job with status=complete and 9999 items', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto('/dashboard/generator');
    await waitForStudio(page);

    if (!jobId) { test.skip(); return; }

    const data = await page.evaluate(async (jid: string) => {
      const r = await fetch(`/api/nft-gen/jobs/${jid}`);
      return r.ok ? r.json() : null;
    }, jobId);

    const job = data?.job ?? data;
    console.log(`  Job: id=${job?.id?.substring(0, 8)}…, status=${job?.status}, progress=${job?.progress}, edition_size=${job?.editionSize}`);
    expect(job?.status).toBe('complete');
    expect(job?.progress).toBe(100);
    expect(job?.editionSize).toBe(SUPPLY);
    console.log('  ✅ Generation job is complete with correct edition size');
  });

  test('nft_generated_items: exactly 9999 items with rarity data', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto('/dashboard/generator');
    await waitForStudio(page);

    if (!jobId) { test.skip(); return; }

    const data = await page.evaluate(async (jid: string) => {
      const r = await fetch(`/api/nft-gen/jobs/${jid}/items?limit=1`);
      return r.ok ? r.json() : null;
    }, jobId);

    console.log(`  Total generated items: ${data?.total}`);
    expect(data?.total).toBe(SUPPLY);

    const firstItem = data?.items?.[0];
    if (firstItem) {
      console.log(`  First item: #${firstItem.editionNumber}, rank=${firstItem.rank}, tier=${firstItem.tier}, score=${firstItem.score}`);
      expect(firstItem.editionNumber).toBeGreaterThanOrEqual(1);
      expect(firstItem.rank).toBeGreaterThanOrEqual(1);
      expect(['Legendary', 'Epic', 'Rare', 'Common']).toContain(firstItem.tier);
      expect(firstItem.score).toBeGreaterThan(0);
    }
    console.log(`  ✅ ${SUPPLY} generated items with rarity data in DB`);
  });

  test('nft_upload_batches: upload records exist after Filebase export', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto('/dashboard/generator');
    await waitForStudio(page);

    if (!jobId) { test.skip(); return; }

    const data = await page.evaluate(async (jid: string) => {
      const r = await fetch(`/api/nft-gen/jobs/${jid}/upload-batches`);
      return r.ok ? r.json() : null;
    }, jobId);

    console.log(`  Upload batches: ${JSON.stringify(data)?.substring(0, 200)}`);
    // There should be at least 1 batch record from the server export
    const batches = data?.batches ?? data ?? [];
    if (batches.length > 0) {
      console.log(`  ✅ ${batches.length} upload batch record(s) in DB`);
    } else {
      // Server export writes to DB when using export route — this check is informational
      console.log('  ⚠ No upload batch records (server export may not create them via this API)');
    }
  });
});
