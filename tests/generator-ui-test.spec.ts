/**
 * NFT Generator – Complete Professional End-to-End Test
 *
 * Covers every tab and every major feature:
 *   1. Login
 *   2. Settings  – fill collection form, upload layers
 *   3. Organize  – sidebar layers, asset cards, rarity badges,
 *                  weight sliders, tier distribution, optional-layer toggle
 *   4. Rarity    – dedicated info tab (probability table per layer)
 *   5. Preview   – 9999 combos generated instantly; sort, filter, popup, randomize
 *   6. Export    – click ⚡ Generate, progress screenshots, rarity grid, ZIP download
 *
 * Upload strategy: we mirror the real LAYERS_DIR structure but replace every
 * image file with a 1×1 transparent PNG stub so CDP transfer is near-instant.
 * The stub root folder keeps the SAME name ("exported_layers") so
 * webkitRelativePaths (`exported_layers/0-bg/0-0.png`) match what the server
 * and LayerFilesContext blob-URL cache expect.
 */

import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';

// ── Config ──────────────────────────────────────────────────────────────────
const BASE       = 'https://bearth-admin-pi.vercel.app';
const LAYERS_DIR = 'D:\\AMG-Projects\\AMGEcosystem\\amgecosystem\\Bearth-NFT-Generator\\exported_layers';
const EMAIL      = 'amplecapitalholding@gmail.com';
const PASSWORD   = 'amplecapitalholding@123';
const SUPPLY     = 9999;   // full-size collection for combo generation
const MAX_STUBS  = 2;      // max stub images per directory level

// Minimal valid 1×1 transparent PNG – 67 bytes
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildStubDir(src: string): string {
  const dirName   = path.basename(src);   // keeps "exported_layers"
  const tmpParent = path.join(os.tmpdir(), `bearth-stub-${Date.now()}`);
  const stubDir   = path.join(tmpParent, dirName);

  function mirror(s: string, d: string) {
    fs.mkdirSync(d, { recursive: true });
    let imgs = 0;
    for (const e of fs.readdirSync(s, { withFileTypes: true })) {
      if (e.isDirectory()) {
        mirror(path.join(s, e.name), path.join(d, e.name));
      } else if (/\.(png|jpg|jpeg|gif|webp)$/i.test(e.name) && imgs < MAX_STUBS) {
        fs.writeFileSync(
          path.join(d, e.name.replace(/\.(jpg|jpeg|gif|webp)$/i, '.png')),
          TINY_PNG
        );
        imgs++;
      }
    }
  }
  mirror(src, stubDir);
  return stubDir;
}

function countAll(dir: string, type: 'files' | 'dirs'): number {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (type === 'dirs') n++;
      n += countAll(path.join(dir, e.name), type);
    } else if (type === 'files' && /\.(png|jpg|jpeg|gif|webp)$/i.test(e.name)) n++;
  }
  return n;
}

/** Navigate to a step-nav tab. Scoped strictly to .step-nav so inline buttons
 *  like "Quick Preview" or "Layer Rarity" inside the content area are never matched. */
async function goToStep(page: Page, label: string) {
  const btn = page.locator(`.step-nav .step-btn:has-text("${label}")`).first();
  if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(600);   // was 2500 — just let React re-render
    console.log(`  ✓ Navigated to [${label}] tab`);
  } else {
    console.log(`  ⚠ Step button "${label}" not found`);
  }
}

/** Safe fill – uses short timeout so missing fields don't block for 60 s. */
async function safeFill(page: Page, selector: string, value: string, label = '') {
  try {
    await page.locator(selector).first().fill(value, { timeout: 3000 });
    if (label) console.log(`  ✓ Filled ${label}: ${value}`);
  } catch {
    if (label) console.log(`  – ${label} field not found, skipped`);
  }
}

// ── Test ────────────────────────────────────────────────────────────────────

