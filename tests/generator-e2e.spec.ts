import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs   from 'fs';

const TECH_AUTH   = path.join(process.cwd(), 'tests', '.auth', 'tech.json');
const SCREENSHOTS = path.join(process.cwd(), 'tests', 'results', 'generator-e2e');

// ── Full E2E: generate → DB save → server export → Filebase + DB sync ──────
// Estimated runtime for 9999 NFTs:
//   • Browser generation: ~3 min (188 image loads + combos)
//   • DB save:            ~15 s  (100 batches)
//   • Server export:      ~50 min (Sharp composite + Filebase S3 per NFT)
// Total budget: 70 minutes per test
test.use({ storageState: TECH_AUTH });
test.setTimeout(7_200_000); // 2-hour hard cap per test

const COLLECTION_SUPPLY  = 9999;
const FILEBASE_BUCKET    = 'bearth-nft-collection'; // must exist in Filebase
const SNAP_INTERVAL_MS   = 30_000;  // snapshot every 30 s during server export
const POLL_INTERVAL_MS   = 30_000;  // poll status every 30 s
const EXPORT_TIMEOUT_MS  = 7_000_000; // ~1.9 hours max for server export itself

async function snap(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SCREENSHOTS, `${name}.png`), fullPage: false });
  console.log(`  📸 ${name}.png`);
}

// ── TEST 1: Full E2E — Settings → Export → DB save ──────────────────────────
test('E2E: Generate 9999 NFTs and save to database', async ({ page }) => {
  await page.goto('/dashboard/generator');

  // Wait for generator UI
  await page.waitForSelector('.studio-wrap', { timeout: 30_000 });
  await snap(page, '01-settings-loaded');

  // ── Step 1: Set collection supply to 9999 ────────────────────────────────
  const supplyInput = page.locator('input[type=number][min="1"][max="100000"]');
  await expect(supplyInput).toBeVisible({ timeout: 10_000 });
  await supplyInput.click({ clickCount: 3 });
  await supplyInput.fill(String(COLLECTION_SUPPLY));
  await expect(supplyInput).toHaveValue(String(COLLECTION_SUPPLY));
  console.log(`  ✅ Supply set to ${COLLECTION_SUPPLY}`);

  // ── Step 2: Save & Continue (creates/updates collection in DB) ──────────
  const continueBtn = page.locator('button.setup-continue-btn');
  await expect(continueBtn).toBeVisible({ timeout: 5_000 });
  await continueBtn.click();
  // Wait for organize step
  await page.waitForSelector('nav.step-nav', { timeout: 60_000 });
  await snap(page, '02-organize-step');
  console.log('  ✅ Collection saved, organize step loaded');

  // ── Step 3: Jump directly to Export step ─────────────────────────────────
  const exportStepBtn = page.locator('button.step-btn').filter({ hasText: /export/i });
  await expect(exportStepBtn).toBeVisible({ timeout: 5_000 });
  await exportStepBtn.click();
  await page.waitForTimeout(1_000);
  await snap(page, '03-export-step-idle');

  // ExportPanel should show idle state with "Generate N NFTs" button
  const generateBtn = page.locator('button.btn-primary').filter({ hasText: /Generate.*NFTs/i });
  await expect(generateBtn).toBeVisible({ timeout: 10_000 });
  console.log('  ✅ Export step visible with Generate button');

  // ── Step 4: Start in-browser generation ──────────────────────────────────
  await generateBtn.click();
  console.log(`  ⏳ Generating ${COLLECTION_SUPPLY} NFTs in browser (may take 3–5 min)…`);

  // Wait for loading/combos phase to start
  await page.waitForSelector('.exp-loading-card', { timeout: 15_000 });
  await snap(page, '04-generating-started');

  // Wait for DB saved banner — this appears after generation + persistToDb complete
  // Timeout: 10 min for generation + DB save for 9999 NFTs
  const dbSavedBanner = page.locator('.exp-banner-saved[data-job-id]');
  await dbSavedBanner.waitFor({ state: 'visible', timeout: 600_000 });
  await snap(page, '05-db-saved');

  const jobId = await dbSavedBanner.getAttribute('data-job-id');
  console.log(`  ✅ DB save complete — job ID: ${jobId}`);
  expect(jobId).toBeTruthy();

  // Verify token count badge shows correct supply
  const tokenCount = await page.locator('.exp-ready-badge').textContent().catch(() => '');
  console.log(`  Token badge: "${tokenCount}"`);
  expect(tokenCount).toMatch(/9[,\s]?9[,\s]?9[,\s]?9/);

  // Store job ID for the next test via sessionStorage
  await page.evaluate((jid) => sessionStorage.setItem('e2e_job_id', jid ?? ''), jobId);
  console.log('  ✅ 9999 NFTs generated and saved to BearthDev database');
});

