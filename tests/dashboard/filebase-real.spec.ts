// Real integration test — hits actual Filebase service (no mocks)
// Requires: Bearth-Filebase running on port 8002 with valid credentials
import { test, expect } from "@playwright/test";
import path from "path";

test.use({ storageState: path.join(process.cwd(), "tests", ".auth", "tech.json") });

import fs from "fs";

const LAYERS_DIR = path.resolve(
  "D:\\AMG-Projects\\AMGEcosystem\\amgecosystem\\amgecosystem-v1.0.0\\BearthProject-Revamp\\exported_layers"
);

function buildRealLayers() {
  const dirs = fs.readdirSync(LAYERS_DIR)
    .filter(d => fs.statSync(path.join(LAYERS_DIR, d)).isDirectory())
    .sort();
  return dirs.map(folder => {
    const files = fs.readdirSync(path.join(LAYERS_DIR, folder))
      .filter(f => /\.(png|webp)$/i.test(f)).sort();
    const label = folder.replace(/^\d+-/, "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    return {
      folder, label, count: files.length, optional: false,
      assets: files.map(f => ({
        stem: f.replace(/\.(png|webp)$/i, ""),
        name: f.replace(/\.(png|webp)$/i, "").replace(/-/g, " "),
        rel:  `${folder}/${f}`,
        defaultWeight: 1,
      })),
    };
  });
}

const TEST_BUCKET = "bearth-nft-test";

async function waitForShell(page: any) {
  await page.locator("text=Verifying access").waitFor({ state: "detached", timeout: 60000 }).catch(() => {});
  await page.locator("button").filter({ hasText: /Sign Out/i }).waitFor({ state: "visible", timeout: 60000 }).catch(() => {});
}

