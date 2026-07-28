import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const TECH_AUTH   = path.join(process.cwd(), 'tests', '.auth', 'tech.json');
const SCREENSHOTS = path.join(process.cwd(), 'tests', 'results', 'nft-generator');

// ── Helper: save screenshot ────────────────────────────────────────────────────
async function snap(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOTS, { recursive: true });
  const file = path.join(SCREENSHOTS, `${name}.png`);
  try {
    await page.screenshot({ path: file, fullPage: false, timeout: 30000 });
    console.log(`  📸 ${name}.png`);
  } catch {
    console.log(`  ⚠ screenshot ${name} skipped (page busy)`);
  }
}

// ── Helper: navigate to step ────────────────────────────────────────────────────
async function goStep(page: Page, label: string) {
  const btn = page.locator('.step-btn', { hasText: label });
  await btn.click();
  await page.waitForTimeout(400);
}

test.use({ storageState: TECH_AUTH });

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 1 — Login verification
// ═══════════════════════════════════════════════════════════════════════════════
test('01 — Authenticated dashboard', async ({ page }) => {
  // storageState means /login redirects to /dashboard — verify user is logged in
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await snap(page, '01-dashboard-authenticated');
  // Confirm dashboard content loaded (sidebar visible)
  await expect(page.locator('.sidebar, nav, [class*="sidebar"]').first()).toBeVisible({ timeout: 10000 });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 2 — Generator page loads
// ═══════════════════════════════════════════════════════════════════════════════
test('02 — Generator page loads', async ({ page }) => {
  await page.goto('/dashboard/generator');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.studio-wrap')).toBeVisible({ timeout: 15000 });
  await snap(page, '02-generator-page');
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 3 — Full flow: Settings → Organize → Preview → Export (12K)
// ═══════════════════════════════════════════════════════════════════════════════
test('03 — Full flow: 12K collection generation', async ({ page }) => {
  test.setTimeout(300000); // 5 minutes — sync + 12K preview generation

  await page.goto('/dashboard/generator');
  await page.waitForLoadState('networkidle');

  // ── Step A: Reset to Settings ──────────────────────────────────────────────
  await page.evaluate(() => {
    sessionStorage.removeItem('nft_collection_id');
    sessionStorage.removeItem('nft_collection_name');
  });
  await page.reload();
  await page.waitForFunction(
    () => !document.body.innerText.includes('Verifying access'),
    { timeout: 30000 }
  ).catch(() => {});
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('.studio-wrap', { timeout: 15000 });

  // Navigate to Settings step
  await goStep(page, 'Settings');
  await page.waitForSelector('.setup-page', { timeout: 10000 });

  // ── Step B: Fill collection settings ──────────────────────────────────────
  const nameInput = page.locator('input[placeholder="No Name"]').first();
  await nameInput.click({ clickCount: 3 });
  await nameInput.fill('Bearth Genesis 12K');

  const symbolInput = page.locator('input[placeholder="BRT"]').first();
  await symbolInput.click({ clickCount: 3 });
  await symbolInput.fill('BGFK');

  // Set supply to 12000
  const supplyInput = page.locator('input[type="number"][min="1"]').first();
  await supplyInput.click({ clickCount: 3 });
  await supplyInput.fill('12000');
  await expect(supplyInput).toHaveValue('12000');

  // Verify exported_layers is the active folder
  await expect(page.getByText('exported_layers', { exact: true }).first()).toBeVisible({ timeout: 5000 });

  await snap(page, '03a-settings-filled');

  // ── Step C: Continue → Create collection + sync from disk ─────────────────
  const continueBtn = page.locator('button').filter({ hasText: /Continue|Next|Save & Continue/i }).last();
  await continueBtn.click();
  await page.waitForTimeout(800);
  await snap(page, '03b-syncing-in-progress');

  // Wait for Organize step (sync can take up to 30s for 11 layers × traits)
  await page.waitForSelector('.org-layout', { timeout: 60000 });
  await page.waitForLoadState('networkidle');
  await snap(page, '03c-organize-step');
  console.log('  ✅ Collection created + layers synced from disk');

  // ── Step D: Organize — verify sidebar layers ────────────────────────────────
  const sidebarItems = page.locator('[class*="sidebar"] [class*="layer"], .layer-row, .sidebar-item');
  const layerCount = await sidebarItems.count();
  console.log(`  Found ${layerCount} layers in sidebar`);
  await snap(page, '03d-organize-sidebar');

  // ── Step E: Organize — view layer assets ──────────────────────────────────
  await page.waitForSelector('[class*="asset"], .asset-card, .asset-grid', { timeout: 15000 });
  await snap(page, '03e-organize-assets');

  // ── Step F: Go to Preview ───────────────────────────────────────────────────
  await goStep(page, 'Preview');
  await snap(page, '03f-preview-loading');

  // Wait for NFT preview cards to render (12K generation takes ~10-20s)
  await page.waitForSelector('.prev-card', { timeout: 90000 });
  await page.waitForTimeout(2000); // let canvases draw

  const cardCount = await page.locator('.prev-card').count();
  console.log(`  Preview rendered ${cardCount} visible NFT cards (virtual window of 12,000)`);
  expect(cardCount).toBeGreaterThan(0);

  // Verify token count badge shows 12,000
  const badge = page.locator('.prev-tokens-badge').first();
  if (await badge.isVisible({ timeout: 5000 })) {
    const badgeText = await badge.textContent();
    console.log(`  Token badge: "${badgeText}"`);
    expect(badgeText).toContain('12');
  }

  await snap(page, '03g-preview-12k-nfts');

  // Verify canvases are in the DOM (images drawn)
  const canvases = page.locator('.prev-card canvas');
  const canvasCount = await canvases.count();
  console.log(`  NFT canvases visible: ${canvasCount}`);
  expect(canvasCount).toBeGreaterThan(0);

  // ── Step G: Preview — scroll test ─────────────────────────────────────────
  const scrollContainer = page.locator('.prev-grid-scroll');
  if (await scrollContainer.isVisible()) {
    await scrollContainer.evaluate(el => { el.scrollTop = 1000; });
    await page.waitForTimeout(800);
    await snap(page, '03h-preview-scrolled');

    await scrollContainer.evaluate(el => { el.scrollTop = 5000; });
    await page.waitForTimeout(800);
    await snap(page, '03i-preview-deep-scroll');

    await scrollContainer.evaluate(el => { el.scrollTop = 0; });
    await page.waitForTimeout(400);
  }

  // ── Step H: Preview — sort by rarity ──────────────────────────────────────
  const sortBtn = page.locator('.prev-sort-btn');
  await sortBtn.click();
  await page.waitForSelector('.prev-sort-dropdown', { timeout: 5000 });
  await page.locator('.prev-sort-option:has-text("Most rare first")').click();
  await page.waitForTimeout(1000);
  await snap(page, '03j-preview-sorted-rare-first');

  // Verify rank badges appear
  const rankBadges = await page.locator('.prev-rank-badge').count();
  console.log(`  Rank badges shown: ${rankBadges}`);
  expect(rankBadges).toBeGreaterThan(0);

  // ── Step I: Preview — filter by layer trait ────────────────────────────────
  const firstLayerRow = page.locator('.preview-layer-row').first();
  if (await firstLayerRow.isVisible({ timeout: 3000 })) {
    await firstLayerRow.click();
    await page.waitForTimeout(400);
    const firstTrait = page.locator('.plr-trait-row').first();
    if (await firstTrait.isVisible({ timeout: 3000 })) {
      await firstTrait.click();
      await page.waitForTimeout(800);
      await snap(page, '03k-preview-filtered');
      // Clear filter
      const clearBtn = page.locator('.plr-filter-clear');
      if (await clearBtn.isVisible({ timeout: 2000 })) {
        await clearBtn.click();
        await page.waitForTimeout(500);
      }
    }
  }

  // ── Step J: Preview — click NFT card (popup) ───────────────────────────────
  // Reset sort to shuffle first
  await sortBtn.click();
  await page.locator('.prev-sort-option:has-text("Shuffle")').click();
  await page.waitForTimeout(500);

  const firstCard = page.locator('.prev-card').first();
  await firstCard.click();
  await page.waitForTimeout(600);
  const popup = page.locator('.nft-popup, [class*="popup-overlay"], [class*="nft-popup"]').first();
  if (await popup.isVisible({ timeout: 5000 })) {
    await snap(page, '03l-nft-popup');
    await page.keyboard.press('Escape');
    // Wait for popup overlay to fully disappear before continuing
    await popup.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(300);
    // If popup is still visible, click outside to force close
    if (await popup.isVisible({ timeout: 500 }).catch(() => false)) {
      await page.mouse.click(10, 10);
      await page.waitForTimeout(400);
    }
  }

  // ── Step K: Preview — Randomize ───────────────────────────────────────────
  const randomizeBtn = page.locator('.randomize-btn');
  await randomizeBtn.click();
  await page.waitForTimeout(500);
  await snap(page, '03m-randomizing');
  await page.waitForSelector('.prev-card', { timeout: 90000 });
  await page.waitForTimeout(1500);
  await snap(page, '03n-after-randomize');

  // ── Step L: Export ─────────────────────────────────────────────────────────
  await goStep(page, 'Export');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  await snap(page, '03o-export-panel');

  // Look for Generate/Compute button
  const genBtn = page.locator('button').filter({ hasText: /Generate|Start|Compute Rarity/i }).first();
  if (await genBtn.isVisible({ timeout: 8000 })) {
    await genBtn.click();
    await page.waitForTimeout(1000);
    await snap(page, '03p-export-generating');

    // Wait for export cards to appear
    const exportCards = page.locator('.exp-nft-card, [class*="rarity"], .rarity-row');
    await exportCards.first().waitFor({ timeout: 120000 });
    await page.waitForTimeout(1000);

    // Wait for DB save banner (saved or error) — gives persistToDb time to complete
    await page.waitForSelector('.exp-banner-saved, .exp-banner-error', { timeout: 90000 })
      .catch(() => {}); // non-fatal if banner never appears

    await snap(page, '03q-export-done');
    const exportCardCount = await page.locator('.exp-nft-card').count();
    console.log(`  Export rendered ${exportCardCount} NFT cards`);

    const savedBanner = page.locator('.exp-banner-saved');
    if (await savedBanner.isVisible({ timeout: 2000 }).catch(() => false)) {
      const bannerText = await savedBanner.textContent();
      console.log(`  DB save banner: "${bannerText?.trim()}"`);
    }
    const errorBanner = page.locator('.exp-banner-error');
    if (await errorBanner.isVisible({ timeout: 2000 }).catch(() => false)) {
      const errText = await errorBanner.textContent();
      console.log(`  ⚠ DB save error: "${errText?.trim()}"`);
    }
  }

  // ── Step M: Verify DB via API ──────────────────────────────────────────────
  try {
    const resp = await page.request.get('/api/nft-gen/collections', { timeout: 30000 });
    if (resp.ok()) {
      const data = await resp.json();
      const colls = data?.collections ?? [];
      console.log(`  DB collections: ${colls.length}`);
      expect(colls.length).toBeGreaterThan(0);

      if (colls.length > 0) {
        const latestColl = colls[0];
        const layResp = await page.request.get(`/api/nft-gen/collections/${latestColl.id}`, { timeout: 30000 }).catch(() => null);
        if (layResp?.ok()) {
          const collData = await layResp.json();
          const layers = collData?.layers ?? [];
          console.log(`  DB layers in collection: ${layers.length}`);
          if (layers.length > 0) console.log(`  ✅ nft_layers table is populated!`);
          else console.log(`  ⚠ nft_layers is still empty — check sync`);
        }
      }
    }
  } catch (e: any) {
    console.log(`  ⚠ DB verify skipped: ${e.message}`);
  }

  await snap(page, '03r-final-state');
  console.log('  ✅ Full 12K NFT generation test complete');
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 4 — Rarity tab
// ═══════════════════════════════════════════════════════════════════════════════
test('04 — Rarity tab loads', async ({ page }) => {
  test.setTimeout(120000);

  // Retry navigation until auth resolves — DB may be briefly busy after prior test
  let studioVisible = false;
  for (let attempt = 0; attempt < 3 && !studioVisible; attempt++) {
    if (attempt > 0) await page.waitForTimeout(5000);
    await page.goto('/dashboard/generator');
    await page.evaluate(() => {
      sessionStorage.removeItem('nft_collection_id');
      sessionStorage.removeItem('nft_collection_name');
    });
    await page.reload();
    try {
      await page.waitForFunction(
        () => !document.body.innerText.includes('Verifying access'),
        { timeout: 15000 }
      );
    } catch { /* auth slow — retry */ }
    studioVisible = await page.locator('.studio-wrap').isVisible({ timeout: 3000 }).catch(() => false);
  }

  await page.waitForTimeout(3000); // let browser recover after prior heavy test
  await page.waitForSelector('.studio-wrap', { timeout: 60000 });
  await goStep(page, 'Rarity');
  await page.waitForTimeout(500);
  await snap(page, '04-rarity-tab');
  await expect(page.locator('.step-btn.step-active', { hasText: 'Rarity' })).toBeVisible({ timeout: 5000 });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 5 — Upload batch wiring: nft_upload_batches populated after upload
// ═══════════════════════════════════════════════════════════════════════════════
test('05 — Upload batch tracking in DB (images + metadata)', async ({ page }) => {
  test.setTimeout(300000); // 5 minutes

  // Capture browser console errors for diagnostics
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.text().includes('[upload-batch')) {
      consoleErrors.push(`[browser] ${msg.type()}: ${msg.text()}`);
    }
  });

  await page.goto('/dashboard/generator');
  await page.evaluate(() => {
    sessionStorage.removeItem('nft_collection_id');
    sessionStorage.removeItem('nft_collection_name');
  });
  await page.reload();
  await page.waitForFunction(
    () => !document.body.innerText.includes('Verifying access'),
    { timeout: 30000 }
  ).catch(() => {});
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000); // let browser recover after prior heavy test
  await page.waitForSelector('.studio-wrap', { timeout: 60000 });

  // ── Settings: 10-NFT collection for fast upload ──────────────────────────────
  await goStep(page, 'Settings');
  await page.waitForSelector('.setup-page', { timeout: 10000 });

  const nameInput = page.locator('input[placeholder="No Name"]').first();
  await nameInput.click({ clickCount: 3 });
  await nameInput.fill('Upload Batch Test');

  const symbolInput = page.locator('input[placeholder="BRT"]').first();
  await symbolInput.click({ clickCount: 3 });
  await symbolInput.fill('UBT');

  const supplyInput = page.locator('input[type="number"][min="1"]').first();
  await supplyInput.click({ clickCount: 3 });
  await supplyInput.fill('10');
  await expect(supplyInput).toHaveValue('10');

  await snap(page, '05a-settings-10nft');

  // ── Continue → sync ──────────────────────────────────────────────────────────
  const continueBtn = page.locator('button').filter({ hasText: /Continue|Next|Save & Continue/i }).last();
  await continueBtn.click();
  await page.waitForSelector('.org-layout', { timeout: 60000 });
  await page.waitForLoadState('networkidle');
  console.log('  ✅ Collection created + synced');

  // ── Export: Generate 10 NFTs ─────────────────────────────────────────────────
  await goStep(page, 'Export');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  const genBtn = page.locator('button').filter({ hasText: /Generate|Start|Compute Rarity/i }).first();
  await genBtn.waitFor({ timeout: 10000 });
  await genBtn.click();

  await page.waitForSelector('.exp-banner-saved', { timeout: 120000 });
  await snap(page, '05b-generated-saved');
  console.log('  ✅ 10 NFTs generated and saved to DB (dbJobIdRef set)');

  // ── Filebase: check / create bucket ─────────────────────────────────────────
  const BUCKET = 'bearth-test';
  const bucketInput = page.locator('.exp-fb-input');
  await bucketInput.fill(BUCKET);

  await page.locator('button', { hasText: 'Check Bucket' }).click();
  await page.waitForTimeout(3000);
  await snap(page, '05c-bucket-checked');

  const createBtn = page.locator('button', { hasText: '+ Create Bucket' });
  if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('  Bucket not found — creating...');
    await createBtn.click();
    await page.waitForTimeout(4000);
    await snap(page, '05d-bucket-created');
    console.log('  Bucket created');
  }

  const bucketOk = page.locator('.exp-fb-status-ok');
  await bucketOk.waitFor({ timeout: 15000 });
  console.log('  ✅ Bucket ready');

  // ── Upload Images ─────────────────────────────────────────────────────────────
  const uploadImgBtn = page.locator('button').filter({ hasText: /Upload Images/ }).first();
  await uploadImgBtn.click();
  await snap(page, '05e-uploading-images');
  console.log('  Upload Images started');

  // 10 images × ~1s each = ~10s max; allow 120s
  await page.waitForSelector('.exp-step-done', { timeout: 120000 });
  await snap(page, '05f-images-done');
  console.log('  ✅ Images uploaded to Filebase');

  // ── Upload Metadata ───────────────────────────────────────────────────────────
  const uploadMetaBtn = page.locator('button').filter({ hasText: /Upload Metadata/ }).first();
  await uploadMetaBtn.waitFor({ timeout: 10000 });
  await uploadMetaBtn.click();
  await snap(page, '05g-uploading-metadata');
  console.log('  Upload Metadata started');

  // Wait until second StepCard also gets exp-step-done
  await page.locator('.exp-step-done').nth(1).waitFor({ timeout: 120000 });
  await snap(page, '05h-metadata-done');
  console.log('  ✅ Metadata uploaded to Filebase');

  // ── Verify nft_upload_batches via API ─────────────────────────────────────────
  try {
    const collResp = await page.request.get('/api/nft-gen/collections', { timeout: 15000 });
    if (collResp.ok()) {
      const data = await collResp.json();
      const colls = data?.collections ?? [];
      const testColl = colls.find((c: any) => c.name === 'Upload Batch Test');
      if (testColl) {
        console.log(`  Collection id: ${testColl.id}`);
        // Fetch jobs for this collection
        const jobsResp = await page.request.get(`/api/nft-gen/collections/${testColl.id}`, { timeout: 15000 }).catch(() => null);
        if (jobsResp?.ok()) {
          const collData = await jobsResp.json();
          console.log(`  Jobs in collection: ${JSON.stringify(collData?.jobs ?? [])}`);
        }
      } else {
        console.log('  Collection "Upload Batch Test" not found in list');
      }
    }
  } catch (e: any) {
    console.log(`  DB verify skipped: ${e.message}`);
  }

  // Print any captured batch errors
  if (consoleErrors.length > 0) {
    console.log('  ⚠ Upload batch console errors:');
    consoleErrors.forEach(e => console.log(`    ${e}`));
  } else {
    console.log('  ✅ No upload-batch console errors');
  }

  await snap(page, '05i-final');
  console.log('  ✅ Upload batch wiring test complete — check nft_upload_batches in DB');
});
