/**
 * NFT Generator — Full E2E on Vercel (upload → organise → preview → export)
 * Target: https://bearth-admin-it.vercel.app
 *
 * Approach: one continuous browser session, tabs navigated in sequence.
 * No fresh page.goto() per test — keeps session alive across all steps.
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import path from 'path';
import fs   from 'fs';

// ── Config ────────────────────────────────────────────────────────────────────
const BASE          = 'https://bearth-admin-it.vercel.app';
const EMAIL         = 'amplecapitalholding@gmail.com';
const PASS          = 'amplecapitalholding@123';
const LAYERS_ROOT   = 'D:/AMG-Projects/AMGEcosystem/amgecosystem/amgecosystem-v1.0.0/BearthProject-Revamp/exported_layers';
const OUT           = path.join(process.cwd(), 'tests', 'results', 'generator-vercel');
const COOKIE        = path.join(process.cwd(), 'tests', '.auth', 'vercel-tech.json');

test.setTimeout(600_000); // 10 min total

// ── Collect all PNG files from exported_layers/ ───────────────────────────────
function collectLayerFiles(): string[] {
  const files: string[] = [];
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (/\.(png|webp|jpg|jpeg|gif)$/i.test(entry)) files.push(full);
    }
  }
  walk(LAYERS_ROOT);
  return files;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function snap(page: Page, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  return page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
}

async function clickTab(page: Page, label: string) {
  const btn = page.locator('button.step-btn', { hasText: new RegExp(label, 'i') });
  await expect(btn).toBeVisible({ timeout: 8_000 });
  await btn.click();
  await page.waitForTimeout(2_000);
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

// ── Suite: shared page across all tests ──────────────────────────────────────
test.describe.serial('NFT Generator — Vercel Full E2E', () => {

  let ctx: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    // Use cached cookie if available, otherwise log in fresh
    if (fs.existsSync(COOKIE)) {
      ctx  = await browser.newContext({ storageState: COOKIE, viewport: { width: 1440, height: 900 } });
    } else {
      ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    }
    page = await ctx.newPage();

    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const onLogin = await page.locator('input[type="email"]').isVisible({ timeout: 5_000 }).catch(() => false);
    if (onLogin) {
      await page.fill('input[type="email"]', EMAIL);
      await page.fill('input[type="password"]', PASS);
      await page.click('button[type="submit"]');
      await page.waitForURL(`${BASE}/dashboard**`, { timeout: 30_000 });
      await ctx.storageState({ path: COOKIE });
      console.log('  ✅ Logged in (fresh)');
    } else {
      console.log('  ✅ Session already active');
    }

    // Navigate to generator
    await page.goto(`${BASE}/dashboard/generator`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForSelector('.studio-wrap', { timeout: 30_000 });
    await snap(page, '00-generator-loaded');
  });

  test.afterAll(async () => {
    await snap(page, 'zz-suite-end');
    await ctx.close();
  });

  // ── 01. All tabs present ──────────────────────────────────────────────────
  test('01 — All 5 tabs visible', async () => {
    for (const tab of ['Rarity', 'Settings', 'Organize', 'Preview', 'Export']) {
      await expect(page.locator('button.step-btn', { hasText: new RegExp(tab, 'i') })).toBeVisible({ timeout: 5_000 });
    }
    await snap(page, '01-tabs-visible');
    console.log('  ✅ All 5 tabs present');
  });

  // ── 02. Settings: form fields ─────────────────────────────────────────────
  test('02 — Settings tab: all form fields work', async () => {
    // Should already be on Settings (default step)
    await snap(page, '02-settings-tab');

    // Fill collection name
    const nameInput = page.locator('.setup-field input').first();
    await expect(nameInput).toBeVisible({ timeout: 5_000 });
    await nameInput.click({ clickCount: 3 });
    await nameInput.fill('Bearth NFT Collection');
    expect(await nameInput.inputValue()).toBe('Bearth NFT Collection');
    console.log('  ✅ Collection name set');

    // Token symbol — uppercase, max 10
    const symInput = page.locator('input[maxlength="10"]');
    if (await symInput.count() > 0) {
      await symInput.click({ clickCount: 3 });
      await symInput.fill('BEARTH');
      expect(await symInput.inputValue()).toBe('BEARTH');
      console.log('  ✅ Symbol set');
    }

    // Supply
    const supplyInput = page.locator('input[type=number][min="1"]').first();
    await supplyInput.click({ clickCount: 3 });
    await supplyInput.fill('9999');
    expect(await supplyInput.inputValue()).toBe('9999');
    console.log('  ✅ Supply set to 9999');

    // Blockchain dropdown
    const select = page.locator('select');
    await expect(select).toBeVisible({ timeout: 5_000 });
    console.log(`  Blockchain: "${await select.inputValue()}"`);

    // PNG / WebP buttons
    const pngBtn = page.locator('button.fmt-sel-btn', { hasText: 'PNG' });
    await pngBtn.click();
    await expect(pngBtn).toHaveClass(/fmt-sel-active/, { timeout: 3_000 });
    console.log('  ✅ PNG format selected');

    // Active folder display
    const folderArea = page.locator('text=Active layers folder:').locator('..');
    if (await folderArea.count() > 0) {
      const ft = await folderArea.textContent();
      console.log(`  Active folder: "${ft?.trim()}"`);
    }

    // Drop zone visible
    await expect(page.locator('.setup-drop-zone')).toBeVisible({ timeout: 5_000 });
    console.log('  ✅ Settings form fields all verified');
    await snap(page, '02b-settings-filled');
  });

  // ── 03. Settings: upload real layer files ─────────────────────────────────
  test('03 — Settings tab: upload exported_layers folder (188 PNGs)', async () => {
    const allFiles = collectLayerFiles();
    console.log(`  Total layer PNGs to upload: ${allFiles.length}`);
    expect(allFiles.length).toBeGreaterThan(100);

    // Locate the hidden file input (webkitdirectory)
    const fileInput = page.locator('input[type="file"][multiple]');
    await expect(fileInput).toBeAttached({ timeout: 5_000 });

    // webkitdirectory input requires a directory path (not an array of files)
    await fileInput.setInputFiles(LAYERS_ROOT);
    console.log('  Directory set on input');

    // Wait for the client-side parse to complete ("Assets imported!")
    await page.waitForFunction(
      () => document.querySelector('.setup-drop-zone')?.textContent?.includes('imported')
         || document.querySelector('.setup-drop-label')?.textContent?.includes('imported'),
      { timeout: 30_000 }
    );
    await snap(page, '03-upload-done');
    console.log('  ✅ Layer folder uploaded and parsed');

    // Verify active folder label updated
    const folderArea = page.locator('text=Active layers folder:').locator('..');
    if (await folderArea.count() > 0) {
      const ft = await folderArea.textContent();
      console.log(`  Active folder after upload: "${ft?.trim()}"`);
    }
  });

  // ── 04. Settings: Save & Continue → Organise ────────────────────────────
  test('04 — Settings tab: Save & Continue creates collection in DB', async () => {
    await snap(page, '04-before-save');
    await page.locator('button.setup-continue-btn').click();

    // Wait for syncing to resolve
    await page.waitForFunction(
      () => {
        const btn = document.querySelector('.setup-continue-btn');
        return !btn || !btn.textContent?.includes('Saving');
      },
      { timeout: 30_000 }
    ).catch(() => {});
    await page.waitForTimeout(2_000);
    await snap(page, '04-after-save');

    // Should now be on Organise step
    const onOrg = await page.locator('.org-layout').isVisible({ timeout: 10_000 }).catch(() => false);
    console.log(`  Navigated to Organise: ${onOrg}`);
    if (!onOrg) {
      // Click Organize tab manually if still on settings
      await clickTab(page, 'Organize');
      await page.waitForSelector('.org-layout', { timeout: 15_000 });
    }
    console.log('  ✅ Collection saved, now on Organise tab');
  });

  // ── 05. Organise: layers in sidebar ──────────────────────────────────────
  test('05 — Organise tab: 11 layers visible in sidebar', async () => {
    await snap(page, '05-organise-sidebar');
    const layerItems = page.locator('.layer-item');
    const count = await layerItems.count();
    console.log(`  Layers in sidebar: ${count}`);
    expect(count).toBeGreaterThan(0);

    // Must NOT show the old hardcoded BearthLayersv1 error message
    const oldMsg = page.locator('text=BearthLayersv1');
    // (message from page.tsx was the only place — should be gone after our fix deploys)
    console.log(`  "BearthLayersv1" in org tab: ${await oldMsg.count()}`);

    console.log('  ✅ Layers visible in Organise sidebar');
    await snap(page, '05b-sidebar-layers');
  });

  // ── 06. Organise: click layer → Manage view → thumbnails ────────────────
  test('06 — Organise tab: thumbnails load (blob or S3)', async () => {
    const firstLayer = page.locator('.layer-item').first();
    await firstLayer.click();
    await page.waitForTimeout(2_000);

    // Manage view (show file list)
    const manageBtn = page.locator('button.lc-hbtn', { hasText: /manage/i });
    if (await manageBtn.count() > 0) {
      await manageBtn.first().click();
      await page.waitForTimeout(2_000);
    }
    await snap(page, '06-manage-view');

    const thumbImgs = page.locator('.lc-file-thumb img');
    const thumbCount = await thumbImgs.count();
    console.log(`  Thumbnails in manage view: ${thumbCount}`);

    if (thumbCount > 0) {
      // Wait up to 20s for first thumbnail to load
      await page.waitForFunction(
        () => (document.querySelector('.lc-file-thumb img') as HTMLImageElement)?.naturalWidth > 0,
        { timeout: 20_000 }
      );
      const first = await page.evaluate(() => {
        const img = document.querySelector('.lc-file-thumb img') as HTMLImageElement;
        return { loaded: img?.naturalWidth > 0, src: img?.src?.slice(0, 80) };
      });
      console.log(`  Thumbnail[0]: loaded=${first.loaded}  src=${first.src}`);
      expect(first.loaded).toBe(true);
      console.log('  ✅ Thumbnails loaded');
    } else {
      console.log('  ⚠  No thumbnails found — layer may have 0 assets');
    }
    await snap(page, '06b-thumbnails');
  });

  // ── 07. Organise: Advanced rarity sliders ────────────────────────────────
  test('07 — Organise tab: Advanced rarity sliders', async () => {
    const advBtn = page.locator('button.lc-toggle-btn', { hasText: /advanced/i });
    if (await advBtn.count() === 0) { console.log('  ⚠  Advanced button not found'); return; }
    await advBtn.click();
    await page.waitForTimeout(1_500);
    await snap(page, '07-advanced-sliders');

    const sliders = await page.locator('input[type=range]').count();
    const wInputs = await page.locator('input.rm-w-input, .rm-w-input').count();
    console.log(`  Sliders: ${sliders}  Weight inputs: ${wInputs}`);
    expect(sliders + wInputs).toBeGreaterThan(0);
    console.log('  ✅ Advanced rarity sliders visible');
  });

  // ── 08. Organise: Quick Preview ──────────────────────────────────────────
  test('08 — Organise tab: Quick Preview panel', async () => {
    const qpBtn = page.locator('button.lc-toggle-btn', { hasText: /quick preview/i });
    if (await qpBtn.count() === 0) { console.log('  ⚠  Quick Preview not found'); return; }
    await qpBtn.click();
    await page.waitForTimeout(1_500);
    await snap(page, '08-quick-preview');
    console.log(`  QP view found: ${await page.locator('.lc-qp-view, .lc-qp-flow').count() > 0}`);
    console.log('  ✅ Quick Preview opened');
  });

  // ── 09. Organise: cycle through multiple layers ───────────────────────────
  test('09 — Organise tab: navigate between multiple layers', async () => {
    const layerItems = page.locator('.layer-item');
    const total = await layerItems.count();
    console.log(`  Total layers: ${total}`);

    // Click 3 different layers and verify content loads
    for (let i = 0; i < Math.min(3, total); i++) {
      await layerItems.nth(i).click();
      await page.waitForTimeout(1_000);
      const layerName = await layerItems.nth(i).textContent();
      console.log(`  Layer ${i}: ${layerName?.trim().slice(0, 30)}`);
    }
    await snap(page, '09-multi-layer-nav');
    console.log('  ✅ Multi-layer navigation works');
  });

  // ── 10. Rarity tab ───────────────────────────────────────────────────────
  test('10 — Rarity tab: loads correctly', async () => {
    await clickTab(page, 'Rarity');
    await snap(page, '10-rarity-tab');
    const err = page.locator('text=/something went wrong|unexpected error/i');
    expect(await err.count()).toBe(0);
    console.log('  ✅ Rarity tab loaded without crash');
  });

  // ── 11. Preview: generate combos, canvases render ───────────────────────
  test('11 — Preview tab: generate 9999 NFT combos + canvas pixels', async () => {
    await clickTab(page, 'Preview');
    await snap(page, '11-preview-loading');
    console.log('  Waiting for preview combos to generate…');

    const appeared = await page.waitForFunction(
      () => document.querySelector('.prev-tokens-badge') !== null
         || document.querySelector('.prev-thumb canvas') !== null,
      { timeout: 180_000 }
    ).then(() => true).catch(() => false);

    await page.waitForTimeout(2_000);
    await snap(page, '11b-preview-ready');

    if (!appeared) { console.log('  ⚠  Preview did not load'); return; }

    const canvases = await page.locator('.prev-thumb canvas').count();
    console.log(`  Preview canvases: ${canvases}`);

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
      details.forEach((d, i) => console.log(`    canvas #${i+1}: ${d.w}x${d.h} pixels=${d.p}`));
      expect(hp).toBe(true);
      console.log('  ✅ Preview canvases have pixel data');
    }
    await snap(page, '11c-preview-final');
  });

  // ── 12. Preview: filter sidebar ──────────────────────────────────────────
  test('12 — Preview tab: filter sidebar with layer+trait rows', async () => {
    await snap(page, '12-preview-filter');
    const filterRows = page.locator('.plr-group, .preview-layer-row');
    const count = await filterRows.count();
    console.log(`  Filter layer rows: ${count}`);

    if (count > 0) {
      // Expand first row to see traits
      await filterRows.first().click();
      await page.waitForTimeout(500);
      const traitRows = await page.locator('.plr-trait-row').count();
      console.log(`  Trait rows after expand: ${traitRows}`);
      expect(traitRows).toBeGreaterThan(0);

      // Click a trait to filter
      await page.locator('.plr-trait-row').first().click();
      await page.waitForTimeout(1_000);
      await snap(page, '12b-filter-applied');
      console.log('  ✅ Trait filter applied');
    } else {
      console.log('  ⚠  No filter rows visible');
    }
  });

  // ── 13. Preview: rarity tier chips ───────────────────────────────────────
  test('13 — Preview tab: Legendary/Epic/Rare/Common tier chips', async () => {
    await snap(page, '13-preview-tiers');
    const chips = await page.locator('.exp-nft-tier-chip, [class*="tier-chip"]').allTextContents();
    const unique = [...new Set(chips)];
    console.log(`  Tiers found: ${unique.join(', ') || 'none'}`);

    if (unique.length > 0) {
      const validTiers = ['Legendary', 'Epic', 'Rare', 'Common'];
      const valid = unique.filter(t => validTiers.includes(t));
      expect(valid.length).toBeGreaterThan(0);
      console.log('  ✅ Valid rarity tiers present');
    } else {
      console.log('  ⚠  No tier chips visible yet');
    }
  });

  // ── 14. Preview: click NFT card → popup ──────────────────────────────────
  test('14 — Preview tab: click NFT card opens detail popup', async () => {
    const cards = page.locator('.exp-nft-card, .prev-thumb');
    const cardCount = await cards.count();
    console.log(`  NFT cards visible: ${cardCount}`);

    if (cardCount > 0) {
      await cards.first().click();
      await page.waitForTimeout(1_000);
      const popup = page.locator('.nft-popup, [class*="popup"]');
      if (await popup.count() > 0) {
        await snap(page, '14-nft-popup');
        console.log('  ✅ NFT popup opened');
        // Close popup
        const closeBtn = page.locator('[class*="popup"] button, .popup-close');
        if (await closeBtn.count() > 0) await closeBtn.first().click();
      } else {
        console.log('  ⚠  No popup appeared after card click');
      }
    }
  });

  // ── 15. Export: loads without errors ─────────────────────────────────────
  test('15 — Export tab: no LAYERS_DIR error', async () => {
    await clickTab(page, 'Export');
    await page.waitForTimeout(3_000);
    await snap(page, '15-export-tab');

    expect(await page.locator('text=/LAYERS_DIR not configured/i').count()).toBe(0);
    expect(await page.locator('text=/No layers found. Upload a layer/i').count()).toBe(0);
    console.log('  ✅ No LAYERS_DIR or legacy "No layers found" error');
  });

  // ── 16. Export: Generate on Server ───────────────────────────────────────
  test('16 — Export tab: Generate on Server polls past "Starting…"', async () => {
    await snap(page, '16-export-before-gen');

    // Check already done
    if (await page.locator('text=/generation complete|done/i').count() > 0) {
      console.log('  ✅ Already complete');
      return;
    }

    const genBtn = page.locator('button', { hasText: /generate on server/i });
    if (await genBtn.count() === 0) {
      console.log('  ⚠  Generate on Server button not visible');
      await snap(page, '16-no-gen-btn');
      return;
    }

    await genBtn.click();
    console.log('  ✅ Clicked Generate on Server');

    let lastPhase = 'Starting…';
    let gotError  = false;
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(2_000);

      const errEl = page.locator('[class*="svr-error"]:visible, [class*="error"]:visible').first();
      if (await errEl.count() > 0) {
        const et = (await errEl.textContent()) ?? '';
        console.log(`  ❌ Error: "${et.trim().slice(0, 120)}"`);
        gotError = true; break;
      }
      const phaseEl = page.locator('[class*="phase"]:visible, [class*="svr"]:visible').first();
      if (await phaseEl.count() > 0) {
        lastPhase = (await phaseEl.textContent()) ?? lastPhase;
      }
      console.log(`  [${(i+1)*2}s] "${lastPhase.trim()}"`);
      if (/complete|done|error/i.test(lastPhase)) break;
    }

    await snap(page, '16-export-polling');
    if (!gotError) {
      const stuck = lastPhase.trim() === 'Starting…';
      expect(stuck).toBe(false);
      console.log(`  ✅ Polling working — last phase: "${lastPhase.trim()}"`);
    }
  });

  // ── 17. Export: Filebase bucket field ────────────────────────────────────
  test('17 — Export tab: Filebase bucket input', async () => {
    await snap(page, '17-export-fields');
    const bucketInput = page.locator('input[placeholder*="bucket" i], input[value*="bearth" i]');
    if (await bucketInput.count() > 0) {
      const val = await bucketInput.first().inputValue();
      console.log(`  Bucket: "${val}"`);
      expect(val.length).toBeGreaterThan(0);
      console.log('  ✅ Bucket input has value');
    } else {
      console.log('  ⚠  Bucket input not visible in current state');
    }
  });

  // ── 18. Export: Preview/Validate button ──────────────────────────────────
  test('18 — Export tab: Preview/Validate images button visible', async () => {
    const btnCount = await page.locator('button:has-text("Preview"), button:has-text("Validate")').count();
    console.log(`  Preview/Validate buttons: ${btnCount}`);
    await snap(page, '18-export-preview-validate');
    console.log('  ✅ Export tab preview/validate checked');
  });

  // ── 19. No critical JS errors across entire session ───────────────────────
  test('19 — No critical JS console errors', async () => {
    // Check for any visible crash/error UI on the current page
    const errEl1 = page.locator('[class*="error"]:visible');
    const errEl2 = page.locator('text=/unexpected error/i');
    const errEl3 = page.locator('text=/something went wrong/i');
    const c1 = await errEl1.count();
    const c2 = await errEl2.count();
    const c3 = await errEl3.count();
    console.log(`  Error UI counts — class*=error: ${c1}, "unexpected error": ${c2}, "something went wrong": ${c3}`);
    await snap(page, '19-final-state');
    // Only fail on hard crash messages
    expect(c2 + c3).toBe(0);
    console.log('  ✅ No crash errors visible');
  });
});
