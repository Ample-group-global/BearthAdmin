import { test, expect, chromium } from '@playwright/test';
import path from 'path';
import fs   from 'fs';

const SCREENSHOTS = path.join(process.cwd(), 'tests', 'results', 'incognito-preview');

// Fresh browser context = incognito (no cookies, no cache, no storage)
test('Incognito: Preview canvases render NFT images (not blank)', async () => {
  fs.mkdirSync(SCREENSHOTS, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  // newContext() with no storageState = fresh incognito-equivalent session
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
  });
  const page = await context.newPage();

  async function snap(name: string) {
    await page.screenshot({ path: path.join(SCREENSHOTS, `${name}.png`) });
    console.log(`  📸 ${name}.png`);
  }

  try {
    // ── 1. Login fresh (no saved state) ──────────────────────────────────────
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"], input[name="email"]', 'amplecapitalholding@gmail.com');
    await page.fill('input[type="password"], input[name="password"]', 'amplecapitalholding@123');
    await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")');
    await page.waitForURL('**/dashboard**', { timeout: 20_000 });
    console.log('  ✅ Logged in (fresh session, no cached state)');
    await snap('01-logged-in');

    // ── 2. Go to generator ────────────────────────────────────────────────────
    await page.goto('http://localhost:3000/dashboard/generator');
    await page.waitForSelector('.studio-wrap', { timeout: 30_000 });
    await snap('02-settings');

    // ── 3. Set supply to small number for fast test ───────────────────────────
    const supplyInput = page.locator('input[type=number][min="1"][max="100000"]');
    await expect(supplyInput).toBeVisible({ timeout: 10_000 });
    await supplyInput.click({ clickCount: 3 });
    await supplyInput.fill('50');
    await expect(supplyInput).toHaveValue('50');

    // ── 4. Continue to Organize ───────────────────────────────────────────────
    const continueBtn = page.locator('button.setup-continue-btn');
    await continueBtn.click();
    // Wait for the org-layout container (only renders when step='organize')
    await page.waitForSelector('.org-layout', { timeout: 60_000 });
    // Then wait for LayerContent to render (activeLayer must be set)
    await page.waitForSelector('.lc-wrap', { timeout: 30_000 });
    await snap('03-organize');
    console.log('  ✅ Organize step loaded');

    // ── 5. Check Organise tab thumbnails are not blank ────────────────────────
    // Wait for at least one asset-card image to load
    await page.waitForSelector('.asset-card img, .asset-card .no-img', { timeout: 30_000 });
    const thumbLoaded = await page.evaluate(() => {
      const imgs = document.querySelectorAll<HTMLImageElement>('.asset-card img');
      return [...imgs].some(img => img.complete && img.naturalWidth > 0);
    });
    console.log(`  Organise thumbnails loaded: ${thumbLoaded}`);
    await snap('04-organize-thumbnails');

    // ── 6. Go to Preview step ─────────────────────────────────────────────────
    const previewBtn = page.locator('button.step-btn').filter({ hasText: /preview/i });
    await expect(previewBtn).toBeVisible({ timeout: 5_000 });
    await previewBtn.click();

    // Wait for the preview to complete (phase = 'ready' → prev-grid-scroll visible)
    await page.waitForSelector('.prev-grid-scroll', { timeout: 120_000 });
    // Give generation time to finish (combos + bitmaps)
    await page.waitForTimeout(5_000);
    await snap('05-preview-initial');

    // ── 7. Verify canvas elements have drawn pixels ───────────────────────────
    const canvasResult = await page.evaluate(() => {
      const canvases = document.querySelectorAll<HTMLCanvasElement>('.prev-card canvas');
      if (canvases.length === 0) return { count: 0, hasPixels: false };

      let hasPixels = false;
      for (const canvas of canvases) {
        try {
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          // Check if any pixel has non-zero alpha (i.e., something was drawn)
          for (let i = 3; i < data.length; i += 4) {
            if (data[i] > 0) { hasPixels = true; break; }
          }
        } catch { /* cross-origin canvas — skip */ }
        if (hasPixels) break;
      }
      return { count: canvases.length, hasPixels };
    });

    console.log(`  Canvas count: ${canvasResult.count}, Has pixels: ${canvasResult.hasPixels}`);
    await snap('06-preview-canvases');

    expect(canvasResult.count).toBeGreaterThan(0);
    expect(canvasResult.hasPixels).toBe(true);
    console.log('  ✅ Preview canvases are NOT blank — fix confirmed');

  } finally {
    await context.close();
    await browser.close();
  }
});
