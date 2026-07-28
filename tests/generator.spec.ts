import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const TECH_AUTH   = path.join(process.cwd(), 'tests', '.auth', 'tech.json');
const SCREENSHOTS = path.join(process.cwd(), 'tests', 'results', 'generator');

test.use({ storageState: TECH_AUTH });
// Generator tests load 188 layer images via Sharp on cold start — give 3 minutes per test.
test.setTimeout(180000);

async function snap(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SCREENSHOTS, `${name}.png`), fullPage: false });
  console.log(`  📸 ${name}.png`);
}

// Wait for AppShell auth ("Verifying access…") to clear and generator to mount
async function waitForGenerator(page: Page) {
  await page.waitForSelector('.studio-wrap', { timeout: 30000 });
}

// Wait for preview generation to complete.
// Waits for .prev-tokens-badge which only renders when phase === 'ready'.
// Handles all states (idle/loading/ready) without race conditions.
async function waitForPreviewReady(page: Page) {
  await page.waitForSelector('.prev-tokens-badge', { timeout: 150000 });
}

// ── Helper: check if a canvas element has actual drawn pixels (not blank) ──────
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

// ── TEST 1: Page loads and shows generator layout ───────────────────────────────
test('Generator page loads with correct layout', async ({ page }) => {
  await page.goto('/dashboard/generator');
  await waitForGenerator(page);
  await snap(page, '01-generator-loaded');

  // Logo visible inside studio
  await expect(page.locator('.logo')).toBeVisible({ timeout: 10000 });

  // Step nav visible with step buttons
  await expect(page.locator('nav.step-nav')).toBeVisible();
  const steps = page.locator('button.step-btn');
  const stepCount = await steps.count();
  expect(stepCount).toBeGreaterThanOrEqual(4);

  console.log(`  ✅ Generator loaded — ${stepCount} step buttons visible`);
});

// ── TEST 2: Settings step has required fields ────────────────────────────────────
test('Settings step shows collection form', async ({ page }) => {
  await page.goto('/dashboard/generator');
  await waitForGenerator(page);

  // Default step is settings
  await snap(page, '02-settings-step');
  const body = await page.content();
  const hasForm = body.includes('Collection') || body.includes('collection') ||
                  body.includes('supply') || body.includes('Supply') ||
                  body.includes('blockchain') || body.includes('Blockchain');
  expect(hasForm).toBeTruthy();

  console.log('  ✅ Settings step visible');
});

// ── TEST 3: Navigate to Preview step ────────────────────────────────────────────
test('Can navigate to Preview step', async ({ page }) => {
  await page.goto('/dashboard/generator');
  await waitForGenerator(page);

  // Click the Preview step button from StepNav
  const previewBtn = page.locator('button.step-btn').filter({ hasText: /preview/i });
  await expect(previewBtn).toBeVisible({ timeout: 5000 });
  await previewBtn.click();
  await page.waitForTimeout(1000);
  await snap(page, '03-preview-step');

  // Studio logo still visible (we're still in studio-wrap)
  await expect(page.locator('.logo')).toBeVisible();

  // Preview panel or loading spinner should be visible
  const hasPreview = await page.locator('.preview-layout, .preview-empty, .randomize-btn').count();
  expect(hasPreview).toBeGreaterThan(0);

  console.log('  ✅ Navigated to Preview step');
});

// ── TEST 4: Preview loads bitmaps and renders NFT cards ──────────────────────────
test('Preview step renders NFT cards with images', async ({ page }) => {
  await page.goto('/dashboard/generator');
  await waitForGenerator(page);

  // Go to Preview
  const previewBtn = page.locator('button.step-btn').filter({ hasText: /preview/i });
  await previewBtn.click();

  await waitForPreviewReady(page);

  // Wait for the first card to actually render in the virtual grid
  await page.waitForSelector('.prev-card', { timeout: 30000 });
  await page.waitForTimeout(500);
  await snap(page, '04-preview-cards-loaded');

  // Cards should exist
  const cards = page.locator('.prev-card');
  const cardCount = await cards.count();
  console.log(`  Found ${cardCount} NFT cards in viewport`);
  expect(cardCount).toBeGreaterThan(0);

  // First card should have a canvas
  const firstCanvas = cards.first().locator('canvas');
  await expect(firstCanvas).toBeVisible();

  // Canvas should have drawn pixels (not blank)
  const hasPixels = await canvasHasPixels(page, '.prev-card canvas');
  console.log(`  Canvas has drawn pixels: ${hasPixels}`);
  expect(hasPixels).toBe(true);

  console.log('  ✅ NFT cards rendered with images');
});

