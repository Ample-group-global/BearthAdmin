// Route: /dashboard/generator — Filebase IPFS push integration
// Tests the complete flow: generate NFTs → check bucket → upload images → upload metadata → CID table
// Uses real exported_layers PNGs so NFT thumbnails render correctly
import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

test.use({ storageState: path.join(process.cwd(), "tests", ".auth", "tech.json") });

const LAYERS_DIR = path.resolve(
  "D:\\AMG-Projects\\AMGEcosystem\\amgecosystem\\amgecosystem-v1.0.0\\BearthProject-Revamp\\exported_layers"
);

// Build layer structure from the real exported_layers directory
function buildRealLayers() {
  const dirs = fs.readdirSync(LAYERS_DIR)
    .filter(d => fs.statSync(path.join(LAYERS_DIR, d)).isDirectory())
    .sort();

  return dirs.map(folder => {
    const files = fs.readdirSync(path.join(LAYERS_DIR, folder))
      .filter(f => /\.(png|webp)$/i.test(f))
      .sort();
    const label = folder.replace(/^\d+-/, "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    return {
      folder,
      label,
      count:    files.length,
      optional: false,
      assets:   files.map(f => ({
        stem:          f.replace(/\.(png|webp)$/i, ""),
        name:          f.replace(/\.(png|webp)$/i, "").replace(/-/g, " "),
        rel:           `${folder}/${f}`,
        defaultWeight: 1,
      })),
    };
  });
}

// Serve real PNGs from exported_layers when the browser requests layer images
async function setupLayerMocks(page: any) {
  const layers = buildRealLayers();

  await page.route("**/api/layers", async (route: any) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(layers) });
    } else {
      await route.continue();
    }
  });

  await page.route("**/api/layer-img/**", async (route: any) => {
    const url   = route.request().url();
    const match = url.match(/\/api\/layer-img\/(.+?)(\?.*)?$/);
    if (!match) { await route.continue(); return; }
    const rel      = decodeURIComponent(match[1]);
    const filePath = path.join(LAYERS_DIR, rel);
    try {
      const buf = fs.readFileSync(filePath);
      await route.fulfill({ status: 200, contentType: "image/png", body: buf });
    } catch {
      await route.fulfill({ status: 404, body: Buffer.alloc(0) });
    }
  });

  await page.route("**/api/layer-raw/**", async (route: any) => {
    const url   = route.request().url();
    const match = url.match(/\/api\/layer-raw\/(.+?)(\?.*)?$/);
    if (!match) { await route.continue(); return; }
    const rel      = decodeURIComponent(match[1]);
    const filePath = path.join(LAYERS_DIR, rel);
    try {
      const buf = fs.readFileSync(filePath);
      await route.fulfill({ status: 200, contentType: "image/png", body: buf });
    } catch {
      await route.fulfill({ status: 404, body: Buffer.alloc(0) });
    }
  });
}

async function waitForShell(page: any) {
  await page.locator("text=Verifying access").waitFor({ state: "detached", timeout: 60000 }).catch(() => {});
  await page.locator("button").filter({ hasText: /Sign Out/i }).waitFor({ state: "visible", timeout: 60000 }).catch(() => {});
}

// Navigate to Export tab with supply=3 and generate combos → returns when 'done' phase reached
async function generateNFTs(page: any) {
  const supplyInput = page.locator('label:has-text("Collection Size")').locator("..").locator("input[type='number']");
  await supplyInput.fill("3");

  await page.locator("button").filter({ hasText: /Export/i }).click();
  await expect(page.locator("button").filter({ hasText: /Generate 3/i }).first()).toBeVisible({ timeout: 20000 });
  await page.locator("button").filter({ hasText: /Generate 3/i }).first().click();

  // Wait for rarity grid (done phase) — real layer images take longer to composite
  await expect(page.locator("text=3 NFTs ready")).toBeVisible({ timeout: 120000 });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
}