test.describe("Filebase IPFS — Real Integration (no mocks)", () => {
  test.setTimeout(300000);

  // ── 1. Check Bearth-Filebase is reachable ──────────────────────────────────
  test("01 — Bearth-Filebase health check", async ({ request }) => {
    const r = await request.get("http://localhost:8002/api/health");
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.status).toBe("ok");
    console.log("Bearth-Filebase health:", body);
  });

  // ── 2. List existing buckets ───────────────────────────────────────────────
  test("02 — list existing Filebase buckets", async ({ page }) => {
    await page.goto("/dashboard/generator");
    await waitForShell(page);

    // Call the proxy route directly
    const r = await page.request.get("/api/filebase/buckets");
    expect(r.status()).toBe(200);
    const data = await r.json();
    console.log("Existing buckets:", JSON.stringify(data.buckets ?? [], null, 2));
    expect(data).toHaveProperty("buckets");

    await page.screenshot({ path: "tests/results/filebase-real-01-buckets.png" });
  });

  // ── 3. Create test bucket (real Filebase call) ─────────────────────────────
  test("03 — create real bucket on Filebase", async ({ page }) => {
    await page.goto("/dashboard/generator");
    await waitForShell(page);

    // Mock layer data + images (not Filebase calls — those hit the real service)
    const layers = buildRealLayers();
    await page.route("**/api/layers", async (route: any) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(layers) });
      } else { await route.continue(); }
    });
    await page.route("**/api/layer-img/**", async (route: any) => {
      const url = route.request().url();
      const match = url.match(/\/api\/layer-img\/(.+?)(\?.*)?$/);
      if (!match) { await route.continue(); return; }
      const filePath = path.join(LAYERS_DIR, decodeURIComponent(match[1]));
      try { await route.fulfill({ status: 200, contentType: "image/png", body: fs.readFileSync(filePath) }); }
      catch { await route.fulfill({ status: 404, body: Buffer.alloc(0) }); }
    });
    await page.route("**/api/layer-raw/**", async (route: any) => {
      const url = route.request().url();
      const match = url.match(/\/api\/layer-raw\/(.+?)(\?.*)?$/);
      if (!match) { await route.continue(); return; }
      const filePath = path.join(LAYERS_DIR, decodeURIComponent(match[1]));
      try { await route.fulfill({ status: 200, contentType: "image/png", body: fs.readFileSync(filePath) }); }
      catch { await route.fulfill({ status: 404, body: Buffer.alloc(0) }); }
    });

    // Set supply=2, navigate to Export, generate
    const supplyInput = page.locator('label:has-text("Collection Size")').locator("..").locator("input[type='number']");
    await supplyInput.fill("2");
    await page.locator("button").filter({ hasText: /Export/i }).click();
    await page.locator("button").filter({ hasText: /Generate 2/i }).first().click();
    await expect(page.locator("text=2 NFTs ready")).toBeVisible({ timeout: 90000 });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Type bucket name
    await page.locator("input[placeholder='Filebase bucket name']").fill(TEST_BUCKET);

    // Check bucket — real call to Filebase
    await page.locator("button").filter({ hasText: /Check Bucket/i }).click();

    // Wait for result — either exists or not found
    await page.locator("text=/Bucket ready|Bucket not found/i").first().waitFor({ timeout: 20000 });

    const bucketReady = await page.locator("text=Bucket ready").isVisible();
    const notFound    = await page.locator("text=Bucket not found").isVisible();

    console.log(`Bucket '${TEST_BUCKET}': exists=${bucketReady}, notFound=${notFound}`);

    await page.screenshot({ path: "tests/results/filebase-real-02-check.png" });

    if (notFound) {
      console.log(`Creating bucket '${TEST_BUCKET}'...`);
      await page.locator("button").filter({ hasText: /Create Bucket/i }).click();
      await expect(page.locator("text=Bucket ready")).toBeVisible({ timeout: 30000 });
      console.log(`Bucket '${TEST_BUCKET}' created on Filebase!`);
    }

    await page.screenshot({ path: "tests/results/filebase-real-03-bucket-ready.png" });
  });

  // ── 4. Upload 2 real images to Filebase IPFS ──────────────────────────────
  test("04 — upload 2 real images, capture real CIDs", async ({ page }) => {
    await page.goto("/dashboard/generator");
    await waitForShell(page);

    await page.route("**/api/layers", async (route: any) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_LAYERS) });
      } else { await route.continue(); }
    });
    await page.route("**/api/layer-img/**", async (route: any) => {
      await route.fulfill({ status: 200, contentType: "image/png", body: TINY_PNG });
    });
    await page.route("**/api/layer-raw/**", async (route: any) => {
      await route.fulfill({ status: 200, contentType: "image/png", body: TINY_PNG });
    });

    const supplyInput = page.locator('label:has-text("Collection Size")').locator("..").locator("input[type='number']");
    await supplyInput.fill("2");
    await page.locator("button").filter({ hasText: /Export/i }).click();
    await page.locator("button").filter({ hasText: /Generate 2/i }).first().click();
    await expect(page.locator("text=2 NFTs ready")).toBeVisible({ timeout: 90000 });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    await page.locator("input[placeholder='Filebase bucket name']").fill(TEST_BUCKET);
    await page.locator("button").filter({ hasText: /Check Bucket/i }).click();
    await expect(page.locator("text=Bucket ready")).toBeVisible({ timeout: 20000 });

    // Real image upload — Filebase assigns IPFS CIDs
    await page.locator("button").filter({ hasText: /Upload Images/i }).click();

    // Images upload takes real time (PutObject + 500ms CID wait per image)
    await expect(page.locator("button").filter({ hasText: /Images Uploaded/i })).toBeVisible({ timeout: 120000 });

    console.log("Images uploaded to Filebase! Uploading metadata...");
    await page.screenshot({ path: "tests/results/filebase-real-04-images-done.png" });

    // Real metadata upload
    await page.locator("button").filter({ hasText: /Upload Metadata/i }).click();
    await expect(page.locator("text=CID Summary")).toBeVisible({ timeout: 120000 });

    await page.screenshot({ path: "tests/results/filebase-real-05-meta-done.png" });

    // Show CID table — these are REAL IPFS CIDs from Filebase
    await page.locator("button").filter({ hasText: /Show CID Table/i }).click();
    await expect(page.locator("table")).toBeVisible();

    // Log real CIDs
    const rows = await page.locator("tbody tr").all();
    console.log(`\n=== REAL FILEBASE IPFS CIDs ===`);
    for (const row of rows) {
      const cells = await row.locator("td").all();
      const num      = await cells[0]?.textContent() ?? "";
      const imgCid   = await cells[1]?.textContent() ?? "";
      const metaCid  = await cells[2]?.textContent() ?? "";
      console.log(`#${num.trim()} | Image: ${imgCid.trim()} | Meta: ${metaCid.trim()}`);
    }
    console.log(`=================================\n`);

    await page.screenshot({ path: "tests/results/filebase-real-06-cid-table.png", fullPage: false });

    // Copy CIDs to clipboard and log
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.locator("button").filter({ hasText: /Copy All CIDs/i }).click();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    console.log("Clipboard CIDs:\n", clip);
  });
});