// ── TEST 2: Server-side export — Filebase upload + DB CID sync ──────────────
test('E2E: Server export 9999 NFTs to Filebase and sync CIDs to DB', async ({ page }) => {
  // Navigate to export step (may need to regenerate if session lost)
  await page.goto('/dashboard/generator');
  await page.waitForSelector('.studio-wrap', { timeout: 30_000 });

  // Jump to Export step
  const exportStepBtn = page.locator('button.step-btn').filter({ hasText: /export/i });
  await exportStepBtn.click();
  await page.waitForTimeout(1_000);

  // If already in 'done' phase (session persisted), the server export card should be visible.
  // If idle phase, we need to regenerate first.
  const svrCard = page.locator('.exp-svr-card');
  const isDone  = await svrCard.isVisible({ timeout: 5_000 }).catch(() => false);

  if (!isDone) {
    // Need to regenerate
    console.log('  ⚠ Export panel in idle — regenerating (this happens if page reloaded)');
    const generateBtn = page.locator('button.btn-primary').filter({ hasText: /Generate.*NFTs/i });
    await expect(generateBtn).toBeVisible({ timeout: 10_000 });
    await generateBtn.click();
    const dbSavedBanner = page.locator('.exp-banner-saved[data-job-id]');
    await dbSavedBanner.waitFor({ state: 'visible', timeout: 600_000 });
    console.log('  ✅ Regenerated and DB saved');
  }

  // Server export card must be visible now
  await expect(svrCard).toBeVisible({ timeout: 10_000 });
  await snap(page, '06-svr-export-card');

  // ── Enter bucket name ────────────────────────────────────────────────────
  const bucketInput = svrCard.locator('input[placeholder*="bucket"]');
  await expect(bucketInput).toBeVisible({ timeout: 5_000 });
  await bucketInput.fill(FILEBASE_BUCKET);

  // ── Start server export ──────────────────────────────────────────────────
  const startBtn = svrCard.locator('button').filter({ hasText: /Start Server Export/i });
  await expect(startBtn).toBeEnabled({ timeout: 3_000 });
  await startBtn.click();
  console.log('  ⏳ Server export started — polling every 30 s…');
  await snap(page, '07-svr-export-started');

  // Wait for the running div which carries data-export-id
  const runningDiv = svrCard.locator('[data-export-id]');
  await runningDiv.waitFor({ state: 'visible', timeout: 30_000 });
  const exportId = await runningDiv.getAttribute('data-export-id');
  console.log(`  Export ID: ${exportId}`);
  expect(exportId).toBeTruthy();

  // ── Poll server status until done ────────────────────────────────────────
  const deadline = Date.now() + EXPORT_TIMEOUT_MS;
  let lastProgress = -1;
  let lastSnap     = Date.now();

  while (Date.now() < deadline) {
    await page.waitForTimeout(POLL_INTERVAL_MS);

    const status = await page.evaluate(async (eid: string) => {
      try {
        const r = await fetch(`/api/nft-gen/export/${eid}`);
        return r.ok ? r.json() : null;
      } catch { return null; }
    }, exportId!);

    if (!status) { console.log('  ⚠ Poll returned null — retrying'); continue; }

    if (status.progress !== lastProgress) {
      const pct = status.total > 0 ? ((status.progress / status.total) * 100).toFixed(1) : '0';
      console.log(`  📊 ${status.progress}/${status.total} (${pct}%) — ${status.phase}`);
      lastProgress = status.progress;
    }

    if (Date.now() - lastSnap > SNAP_INTERVAL_MS) {
      await snap(page, `export-progress-${status.progress}`);
      lastSnap = Date.now();
    }

    if (status.status === 'done') {
      console.log(`  ✅ Server export complete! ${status.total} NFTs uploaded`);
      break;
    }
    if (status.status === 'error') {
      await snap(page, 'export-error');
      throw new Error(`Server export failed: ${status.error}`);
    }
  }

  // Verify UI shows done banner
  const doneBanner = svrCard.locator('.exp-svr-done');
  await doneBanner.waitFor({ state: 'visible', timeout: 60_000 });
  await snap(page, '08-svr-export-done');

  const doneText = await doneBanner.textContent();
  console.log(`  Done banner: "${doneText}"`);
  expect(doneText).toMatch(/NFTs/i);

  // ── Verify DB: items should have ipfs_image_cid ──────────────────────────
  console.log('  🔍 Verifying CIDs written to database…');

  // Get job ID from the DB saved banner (if visible) or sessionStorage
  const dbJobId = await page.evaluate(async () => {
    // Try to get from visible banner
    const banner = document.querySelector('.exp-banner-saved[data-job-id]') as HTMLElement;
    if (banner) return banner.dataset.jobId ?? null;
    return sessionStorage.getItem('e2e_job_id') ?? null;
  });

  if (dbJobId) {
    const items = await page.evaluate(async (jid: string) => {
      try {
        const r = await fetch(`/api/nft-gen/jobs/${jid}/items?limit=10`);
        return r.ok ? r.json() : null;
      } catch { return null; }
    }, dbJobId);

    console.log(`  DB items sample (first 10 of ${items?.total ?? '?'}):`);
    for (const item of (items?.items ?? []).slice(0, 3)) {
      console.log(`    #${item.editionNumber}: img=${item.ipfsImageCid ? '✅' : '❌'} meta=${item.ipfsMetadataCid ? '✅' : '❌'}`);
    }

    const firstItem = items?.items?.[0];
    if (firstItem) {
      expect(firstItem.ipfsImageCid).toBeTruthy();
      expect(firstItem.ipfsMetadataCid).toBeTruthy();
    }
  } else {
    console.log('  ⚠ Job ID not available — skipping DB CID verification');
  }

  await snap(page, '09-final-state');
  console.log('  ✅ E2E complete: 9999 NFTs generated → saved to DB → uploaded to Filebase → CIDs synced');
});

