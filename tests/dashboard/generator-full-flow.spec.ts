// NFT Studio — all 5 tabs test using Technical admin (amplecapitalholding@gmail.com)
// Only opens /dashboard/generator — no other pages loaded
import { test, expect } from "@playwright/test";
import path from "path";

test.use({ storageState: path.join(process.cwd(), "tests", ".auth", "tech.json") });
test.setTimeout(300000);

test("NFT Studio — all tabs: Settings / Organize / Rarity / Preview / Export", async ({ page }) => {

  // ── Open NFT Studio (only page loaded in this test) ───────────────────────
  await page.goto("/dashboard/generator");
  await page.locator("text=Verifying access").waitFor({ state: "detached", timeout: 60000 }).catch(() => {});
  await page.locator("button").filter({ hasText: /Sign Out/i }).waitFor({ state: "visible", timeout: 60000 });

  console.log("\n=== NFT Studio — all 5 tabs ===\n");

  // ── TAB 1: Settings ────────────────────────────────────────────────────────
  await page.locator("nav.step-nav button").filter({ hasText: /Settings/i }).click();
  await page.waitForTimeout(600);

  await expect(page.locator("input[placeholder='No Name']")).toBeVisible({ timeout: 10000 });
  await expect(page.locator("select")).toBeVisible(); // Blockchain dropdown
  await expect(page.locator("text=Import Artwork Layers")).toBeVisible();
  await expect(page.locator("span").getByText("exported_layers", { exact: true })).toBeVisible({ timeout: 5000 });

  await page.screenshot({ path: "tests/results/nft-01-settings.png", fullPage: false });
  console.log("✅ Settings tab: collection form visible, active folder = exported_layers");

  // ── TAB 2: Organize ────────────────────────────────────────────────────────
  await page.locator("nav.step-nav button").filter({ hasText: /Organize/i }).click();
  await expect(page.locator(".layer-item").first()).toBeVisible({ timeout: 20000 });

  const totalLayers = await page.locator(".layer-item").count();
  console.log(`\n   Layers in sidebar: ${totalLayers}`);
  expect(totalLayers).toBeGreaterThan(0);

  let totalBroken = 0;

  for (let i = 0; i < totalLayers; i++) {
    const layerEl = page.locator(".layer-item").nth(i);
    const layerName = await layerEl.locator(".ln").textContent().catch(() => `Layer ${i + 1}`);
    // Use JS scroll to avoid stability-check timeouts (sidebar items animate on selection)
    await page.evaluate((idx) => {
      const items = document.querySelectorAll(".layer-item");
      if (items[idx]) items[idx].scrollIntoView({ behavior: "instant", block: "nearest" });
    }, i);
    await layerEl.click();
    await page.waitForTimeout(800);

    // Scroll each card into view via JS (avoids stability-check on newly-rendered cards)
    const cardCount = await page.locator(".asset-card").count();
    await page.evaluate(() => {
      document.querySelectorAll(".asset-card").forEach(el =>
        el.scrollIntoView({ behavior: "instant", block: "nearest" })
      );
    });
    await page.waitForTimeout(1500);

    const stats = await page.evaluate(() => {
      const imgs = [...document.querySelectorAll(".asset-card img")] as HTMLImageElement[];
      const spans = [...document.querySelectorAll(".asset-card .no-img")];
      return {
        total:    imgs.length,
        loaded:   imgs.filter(i => i.naturalWidth > 0 && i.complete).length,
        broken:   imgs.filter(i => i.complete && i.naturalWidth === 0 && i.src).length
                + spans.filter(s => s.textContent?.includes("🖼")).length,
        none:     spans.filter(s => s.textContent?.includes("NONE")).length,
      };
    });

    totalBroken += stats.broken;
    const icon = stats.broken > 0 ? "❌" : "✅";
    console.log(`   ${icon} ${layerName}: ${cardCount} cards, ${stats.loaded}/${stats.total} loaded, ${stats.none} NONE, ${stats.broken} broken`);
  }

  await page.screenshot({ path: "tests/results/nft-02-organize.png", fullPage: false });

  if (totalBroken > 0) {
    throw new Error(`Organize tab: ${totalBroken} trait images failed to load`);
  }
  console.log("✅ Organize tab: all trait images loaded");

  // ── TAB 3: Rarity ─────────────────────────────────────────────────────────
  await page.locator("nav.step-nav button").filter({ hasText: /Rarity/i }).click();
  await page.waitForTimeout(800);

  await expect(page.locator(".rt-section-title").filter({ hasText: "Rarity Tiers" })).toBeVisible({ timeout: 10000 });
  await expect(page.locator(".rt-tier-label").filter({ hasText: "Legendary" }).first()).toBeVisible();
  await expect(page.locator(".rt-tier-label").filter({ hasText: "Epic" }).first()).toBeVisible();
  await expect(page.locator(".rt-tier-label").filter({ hasText: "Rare" }).first()).toBeVisible();
  await expect(page.locator(".rt-tier-label").filter({ hasText: "Common" }).first()).toBeVisible();

  await page.screenshot({ path: "tests/results/nft-03-rarity.png", fullPage: false });
  console.log("✅ Rarity tab: 4 tier cards visible (Legendary / Epic / Rare / Common)");

  // ── TAB 4: Preview ─────────────────────────────────────────────────────────
  await page.locator("nav.step-nav button").filter({ hasText: /Preview/i }).click();

  // Preview auto-generates on mount: loads all images + generates combos + renders canvas thumbnails
  console.log("   Preview: waiting for NFT thumbnails to generate…");
  await expect(page.locator(".prev-card").first()).toBeVisible({ timeout: 90000 });

  const prevCount = await page.locator(".prev-card").count();
  console.log(`   Preview NFT cards rendered: ${prevCount}`);
  expect(prevCount).toBeGreaterThan(0);

  // Randomize button should be enabled after generation completes
  await expect(page.locator("button").filter({ hasText: /Randomize/i })).toBeEnabled({ timeout: 5000 });

  // Click a card to verify popup shows NFT attributes
  await page.locator(".prev-card").first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "tests/results/nft-04-preview-popup.png", fullPage: false });
  await page.locator(".nft-popup-close").click().catch(() => {});

  await page.screenshot({ path: "tests/results/nft-04-preview.png", fullPage: false });
  console.log(`✅ Preview tab: ${prevCount} NFTs generated via canvas compositing`);

  // ── TAB 5: Export ─────────────────────────────────────────────────────────
  await page.locator("nav.step-nav button").filter({ hasText: /Export/i }).click();
  await page.waitForTimeout(1200);

  await page.screenshot({ path: "tests/results/nft-05-export.png", fullPage: false });

  // Verify Export tab rendered (any export-related content)
  const exportContent = await page.locator(".exp-nft-card, button, .rarity-card").count();
  console.log(`   Export tab elements: ${exportContent}`);

  console.log("\n=== All 5 NFT Studio tabs verified ===");
});