test.describe("Filebase IPFS — Generator Integration", () => {
  test.setTimeout(240000);

  // ── 1: Export tab idle form ─────────────────────────────────────────────────
  test("01 — Export tab shows collection summary and Generate button", async ({ page }) => {
    await setupLayerMocks(page);
    await page.goto("/dashboard/generator");
    await waitForShell(page);

    await page.locator("button").filter({ hasText: /Export/i }).click();
    await expect(page.locator("text=Export Collection")).toBeVisible({ timeout: 20000 });
    await expect(page.locator("button").filter({ hasText: /Generate/i }).first()).toBeVisible();

    await page.screenshot({ path: "tests/results/filebase-01-export-tab.png" });
  });

  // ── 2: Settings supply → Export label updates ───────────────────────────────
  test("02 — set supply=3, Export button shows Generate 3 NFTs", async ({ page }) => {
    await setupLayerMocks(page);
    await page.goto("/dashboard/generator");
    await waitForShell(page);

    const supplyInput = page.locator('label:has-text("Collection Size")').locator("..").locator("input[type='number']");
    await supplyInput.fill("3");

    await page.screenshot({ path: "tests/results/filebase-02-settings-supply-3.png" });

    await page.locator("button").filter({ hasText: /Export/i }).click();
    await expect(page.locator("button").filter({ hasText: /Generate 3/i }).first()).toBeVisible({ timeout: 20000 });

    await page.screenshot({ path: "tests/results/filebase-02-export-label.png" });
  });

  // ── 3: Generate 3 NFTs → done phase → Filebase section visible ──────────────
  test("03 — generate 3 NFTs with real layers → Filebase section appears", async ({ page }) => {
    await setupLayerMocks(page);
    await page.goto("/dashboard/generator");
    await waitForShell(page);

    await generateNFTs(page);

    await page.screenshot({ path: "tests/results/filebase-03-nfts-ready.png" });

    // Filebase section is below the rarity grid
    await expect(page.locator("text=Push to Filebase IPFS")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("input[placeholder='Filebase bucket name']")).toBeVisible();
    await expect(page.locator("button").filter({ hasText: /Check Bucket/i })).toBeVisible();

    await page.screenshot({ path: "tests/results/filebase-03-filebase-section.png" });
  });

  // ── 4: Bucket check → exists ────────────────────────────────────────────────
  test("04 — bucket check: exists → Bucket ready", async ({ page }) => {
    await setupLayerMocks(page);
    await page.route("**/api/filebase/buckets/**", async (route: any) => {
      await route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ bucket: "bearth-nft", exists: true }),
      });
    });

    await page.goto("/dashboard/generator");
    await waitForShell(page);
    await generateNFTs(page);

    await page.locator("input[placeholder='Filebase bucket name']").fill("bearth-nft");
    await page.locator("button").filter({ hasText: /Check Bucket/i }).click();

    await expect(page.locator("text=Bucket ready")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("button").filter({ hasText: /Upload Images/i })).toBeEnabled();

    await page.screenshot({ path: "tests/results/filebase-04-bucket-exists.png" });
  });

  // ── 5: Bucket not found → Create Bucket → ready ─────────────────────────────
  test("05 — bucket not found → Create Bucket → Bucket ready", async ({ page }) => {
    await setupLayerMocks(page);
    await page.route("**/api/filebase/buckets/**", async (route: any) => {
      await route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ bucket: "bearth-new", exists: false }),
      });
    });
    await page.route("**/api/filebase/buckets", async (route: any) => {
      if (route.request().method() === "POST") {
        await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ name: "bearth-new" }) });
      } else { await route.continue(); }
    });

    await page.goto("/dashboard/generator");
    await waitForShell(page);
    await generateNFTs(page);

    await page.locator("input[placeholder='Filebase bucket name']").fill("bearth-new");
    await page.locator("button").filter({ hasText: /Check Bucket/i }).click();
    await expect(page.locator("button").filter({ hasText: /Create Bucket/i })).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: "tests/results/filebase-05-create-btn.png" });

    await page.locator("button").filter({ hasText: /Create Bucket/i }).click();
    await expect(page.locator("text=Bucket ready")).toBeVisible({ timeout: 15000 });

    await page.screenshot({ path: "tests/results/filebase-05-bucket-created.png" });
  });

  // ── 6: Upload Images → progress bar → Images Uploaded ───────────────────────
  test("06 — upload images → 3/3 progress → Images Uploaded", async ({ page }) => {
    await setupLayerMocks(page);
    await page.route("**/api/filebase/buckets/**", async (route: any) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ exists: true }) });
    });
    await page.route("**/api/filebase/image", async (route: any) => {
      await route.fulfill({
        status: 201, contentType: "application/json",
        body: JSON.stringify({ bucket: "bearth-nft", key: "images/1.png", size: 512, cid: "QmTestImgCID_abc" }),
      });
    });

    await page.goto("/dashboard/generator");
    await waitForShell(page);
    await generateNFTs(page);

    await page.locator("input[placeholder='Filebase bucket name']").fill("bearth-nft");
    await page.locator("button").filter({ hasText: /Check Bucket/i }).click();
    await expect(page.locator("text=Bucket ready")).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: "tests/results/filebase-06-before-upload.png" });

    await page.locator("button").filter({ hasText: /Upload Images/i }).click();
    await expect(page.locator("button").filter({ hasText: /Images Uploaded/i })).toBeVisible({ timeout: 90000 });
    await expect(page.locator("button").filter({ hasText: /Upload Metadata/i })).toBeEnabled();

    await page.screenshot({ path: "tests/results/filebase-06-images-done.png" });
  });

  // ── 7: Full flow → CID table with 3 rows ────────────────────────────────────
  test("07 — full flow: generate → upload → CID table with 3 rows", async ({ page }) => {
    await setupLayerMocks(page);
    await page.route("**/api/filebase/buckets/**", async (route: any) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ exists: true }) });
    });
    await page.route("**/api/filebase/image", async (route: any) => {
      await route.fulfill({
        status: 201, contentType: "application/json",
        body: JSON.stringify({ cid: "QmImgCID_test" }),
      });
    });
    await page.route("**/api/filebase/metadata", async (route: any) => {
      await route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify([
          { key: "metadata/1.json", cid: "QmMeta001" },
          { key: "metadata/2.json", cid: "QmMeta002" },
          { key: "metadata/3.json", cid: "QmMeta003" },
        ]),
      });
    });

    await page.goto("/dashboard/generator");
    await waitForShell(page);
    await generateNFTs(page);

    await page.locator("input[placeholder='Filebase bucket name']").fill("bearth-nft");
    await page.locator("button").filter({ hasText: /Check Bucket/i }).click();
    await expect(page.locator("text=Bucket ready")).toBeVisible({ timeout: 10000 });

    await page.locator("button").filter({ hasText: /Upload Images/i }).click();
    await expect(page.locator("button").filter({ hasText: /Images Uploaded/i })).toBeVisible({ timeout: 90000 });

    await page.screenshot({ path: "tests/results/filebase-07-before-meta.png" });

    await page.locator("button").filter({ hasText: /Upload Metadata/i }).click();
    await expect(page.locator("text=CID Summary")).toBeVisible({ timeout: 30000 });

    await page.screenshot({ path: "tests/results/filebase-07-cid-summary.png" });

    await page.locator("button").filter({ hasText: /Show CID Table/i }).click();
    await expect(page.locator("table")).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(3);
    await expect(page.locator("td").filter({ hasText: "QmImgCID_test" }).first()).toBeVisible();

    await page.screenshot({ path: "tests/results/filebase-07-cid-table.png" });
  });

  // ── 8: Copy All CIDs ─────────────────────────────────────────────────────────
  test("08 — Copy All CIDs writes correct clipboard content", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await setupLayerMocks(page);
    await page.route("**/api/filebase/buckets/**", async (route: any) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ exists: true }) });
    });
    await page.route("**/api/filebase/image", async (route: any) => {
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ cid: "QmCopyImg1" }) });
    });
    await page.route("**/api/filebase/metadata", async (route: any) => {
      await route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify([
          { key: "metadata/1.json", cid: "QmCopyMeta1" },
          { key: "metadata/2.json", cid: "QmCopyMeta2" },
          { key: "metadata/3.json", cid: "QmCopyMeta3" },
        ]),
      });
    });

    await page.goto("/dashboard/generator");
    await waitForShell(page);
    await generateNFTs(page);

    await page.locator("input[placeholder='Filebase bucket name']").fill("bearth-nft");
    await page.locator("button").filter({ hasText: /Check Bucket/i }).click();
    await expect(page.locator("text=Bucket ready")).toBeVisible({ timeout: 10000 });

    await page.locator("button").filter({ hasText: /Upload Images/i }).click();
    await expect(page.locator("button").filter({ hasText: /Images Uploaded/i })).toBeVisible({ timeout: 90000 });

    await page.locator("button").filter({ hasText: /Upload Metadata/i }).click();
    await expect(page.locator("text=CID Summary")).toBeVisible({ timeout: 30000 });

    await page.locator("button").filter({ hasText: /Copy All CIDs/i }).click();

    // Poll clipboard until populated (headless clipboard can lag after click)
    const clip = await page.waitForFunction(
      () => navigator.clipboard.readText().then(t => t.includes("Qm") ? t : null),
      { timeout: 10000 }
    ).then(h => h.jsonValue() as Promise<string>).catch(() => "");
    expect(clip).toContain("Image CID");
    expect(clip).toContain("Metadata CID");
    expect(clip).toContain("QmCopyImg1");
    expect(clip).toContain("QmCopyMeta1");

    await page.screenshot({ path: "tests/results/filebase-08-copy-cids.png" });
  });
});