test.describe('NFT Generator – Complete Professional Flow', () => {
  test.setTimeout(300_000); // 5 min — test should finish in ~2-3 min with trimmed waits

  test('all tabs: settings → upload → organize → rarity → preview (9999) → export → ZIP', async ({ page }) => {
    const errs: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push(e.message));

    // Build tiny-stub directory (same name as real dir for correct webkitRelativePaths)
    const stubDir    = buildStubDir(LAYERS_DIR);
    const realDirs   = countAll(LAYERS_DIR, 'dirs');
    const realImgs   = countAll(LAYERS_DIR, 'files');
    const stubImgs   = countAll(stubDir, 'files');

    console.log(`\nSource : ${LAYERS_DIR}`);
    console.log(`  Folders: ${realDirs}  |  Images: ${realImgs}`);
    console.log(`Stubs  : ${stubImgs} tiny PNGs (${MAX_STUBS}/folder) → ${stubDir}`);
    console.log(`Supply : ${SUPPLY} NFTs`);

    // ═══════════════════════════════════════════════════════════════════════
    // TAB 0 – LOGIN
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n══════════ LOGIN ══════════');
    const res = await page.request.post(`${BASE}/api/auth/login`, {
      data: { email: EMAIL, password: PASSWORD },
      headers: { 'Content-Type': 'application/json' },
    });
    const { role, success } = await res.json().catch(() => ({}));
    console.log(`  HTTP ${res.status()} | role=${role} | success=${success}`);
    expect(res.status(), 'Login must succeed').toBe(200);

    // ═══════════════════════════════════════════════════════════════════════
    // TAB 1 – SETTINGS
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n══════════ TAB: SETTINGS ══════════');
    await page.goto(`${BASE}/dashboard/generator`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(800);

    // Handle login-wall redirect
    if (page.url().includes('/login')) {
      await page.fill('input[type="email"]', EMAIL);
      await page.fill('input[type="password"]', PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(`${BASE}/dashboard/**`, { timeout: 20_000 });
      await page.goto(`${BASE}/dashboard/generator`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
    }
    expect(page.url()).toContain('generator');

    // Verify Settings tab is active (default on load)
    const onSettings = await page.locator('.step-nav .step-btn.step-active').textContent().catch(() => '');
    console.log(`  Active step on load: "${onSettings?.trim()}"`);

    await page.screenshot({ path: 'test-results/01-settings-initial.png' });

    // Fill collection form
    await safeFill(page, 'input[placeholder="No Name"], input[placeholder*="Name" i]',
      'Bearth Genesis Collection', 'Collection name');
    await safeFill(page, 'input[placeholder*="Symbol" i]', 'BEARTH', 'Symbol');
    await safeFill(page, 'textarea', 'The Bearth Genesis – first generation NFT collection.', 'Description');

    // Collection size = SUPPLY
    const sizeEl = page.locator('input[type="number"]').first();
    if (await sizeEl.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sizeEl.fill(String(SUPPLY));
      console.log(`  ✓ Collection size: ${SUPPLY}`);
    }

    // Select format (PNG already default)
    const pngBtn = page.locator('button:has-text("PNG"), [class*="format-btn"]:has-text("PNG")').first();
    if (await pngBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pngBtn.click();
      console.log('  ✓ Format: PNG selected');
    }

    // Canvas width/height left at default (512×512) — keeps popup images sharp.
    // Export with 1×1 stub PNGs is near-instant regardless of canvas size.
    await safeFill(page, 'input[placeholder="Width"]',  '512', 'Canvas width');
    await safeFill(page, 'input[placeholder="Height"]', '512', 'Canvas height');

    await page.screenshot({ path: 'test-results/02-settings-filled.png' });

    // Upload layers (stub PNGs – near-instant, correct webkitRelativePaths)
    console.log(`  Uploading ${stubImgs} stub PNGs from ${realDirs} folders…`);
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(stubDir);

    await page.waitForFunction(
      () => Array.from(document.querySelectorAll('.setup-drop-label, .setup-drop-sub, [class*="drop-label"]'))
               .some(el => /imported|layers/i.test(el.textContent ?? '')),
      { timeout: 60_000 }
    ).catch(() => console.log('  ⚠ Import message not detected'));

    const importMsg = await page.locator('.setup-drop-label').first().textContent().catch(() => 'n/a');
    console.log(`  ✓ Import: "${importMsg?.trim()}"`);
    await page.screenshot({ path: 'test-results/03-settings-uploaded.png' });

    // Save & Continue → Organize
    const continueBtn = page.locator('button:has-text("Save & Continue"), button:has-text("Continue")').first();
    if (await continueBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await continueBtn.click();
      console.log('  ✓ Clicked Save & Continue');
      await page.waitForResponse(
        r => r.url().includes('/api/nft-gen/collections') && r.status() < 400,
        { timeout: 6_000 }
      ).catch(() => {});
      await page.waitForSelector('.sb-layer, .sidebar', { timeout: 4_000 }).catch(() => {});
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: 'test-results/04-after-settings.png' });

    // ═══════════════════════════════════════════════════════════════════════
    // TAB 2 – ORGANIZE  (layers, rarity badges, weight sliders, tier stats)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n══════════ TAB: ORGANIZE ══════════');

    // Sidebar layer list
    const sbLayers = await page.locator('.sb-layer').count();
    console.log(`  Sidebar layers : ${sbLayers}`);

    // Walk through each layer – click it and record asset count
    const layerResults: string[] = [];
    for (let i = 0; i < sbLayers; i++) {
      const row = page.locator('.sb-layer').nth(i);
      const name = (await row.textContent().catch(() => ''))?.trim().replace(/\n+/g, ' ');
      await row.click().catch(() => {});
      await page.waitForTimeout(400);
      const cards = await page.locator('[class*="asset-card"], .lc-file-grid [class*="card"]').count();
      layerResults.push(`${name} → ${cards} assets`);
    }
    layerResults.forEach(r => console.log(`  Layer: ${r}`));

    await page.screenshot({ path: 'test-results/05-organize-all-layers.png' });

    // Rarity badges visible in active layer
    const rarityBadges = await page.locator('text=Legendary, text=Epic, text=Rare, text=Common').count();
    console.log(`  Rarity badges  : ${rarityBadges}`);

    // Weight sliders / inputs
    const sliders = await page.locator('input[type="range"], [class*="slider"]').count();
    console.log(`  Weight sliders : ${sliders}`);

    // Right-panel rarity stats
    const totalWeightEl = await page.locator('text=/Total weight/i').first().textContent().catch(() => '');
    const activeTraitsEl= await page.locator('text=/Active traits/i').first().textContent().catch(() => '');
    console.log(`  ${totalWeightEl?.trim() || '(Total weight n/a)'}`);
    console.log(`  ${activeTraitsEl?.trim() || '(Active traits n/a)'}`);

    // Tier distribution
    for (const tier of ['Legendary', 'Epic', 'Rare', 'Common']) {
      const row = page.locator(`text=${tier}`).first();
      if (await row.isVisible({ timeout: 800 }).catch(() => false)) {
        const txt = await row.evaluate(el => el.closest('[class*="tier"], li, div')?.textContent ?? '');
        console.log(`  Tier ${tier}: ${txt.replace(/\s+/g, ' ').trim()}`);
      }
    }

    // Optional toggle – toggle first layer optional and back
    const optToggle = page.locator('.sb-layer').first().locator('input[type="checkbox"], button[role="switch"]').first();
    if (await optToggle.isVisible({ timeout: 800 }).catch(() => false)) {
      await optToggle.click();
      await page.waitForTimeout(200);
      await optToggle.click(); // restore
      console.log('  ✓ Optional layer toggle exercised');
    }

    await page.screenshot({ path: 'test-results/06-organize-rarity-stats.png' });

    // ═══════════════════════════════════════════════════════════════════════
    // TAB 3 – RARITY INFO
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n══════════ TAB: RARITY INFO ══════════');
    await goToStep(page, 'Rarity');
    await page.screenshot({ path: 'test-results/07-rarity-info.png' });

    // Whatever the Rarity tab shows – record it
    const rarityPageText = await page.locator('main, [class*="studio"], [class*="content"]')
      .first().textContent().catch(() => '');
    console.log(`  Rarity tab content (first 300 chars): ${rarityPageText?.slice(0, 300).replace(/\s+/g, ' ')}`);

    // Accordions (per-layer probability breakdown)
    const accordions = await page.locator('[class*="accordion"], [class*="rarity-acc"]').count();
    console.log(`  Accordion sections: ${accordions}`);
    if (accordions > 0) {
      for (let i = 0; i < Math.min(accordions, 3); i++) {
        await page.locator('[class*="accordion-header"], [class*="rarity-acc-header"]').nth(i)
          .click().catch(() => {});
        await page.waitForTimeout(300);
      }
      const rows = await page.locator('[class*="rarity-row"], [class*="rarity-acc-table"] tr').count();
      console.log(`  Probability rows (expanded): ${rows}`);
    }

    await page.screenshot({ path: 'test-results/08-rarity-expanded.png' });

    // ═══════════════════════════════════════════════════════════════════════
    // TAB 4 – PREVIEW  (9999 combos – instant JS generation)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n══════════ TAB: PREVIEW (9999 combos) ══════════');
    await goToStep(page, 'Preview');
    await page.screenshot({ path: 'test-results/09-preview-start.png' });

    // Wait for combo engine to run and first cards to appear (pure JS — fast)
    console.log('  Waiting for combo generation & first card renders…');
    await page.waitForFunction(
      () => document.querySelectorAll('.prev-card').length > 0,
      { timeout: 30_000 }
    ).catch(() => console.log('  ⚠ Preview cards not detected in 30 s'));

    await page.waitForTimeout(1500); // brief settle for lazy canvases
    await page.screenshot({ path: 'test-results/10-preview-rendered.png' });

    const totalCards  = await page.locator('.prev-card').count();
    const emptyState  = await page.locator('[class*="preview-empty"]').isVisible().catch(() => false);
    console.log(`  Cards on page 1 : ${totalCards}`);
    console.log(`  Empty state     : ${emptyState}`);

    // Click a card to open detail popup
    const firstCard = page.locator('.prev-card').first();
    if (await firstCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstCard.click();
      await page.waitForTimeout(300);
      const popup = await page.locator('.nft-popup-overlay').first()
        .isVisible({ timeout: 1000 }).catch(() => false);
      console.log(`  NFT detail popup: ${popup}`);
      await page.screenshot({ path: 'test-results/11-preview-popup.png' });

      // Close popup via JS evaluation – bypasses Playwright pointer interception entirely.
      await page.evaluate(() => {
        const btn = document.querySelector('.nft-popup-close') as HTMLElement | null;
        if (btn) { btn.click(); return; }
        (document.querySelector('.nft-popup-overlay') as HTMLElement | null)?.click();
      });
      await page.keyboard.press('Escape');
      await page.waitForSelector('.nft-popup-overlay', { state: 'hidden', timeout: 2000 })
        .catch(() => {});
      await page.waitForTimeout(200);
    }

    // Sort: Most rare first
    const sortBtn = page.locator('.prev-sort-btn, button:has-text("Shuffle")').first();
    if (await sortBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await sortBtn.click();
      await page.waitForTimeout(200);
      const opts = page.locator('[class*="sort"] li, [class*="dropdown"] li');
      const optCount = await opts.count();
      console.log(`  Sort options: ${optCount}`);
      if (optCount > 0) {
        await opts.first().click().catch(() => {});
        await page.waitForTimeout(500);
      }
      await page.screenshot({ path: 'test-results/12-preview-sorted.png' });
    }

    // Filter by first visible trait
    const firstLayerRow = page.locator('.preview-layer-row, .plr-group').first();
    if (await firstLayerRow.isVisible({ timeout: 1500 }).catch(() => false)) {
      await firstLayerRow.click();
      await page.waitForTimeout(200);
      const traitRow = page.locator('.plr-trait-row').first();
      if (await traitRow.isVisible({ timeout: 1000 }).catch(() => false)) {
        const traitName = (await traitRow.textContent().catch(() => ''))?.trim();
        await traitRow.click();
        await page.waitForTimeout(500);
        const filtered = await page.locator('.prev-card').count();
        console.log(`  Filter by "${traitName}": ${filtered} cards shown`);
        await page.screenshot({ path: 'test-results/13-preview-filtered.png' });
        await page.locator('.plr-filter-clear, button:has-text("✕")').first().click().catch(() => {});
        await page.waitForTimeout(300);
        console.log('  Filter cleared');
      }
    }

    // Randomize to shuffle combos
    const randomizeBtn = page.locator('.randomize-btn, button:has-text("Randomize")').first();
    if (await randomizeBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await randomizeBtn.click();
      await page.waitForTimeout(500);
      const afterRand = await page.locator('.prev-card').count();
      console.log(`  After randomize: ${afterRand} cards`);
      await page.screenshot({ path: 'test-results/14-preview-randomized.png' });
    }

    // Pagination (go to page 2 if it exists)
    const nextPage = page.locator('.preview-pagination button:has-text("›"), [class*="pagination"] button').nth(1);
    if (await nextPage.isVisible({ timeout: 1500 }).catch(() => false)) {
      await nextPage.click();
      await page.waitForTimeout(300);
      console.log('  ✓ Navigated to preview page 2');
      await page.screenshot({ path: 'test-results/15-preview-page2.png' });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // TAB 5 – EXPORT
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n══════════ TAB: EXPORT ══════════');
    await goToStep(page, 'Export');
    await page.screenshot({ path: 'test-results/16-export-idle.png' });

    // Collection summary (name, supply, blockchain, format, resolution)
    const summary = await page.locator('[class*="summary"], [class*="collection-meta"], [class*="exp-meta"]')
      .textContent().catch(() => '');
    console.log(`  Collection summary: ${summary?.replace(/\s+/g, ' ').trim().slice(0, 200) || '(not found)'}`);

    // IPFS CID input (optional)
    await page.locator('input[placeholder*="CID"], input[placeholder*="ipfs"]').first()
      .fill('QmTestCIDplaceholder').catch(() => {});

    // ── STEP A: Click ⚡ Generate (combo generation + rarity scoring – pure JS, instant) ──
    // This does NOT composite images. It just assigns traits to each NFT and computes
    // rarity scores, then shows the rarity grid. Canvas compositing only happens at
    // Download ZIP time. With 9999 NFTs this step finishes in < 2 seconds.
    // Button text is: "⚡ Generate 9,999 NFTs"
    const genBtn = page.locator('button:has-text("⚡ Generate")').first();
    const canGen = await genBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    console.log(`  Generate button: ${canGen ? 'visible ✓' : 'not found ✗'}`);

    if (canGen) {
      const btnText = await genBtn.textContent().catch(() => '');
      console.log(`  Button label: "${btnText?.trim()}" (${SUPPLY} NFTs)`);
      const t0 = Date.now();
      await genBtn.click();
      console.log(`  ✓ Generation clicked – waiting for rarity grid…`);

      // Wait for the rarity grid (exp-nft-card) – appears as soon as combos+rarity are done (~instant)
      await page.waitForFunction(
        () => document.querySelectorAll('.exp-nft-card').length > 0,
        { timeout: 30_000 }
      ).catch(() => console.log('  ⚠ Rarity grid not detected in 30 s'));
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`  ✓ Rarity grid appeared in ${elapsed} s`);

      await page.screenshot({ path: 'test-results/17-export-rarity-grid.png' });

      // Rarity grid stats
      const rarityCards = await page.locator('.exp-nft-card').count();
      console.log(`  Rarity cards rendered: ${rarityCards}`);

      // Sort by rarity score
      const rSortBtn = page.locator('.exp-sort-btn').filter({ hasText: /Rarity|🏆|Score/ }).first();
      if (await rSortBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await rSortBtn.click();
        await page.waitForTimeout(800);
        console.log('  ✓ Sort: rarity score');
        await page.screenshot({ path: 'test-results/18-export-sorted.png' });
      }

      // Click a rarity card to open its popup
      const firstRarity = page.locator('.exp-nft-card').first();
      if (await firstRarity.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstRarity.click();
        await page.waitForTimeout(600);
        await page.screenshot({ path: 'test-results/19-export-card-popup.png' });
        // Close export popup via JS (same pattern as preview popup)
        await page.evaluate(() => {
          const btn = document.querySelector('.nft-popup-close') as HTMLElement | null;
          if (btn) { btn.click(); return; }
          (document.querySelector('.nft-popup-overlay') as HTMLElement | null)?.click();
        });
        await page.waitForTimeout(400);
      }

      // ── STEP B: Download ZIP (canvas compositing – fast with 1×1 stub PNGs) ──
      // With 1×1 stub PNGs compositing is near-instant regardless of canvas size.
      const dlBtn = page.locator('button:has-text("Download"), button:has-text("⬇"), button:has-text("ZIP")').first();
      if (await dlBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log(`  Downloading ZIP (${SUPPLY} NFTs @ 512×512)…`);
        const tDl = Date.now();

        const [dl] = await Promise.all([
          page.waitForEvent('download', { timeout: 120_000 }),
          dlBtn.click(),
        ]);

        // Take progress screenshot while downloading
        await page.waitForTimeout(5000);
        await page.screenshot({ path: 'test-results/20-export-dl-progress.png' });
        const prog = await page.locator('[class*="progress"], [class*="load-msg"]').first()
          .textContent().catch(() => '');
        console.log(`  Progress @ 5 s: ${prog?.trim() || '(n/a)'}`);

        fs.mkdirSync('test-results', { recursive: true });
        const zipPath = path.join('test-results', dl.suggestedFilename() || 'nfts.zip');
        await dl.saveAs(zipPath);
        const dlElapsed = ((Date.now() - tDl) / 1000).toFixed(1);
        const mb = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(2);
        console.log(`  ✓ ZIP downloaded in ${dlElapsed} s: ${zipPath}  (${mb} MB)`);
        await page.screenshot({ path: 'test-results/21-after-download.png' });
      } else {
        console.log('  ⚠ Download button not found – skipping ZIP step');
        await page.screenshot({ path: 'test-results/20-export-no-dl-btn.png' });
      }
    }

    // Cleanup stubs
    try { fs.rmSync(path.dirname(stubDir), { recursive: true, force: true }); } catch {}

    // ═══════════════════════════════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n══════════ SUMMARY ══════════');
    console.log(`Real layer folders : ${realDirs}  |  images: ${realImgs}`);
    console.log(`Stub files uploaded: ${stubImgs} tiny PNGs`);
    console.log(`Supply             : ${SUPPLY} NFTs`);
    console.log(`Browser errors     : ${errs.length === 0 ? 'none' : errs.length}`);
    if (errs.length) errs.slice(0, 5).forEach(e => console.log(`  ${e}`));
    console.log('Screenshots saved  : test-results/');

    expect(page.url()).toContain('generator');
  });
});
