// NFT Studio generator test — checks Organize tab trait images load for all layers
import { test, expect } from "@playwright/test";
import path from "path";

test.use({ storageState: path.join(process.cwd(), "tests", ".auth", "tech.json") });
test.setTimeout(180000);

test("NFT Studio — Organize tab: all layer trait images load", async ({ page }) => {
  await page.goto("/dashboard/generator");
  await page.locator("text=Verifying access").waitFor({ state: "detached", timeout: 60000 }).catch(() => {});
  await page.locator("button").filter({ hasText: /Sign Out/i }).waitFor({ state: "visible", timeout: 60000 });

  // Go to Organize tab
  await page.locator("nav.step-nav button").filter({ hasText: /Organize/i }).click();
  await expect(page.locator(".layer-item").first()).toBeVisible({ timeout: 20000 });

  const layerItems = page.locator(".layer-item");
  const totalLayers = await layerItems.count();
  console.log(`\nTotal layers: ${totalLayers}`);
  expect(totalLayers).toBeGreaterThan(0);

  let totalFailed = 0;

  // Check each layer one by one
  for (let i = 0; i < totalLayers; i++) {
    const layerEl = layerItems.nth(i);
    const layerName = await layerEl.locator(".ln").textContent().catch(() => `Layer ${i + 1}`);

    await layerEl.click();
    await page.waitForTimeout(800);

    // Scroll every card into view one by one so lazy loading triggers for all
    const cards = page.locator(".asset-card");
    const cardCount = await cards.count();
    for (let c = 0; c < cardCount; c++) {
      await cards.nth(c).scrollIntoViewIfNeeded();
    }
    await page.waitForTimeout(2000); // wait for all lazy images to load

    // Check images:
    // - "NONE" spans are intentional optional-layer placeholders (not failures)
    // - "🖼" spans mean onError fired = image returned 404/500 (real failure)
    // - img elements with complete=true & naturalWidth=0 = broken but not replaced yet
    const imgStats = await page.evaluate(() => {
      const imgs = [...document.querySelectorAll(".asset-card img")] as HTMLImageElement[];
      const noImgSpans = [...document.querySelectorAll(".asset-card .no-img")];
      const brokenSpans  = noImgSpans.filter(s => s.textContent?.includes("🖼")).length; // actual failures
      const noneSpans    = noImgSpans.filter(s => s.textContent?.includes("NONE")).length; // intentional
      const loaded = imgs.filter(img => img.naturalWidth > 0 && img.complete).length;
      const brokenImgs = imgs.filter(img => img.complete && img.naturalWidth === 0 && img.src).length;
      return { total: imgs.length, loaded, brokenImgs, brokenSpans, noneSpans };
    });

    const failed = imgStats.brokenImgs + imgStats.brokenSpans;
    totalFailed += failed;

    const status = failed > 0 ? "❌" : "✅";
    console.log(`${status} ${layerName}: ${cardCount} cards, ${imgStats.loaded}/${imgStats.total} imgs loaded, ${imgStats.noneSpans} NONE placeholders, ${failed} broken`);

    if (failed > 0) {
      await page.screenshot({ path: `tests/results/nft-studio-${i}-${layerName?.replace(/[^a-z0-9]/gi, '_')}.png` });
    }
  }

  await page.screenshot({ path: "tests/results/nft-studio-organize-final.png", fullPage: false });

  if (totalFailed > 0) {
    throw new Error(`${totalFailed} images failed to load in Organize tab`);
  }

  console.log("\n✅ All layer trait images loaded in Organize tab");
});