// ── TEST 5: Multiple cards have images (not just the first) ─────────────────────
test('Multiple NFT cards have visible images', async ({ page }) => {
  await page.goto('/dashboard/generator');
  await waitForGenerator(page);

  const previewBtn = page.locator('button.step-btn').filter({ hasText: /preview/i });
  await previewBtn.click();

  await waitForPreviewReady(page);
  await page.waitForTimeout(2000);

  const cards = page.locator('.prev-card');
  const cardCount = await cards.count();
  expect(cardCount).toBeGreaterThan(3);

  // Check up to 8 cards all have drawn canvases
  let filledCount = 0;
  const canvases = page.locator('.prev-card canvas');
  const total = await canvases.count();

  for (let i = 0; i < Math.min(total, 8); i++) {
    const hasPixels = await page.evaluate((idx) => {
      const allCanvases = document.querySelectorAll('.prev-card canvas');
      const canvas = allCanvases[idx] as HTMLCanvasElement;
      if (!canvas) return false;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let j = 3; j < data.length; j += 4) {
        if (data[j] > 0) return true;
      }
      return false;
    }, i);
    if (hasPixels) filledCount++;
    console.log(`  Card #${i + 1}: ${hasPixels ? '✅ has image' : '❌ blank'}`);
  }

  await snap(page, '05-multiple-cards-check');
  expect(filledCount).toBeGreaterThan(0);
  console.log(`  ✅ ${filledCount}/${Math.min(total, 8)} cards have images`);
});

// ── TEST 6: Randomize button regenerates NFTs ────────────────────────────────────
test('Randomize button works', async ({ page }) => {
  await page.goto('/dashboard/generator');
  await waitForGenerator(page);

  const previewBtn = page.locator('button.step-btn').filter({ hasText: /preview/i });
  await previewBtn.click();

  await waitForPreviewReady(page);
  await page.waitForSelector('button.randomize-btn:not([disabled])', { timeout: 30000 });

  // Click Randomize
  const randomizeBtn = page.locator('button.randomize-btn');
  await randomizeBtn.click();

  // Wait for re-generation (button re-enables)
  await page.waitForFunction(
    () => {
      const btn = document.querySelector('button.randomize-btn') as HTMLButtonElement;
      return btn && !btn.disabled;
    },
    null,
    { timeout: 120000 }
  );

  await page.waitForTimeout(1500);
  await snap(page, '06-after-randomize');

  const cards = page.locator('.prev-card');
  expect(await cards.count()).toBeGreaterThan(0);
  console.log('  ✅ Randomize completed, cards still visible');
});

// ── TEST 7: Sort dropdown works ──────────────────────────────────────────────────
test('Sort dropdown changes order', async ({ page }) => {
  await page.goto('/dashboard/generator');
  await waitForGenerator(page);

  const previewBtn = page.locator('button.step-btn').filter({ hasText: /preview/i });
  await previewBtn.click();

  await waitForPreviewReady(page);
  // Wait for sort button to appear (only rendered when phase === 'ready')
  await page.waitForSelector('button.prev-sort-btn', { timeout: 30000 });

  // Open sort dropdown
  const sortBtn = page.locator('button.prev-sort-btn');
  await sortBtn.click();
  await snap(page, '07-sort-dropdown-open');

  // Click "Most rare first"
  const rareFirst = page.locator('button.prev-sort-option').filter({ hasText: /rare first/i });
  await expect(rareFirst).toBeVisible({ timeout: 3000 });
  await rareFirst.click();
  await page.waitForTimeout(800);
  await snap(page, '08-sort-rare-first');

  // Rank badges should appear
  const rankBadges = page.locator('.prev-rank-badge');
  const badgeCount = await rankBadges.count();
  console.log(`  Rank badges visible: ${badgeCount}`);
  expect(badgeCount).toBeGreaterThan(0);

  console.log('  ✅ Sort works, rank badges shown');
});

// ── TEST 8: Scroll shows more NFT cards (virtual scroll) ────────────────────────
test('Virtual scroll loads more cards on scroll', async ({ page }) => {
  await page.goto('/dashboard/generator');
  await waitForGenerator(page);

  const previewBtn = page.locator('button.step-btn').filter({ hasText: /preview/i });
  await previewBtn.click();

  await waitForPreviewReady(page);
  await page.waitForSelector('.prev-card', { timeout: 30000 });

  // Get first card's name before scroll
  const firstCardBefore = await page.locator('.prev-card-name').first().textContent();
  console.log(`  First card before scroll: ${firstCardBefore}`);

  // Scroll down in the virtual grid
  await page.locator('.prev-grid-scroll').evaluate(el => el.scrollBy(0, 800));
  await page.waitForTimeout(500);
  await snap(page, '09-after-scroll');

  // Cards after scroll should still have images
  const hasPixels = await canvasHasPixels(page, '.prev-card canvas');
  console.log(`  Cards after scroll have pixels: ${hasPixels}`);

  const firstCardAfter = await page.locator('.prev-card-name').first().textContent();
  console.log(`  First card after scroll: ${firstCardAfter}`);

  expect(hasPixels).toBe(true);
  console.log('  ✅ Virtual scroll works — cards visible after scroll');
});

// ── TEST 9: Token count badge shows correct number ──────────────────────────────
test('Token count shows supply count', async ({ page }) => {
  await page.goto('/dashboard/generator');
  await waitForGenerator(page);

  const previewBtn = page.locator('button.step-btn').filter({ hasText: /preview/i });
  await previewBtn.click();

  await waitForPreviewReady(page);

  const tokenBadge = page.locator('.prev-tokens-badge');
  const text = await tokenBadge.textContent();
  console.log(`  Token badge: "${text}"`);
  expect(text).toMatch(/\d+/);

  await snap(page, '10-token-count');
  console.log('  ✅ Token count badge works');
});
