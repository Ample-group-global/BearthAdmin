// Quick visual check — verifies layer images load in the generator Organise tab
import { test, expect } from "@playwright/test";
import path from "path";

test.use({ storageState: path.join(process.cwd(), "tests", ".auth", "tech.json") });
test.setTimeout(120000);

test("generator — layer images visible in Organise tab", async ({ page }) => {
  await page.goto("/dashboard/generator");

  // Wait for shell to load
  await page.locator("text=Verifying access").waitFor({ state: "detached", timeout: 60000 }).catch(() => {});
  await page.locator("button").filter({ hasText: /Sign Out/i }).waitFor({ state: "visible", timeout: 60000 });

  // Click the Organize tab in StepNav
  await page.locator("nav.step-nav button").filter({ hasText: /Organize/i }).click();

  await page.screenshot({ path: "tests/results/gen-check-01-organise-tab.png", fullPage: false });

  // Wait for layer list — sidebar shows raw folder names like "0-bg", "1-back-back"
  await expect(page.locator(".layer-item").first()).toBeVisible({ timeout: 20000 });

  const layerCount = await page.locator(".layer-item").count();
  console.log(`Layers found: ${layerCount}`);
  expect(layerCount).toBeGreaterThan(0);

  // Click first layer in sidebar to load its assets
  await page.locator(".layer-item").first().click();
  await page.waitForTimeout(1500);

  await page.screenshot({ path: "tests/results/gen-check-02-layer-selected.png", fullPage: false });

  // Asset cards should be visible
  const cards = page.locator(".asset-card, [class*='asset-card']");
  const cardCount = await cards.count();
  console.log(`Asset cards found: ${cardCount}`);
  expect(cardCount).toBeGreaterThan(0);

  // Check that at least one image inside a card has loaded (naturalWidth > 0)
  const imagesLoaded = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll(".asset-card img, [class*='asset-card'] img")];
    if (!imgs.length) return { total: 0, loaded: 0 };
    const loaded = imgs.filter((img: any) => img.naturalWidth > 0).length;
    return { total: imgs.length, loaded };
  });

  console.log(`Images: ${imagesLoaded.loaded} / ${imagesLoaded.total} loaded`);

  await page.screenshot({ path: "tests/results/gen-check-03-asset-cards.png", fullPage: false });

  expect(imagesLoaded.total).toBeGreaterThan(0);
  expect(imagesLoaded.loaded).toBeGreaterThan(0);

  // Navigate to Settings tab and verify collection form shown
  await page.locator("nav.step-nav button").filter({ hasText: /Settings/i }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "tests/results/gen-check-04-settings-tab.png", fullPage: false });

  // Navigate to Preview tab and wait for thumbnails
  await page.locator("nav.step-nav button").filter({ hasText: /Preview/i }).click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "tests/results/gen-check-05-preview-tab.png", fullPage: false });

  console.log("✅ Generator page loaded with layer images");
});