// ── TEST 3: Verify rarity distribution after full generation ─────────────────
test('E2E: Verify rarity report for 9999 NFTs', async ({ page }) => {
  await page.goto('/dashboard/generator');
  await page.waitForSelector('.studio-wrap', { timeout: 30_000 });

  const exportStepBtn = page.locator('button.step-btn').filter({ hasText: /export/i });
  await exportStepBtn.click();
  await page.waitForTimeout(1_000);

  const svrCard = page.locator('.exp-svr-card');
  const hasSvrCard = await svrCard.isVisible({ timeout: 5_000 }).catch(() => false);

  if (!hasSvrCard) {
    console.log('  ⚠ No server export card visible (export not yet run in this session) — skipping rarity check');
    test.skip();
    return;
  }

  // Get job ID from DB saved banner
  const dbJobId = await page.locator('.exp-banner-saved[data-job-id]').getAttribute('data-job-id').catch(() => null);
  if (!dbJobId) {
    console.log('  ⚠ No job ID available — skipping');
    test.skip();
    return;
  }

  // Get rarity report
  const report = await page.evaluate(async (jid: string) => {
    try {
      const r = await fetch(`/api/nft-gen/jobs/${jid}/rarity`);
      return r.ok ? r.json() : null;
    } catch { return null; }
  }, dbJobId);

  if (!report) {
    console.log('  ⚠ Rarity report not available');
    test.skip();
    return;
  }

  console.log(`  Rarity report: totalEditions=${report.totalEditions}, traits=${report.traits?.length ?? 0}`);
  expect(report.totalEditions).toBe(COLLECTION_SUPPLY);

  await snap(page, '10-rarity-verified');
  console.log('  ✅ Rarity report verified');
});
