import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const TECH_AUTH   = path.join(process.cwd(), 'tests', '.auth', 'tech.json');
const SCREENSHOTS = path.join(process.cwd(), 'tests', 'results', 'generator-check');

test.use({ storageState: TECH_AUTH });
test.setTimeout(180000);

async function snap(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SCREENSHOTS, `${name}.png`), fullPage: false });
  console.log(`  📸 ${name}.png`);
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

test('Organise tab — thumbnails visible and Preview tab — NFT canvases have pixels', async ({ page }) => {
  await page.goto('/dashboard/generator');
  await page.waitForSelector('.studio-wrap', { timeout: 30000 });
  await snap(page, '01-settings-loaded');

  // ── Navigate to Organise tab ───────────────────────────────────────────────
  const organiseBtn = page.locator('button.step-btn', { hasText: 'Organize' });
  await organiseBtn.click();
  await page.waitForSelector('.org-layout', { timeout: 15000 });
  await snap(page, '02-organise-tab');

  // Check sidebar shows layers
  const layerItems = page.locator('.layer-item');
  const layerCount = await layerItems.count();
  console.log(`  Layers in sidebar: ${layerCount}`);
  expect(layerCount).toBeGreaterThan(0);

  // Click the first layer in the sidebar to load its content
  await layerItems.first().click();
  await page.waitForTimeout(1000);
  await snap(page, '03-organise-layer-selected');

  // Switch to Manage view to see thumbnails
  const manageBtn = page.locator('button.lc-hbtn', { hasText: 'Manage' });
  if (await manageBtn.count() > 0) {
    await manageBtn.first().click();
    await page.waitForTimeout(1500);
  }
  await snap(page, '04-organise-manage-view');

  // Check if any img thumbnails loaded (not broken)
  const thumbImgs = page.locator('.lc-file-thumb img');
  const thumbCount = await thumbImgs.count();
  console.log(`  Thumbnail images found: ${thumbCount}`);

  if (thumbCount > 0) {
    // Check first thumbnail naturalWidth > 0 (means it loaded)
    const firstThumbLoaded = await page.evaluate(() => {
      const img = document.querySelector('.lc-file-thumb img') as HTMLImageElement;
      return img ? img.naturalWidth > 0 : false;
    });
    console.log(`  First thumbnail loaded: ${firstThumbLoaded}`);
    expect(firstThumbLoaded).toBe(true);
  }

  // ── Navigate to Preview tab ────────────────────────────────────────────────
  const previewBtn = page.locator('button.step-btn', { hasText: 'Preview' });
  await previewBtn.click();
  await page.waitForSelector('.preview-layout', { timeout: 15000 });
  await snap(page, '05-preview-loading');

  // Wait for generation to complete (prev-tokens-badge appears when phase=ready)
  console.log('  Waiting for preview to generate 9999 NFTs...');
  await page.waitForSelector('.prev-tokens-badge', { timeout: 150000 });
  await snap(page, '06-preview-ready');

  // Check canvas pixels
  const firstCanvas = page.locator('.prev-thumb canvas').first();
  await expect(firstCanvas).toBeVisible({ timeout: 5000 });

  const hasPixels = await canvasHasPixels(page, '.prev-thumb canvas');
  console.log(`  First NFT canvas has pixels: ${hasPixels}`);

  // Count canvases rendered
  const canvasCount = await page.locator('.prev-thumb canvas').count();
  console.log(`  Canvases rendered: ${canvasCount}`);

  // Check multiple canvases for pixel data
  const pixelResults = await page.evaluate(() => {
    const canvases = [...document.querySelectorAll('.prev-thumb canvas')] as HTMLCanvasElement[];
    return canvases.slice(0, 4).map(c => {
      const ctx = c.getContext('2d');
      if (!ctx) return { w: 0, h: 0, hasPixels: false };
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let hasPixels = false;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 0) { hasPixels = true; break; }
      }
      return { w: c.width, h: c.height, hasPixels };
    });
  });

  console.log('  Canvas details (first 4):');
  pixelResults.forEach((r, i) => {
    console.log(`    #${i + 1}: ${r.w}x${r.h}, hasPixels=${r.hasPixels}`);
  });

  expect(hasPixels).toBe(true);
  await snap(page, '07-preview-final');
});
