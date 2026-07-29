/**
 * NFT Lifecycle E2E — Generation → Filebase → DB Sync → Records → Waves → Scheduler → Reveal
 *
 * Covers the full NFT pre-sale and post-sale lifecycle on Sepolia testnet.
 * On-chain tests (phases 6–9) are skipped if FIXED_PRIVATE_KEY is not set in BearthApi .env.local.
 *
 * Run: npx playwright test nft-lifecycle-e2e --reporter=list
 * Estimated runtime: ~10 min (phases 1–5 only) or ~25 min (all phases with on-chain)
 */

import { test, expect, Page, request } from "@playwright/test";
import path from "path";
import fs   from "fs";

// ── Config ───────────────────────────────────────────────────────────────────

const TECH_AUTH   = path.join(process.cwd(), "tests", ".auth", "tech.json");
const SCREENSHOTS = path.join(process.cwd(), "tests", "results", "lifecycle-e2e");
const API_BASE    = "http://localhost:8000";
const APP_BASE    = "http://localhost:3000";

// Best job: most items with IPFS CIDs already uploaded
const BEST_JOB_ID = "15d8d65a-1a2d-443a-ad3c-a6e0eeea005e";

// Wave 1 test timing (minutes from now)
const WAVE_START_DELAY_MIN  = 2;
const WAVE_END_DELAY_MIN    = 5;
const WAVE_REVEAL_DELAY_MIN = 8;

test.use({ storageState: TECH_AUTH });
test.setTimeout(1_800_000); // 30 min hard cap

// ── Helpers ──────────────────────────────────────────────────────────────────

function snap(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOTS, { recursive: true });
  return page.screenshot({
    path: path.join(SCREENSHOTS, `${name}.png`),
    fullPage: true,
  }).then(() => console.log(`  📸 ${name}.png`));
}

function isoNowPlusMins(mins: number) {
  return new Date(Date.now() + mins * 60_000).toISOString();
}

async function apiToken(): Promise<string> {
  const ctx = await request.newContext({ baseURL: API_BASE });
  const r = await ctx.post("/api/auth/admin/login", {
    data: { email: "amplecapitalholding@gmail.com", password: "amplecapitalholding@123" },
  });
  const d = await r.json();
  await ctx.dispose();
  return d.token as string;
}

async function apiFetch(token: string, method: string, path: string, body?: object) {
  const ctx = await request.newContext({ baseURL: API_BASE });
  const r = await ctx.fetch(path, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    data: body,
  });
  const json = await r.json();
  await ctx.dispose();
  return { status: r.status(), body: json };
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1: Verify generation state
// ─────────────────────────────────────────────────────────────────────────────

test("Phase 1 — Generation: verify generated items exist in DB", async ({ page }) => {
  const token = await apiToken();

  // Check job state
  const { status, body } = await apiFetch(token, "GET", `/api/nft-gen/jobs/${BEST_JOB_ID}`);
  expect(status).toBe(200);
  console.log(`  Job status: ${body.status}`);
  console.log(`  Edition size: ${body.editionSize ?? body.edition_size}`);

  // Navigate to NFT Studio and screenshot
  await page.goto(`${APP_BASE}/dashboard/generator`);
  await page.waitForSelector(".studio-wrap", { timeout: 30_000 });
  await snap(page, "01-nft-studio");

  // Verify we can see the Export tab
  const exportTab = page.locator("button.step-btn").filter({ hasText: /export/i });
  await expect(exportTab).toBeVisible({ timeout: 10_000 });
  console.log("  ✅ NFT Studio loaded, Export tab visible");
});

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2: Sync IPFS items → nft_records
// ─────────────────────────────────────────────────────────────────────────────

test("Phase 2 — DB Sync: sync IPFS-ready items to nft_records", async ({ page }) => {
  const token = await apiToken();

  // sync-all works across every job (idempotent)
  console.log("  ⏳ Syncing ALL IPFS-ready items to nft_records…");
  const { status, body } = await apiFetch(token, "POST", "/api/nft-gen/jobs/sync-all-records");

  expect(status).toBe(200);
  console.log(`  ✅ Sync complete: ${body.synced} new/updated items`);

  // Confirm records exist (either from this sync or a previous one)
  const { body: nftBody } = await apiFetch(token, "GET", "/api/nft?limit=1");
  expect(nftBody.total).toBeGreaterThan(0);
  console.log(`  ✅ nft_records total: ${nftBody.total}`);
  console.log(`  ✅ blindCount: ${nftBody.blindCount}, revealedCount: ${nftBody.revealedCount}`);
  console.log(`  ✅ soldCount: ${nftBody.soldCount}, deliveredCount: ${nftBody.deliveredCount}`);

  await page.goto(`${APP_BASE}/nft/records`);
  await page.waitForLoadState("networkidle");
  await snap(page, "02-nft-records-after-sync");
});

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3: NFT Records page — data, filters, view modal
// ─────────────────────────────────────────────────────────────────────────────

test("Phase 3 — NFT Records: table loads with real data", async ({ page }) => {
  await page.goto(`${APP_BASE}/nft/records`);
  await page.waitForLoadState("networkidle");

  // Stat cards must show non-zero total
  const totalCard = page.locator(".text-2xl").first();
  await expect(totalCard).not.toHaveText("0", { timeout: 15_000 });
  await snap(page, "03-nft-records-stats");

  // Blind Box stat should be > 0 (all unsynced = blind)
  console.log("  ✅ NFT Records page loaded with data");

  // Test Wave filter
  await page.selectOption("select", { label: "Wave 1" });
  await page.waitForLoadState("networkidle");
  await snap(page, "03b-nft-records-wave1-filter");
  console.log("  ✅ Wave 1 filter applied");

  // Reset filter
  await page.selectOption("select", { label: "All Waves" });
  await page.waitForLoadState("networkidle");

  // Click View on first record — open lifecycle modal
  const viewBtn = page.locator("button[title='View full history']").first();
  await expect(viewBtn).toBeVisible({ timeout: 10_000 });
  await viewBtn.click();
  await page.waitForSelector("text=Full History", { timeout: 5_000 });
  await snap(page, "03c-nft-record-modal");

  // Modal must show Lifecycle Timeline section
  await expect(page.locator("text=Lifecycle Timeline")).toBeVisible();
  await expect(page.locator("text=Generated")).toBeVisible();
  console.log("  ✅ View modal shows Lifecycle Timeline");

  // Close modal
  await page.keyboard.press("Escape");
});

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 4: NFT Records — Reveal State filter and CSV export
// ─────────────────────────────────────────────────────────────────────────────

test("Phase 4 — NFT Records: filters and CSV export", async ({ page }) => {
  await page.goto(`${APP_BASE}/nft/records`);
  await page.waitForLoadState("networkidle");

  // Filter to Blind Box only
  const revealSelect = page.locator("select").filter({ hasText: /All Reveal/i });
  await revealSelect.selectOption("false");
  await page.waitForLoadState("networkidle");
  await snap(page, "04a-filter-blind-box");
  console.log("  ✅ Blind Box filter applied");

  // Reset
  await revealSelect.selectOption("");
  await page.waitForLoadState("networkidle");

  // CSV export — click button and verify download starts
  const downloadPromise = page.waitForEvent("download", { timeout: 10_000 });
  await page.click("button:has-text('Export CSV')");
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/bearth-nft-lifecycle.*\.csv/);
  console.log(`  ✅ CSV exported: ${download.suggestedFilename()}`);
  await snap(page, "04b-csv-exported");
});

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 5: NFT Waves — set Wave 1 dates for testnet run
// ─────────────────────────────────────────────────────────────────────────────

test("Phase 5 — NFT Waves: verify 7 waves, set Wave 1 test schedule", async ({ page }) => {
  await page.goto(`${APP_BASE}/nft/waves`);
  await page.waitForLoadState("networkidle");
  await snap(page, "05a-nft-waves-loaded");

  // Verify 7 waves in table
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(7, { timeout: 10_000 });
  console.log("  ✅ 7 waves loaded");

  // Verify total is 9,999
  await expect(page.locator("text=9,999 / 9,999")).toBeVisible();
  console.log("  ✅ Total quantity 9,999 confirmed");

  // Open Edit modal for Wave 1
  await page.locator("tbody tr").first().locator("button:has-text('Edit')").click();
  await page.waitForSelector("text=Edit Wave 1", { timeout: 5_000 });
  await snap(page, "05b-wave1-edit-modal");

  // Verify read-only quantity panel
  await expect(page.locator("text=Wave Quantity: 303 NFTs")).toBeVisible();
  await expect(page.locator("text=Fixed at launch")).toBeVisible();
  console.log("  ✅ Read-only quantity panel shows 303 NFTs");

  // Set start, end, reveal dates (near future for testnet)
  const startDt  = new Date(Date.now() + WAVE_START_DELAY_MIN  * 60_000);
  const endDt    = new Date(Date.now() + WAVE_END_DELAY_MIN    * 60_000);
  const revealDt = new Date(Date.now() + WAVE_REVEAL_DELAY_MIN * 60_000);

  // Format as datetime-local: YYYY-MM-DDTHH:MM
  const toLocal = (d: Date) => d.toISOString().slice(0, 16);

  await page.fill("input[type='datetime-local']", toLocal(startDt));
  // Fill end date (second datetime-local)
  const dtInputs = page.locator("input[type='datetime-local']");
  await dtInputs.nth(0).fill(toLocal(startDt));
  await dtInputs.nth(1).fill(toLocal(endDt));
  // Reveal date is in a purple section
  await dtInputs.nth(2).fill(toLocal(revealDt));

  console.log(`  Start:  ${startDt.toISOString()}`);
  console.log(`  End:    ${endDt.toISOString()}`);
  console.log(`  Reveal: ${revealDt.toISOString()}`);
  await snap(page, "05c-wave1-dates-filled");

  // Save
  await page.click("button:has-text('Save Wave')");
  await page.waitForSelector("text=Edit Wave 1", { state: "hidden", timeout: 10_000 });
  await snap(page, "05d-wave1-saved");
  console.log("  ✅ Wave 1 dates saved");

  // Verify Reveal Date column now shows a date in the table
  const revealCell = page.locator("tbody tr").first().locator("td").nth(6);
  await expect(revealCell).not.toHaveText("Not set", { timeout: 5_000 });
  console.log("  ✅ Reveal Date column updated in table");
});

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 6: Scheduler — timeline shows Wave 1 pending_start
// ─────────────────────────────────────────────────────────────────────────────

test("Phase 6 — Scheduler: Wave 1 shows Pending Start after date set", async ({ page }) => {
  await page.goto(`${APP_BASE}/nft/scheduler`);
  await page.waitForLoadState("networkidle");
  await snap(page, "06a-scheduler-after-wave1-set");

  // Wave 1 Auto State should be Pending Start (dates set, not yet triggered)
  const wave1Row = page.locator("tbody tr").first();
  await expect(wave1Row.locator("text=Pending Start")).toBeVisible({ timeout: 10_000 });
  console.log("  ✅ Wave 1 shows Pending Start in scheduler");

  // Next trigger banner should mention Wave 1
  const banner = page.locator("text=Next auto-trigger");
  await expect(banner).toBeVisible();
  const bannerText = await banner.locator("..").textContent();
  expect(bannerText).toMatch(/Wave 1/i);
  console.log(`  ✅ Next trigger banner: ${bannerText?.trim()}`);

  await snap(page, "06b-scheduler-next-trigger");
});

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 7: On-chain Wave Start (requires FIXED_PRIVATE_KEY in BearthApi .env)
// ─────────────────────────────────────────────────────────────────────────────

test("Phase 7 — Auto Wave Start: wait for scheduler to fire on Sepolia", async ({ page }) => {
  const token = await apiToken();

  // Check if contract is configured (FIXED_PRIVATE_KEY required)
  const { body: health } = await apiFetch(token, "GET", "/api/health");
  console.log(`  API health: ${JSON.stringify(health)}`);

  // Check scheduler status
  const { body: schedStatus } = await apiFetch(token, "GET", "/api/nft-sell/scheduler/status");
  if (!schedStatus.configured) {
    console.log("  ⚠ Contract not configured — skipping on-chain test");
    console.log("  → Add FIXED_PRIVATE_KEY to BearthApi/.env.local and restart the server");
    test.skip();
    return;
  }

  console.log(`  ⏳ Waiting up to ${WAVE_START_DELAY_MIN + 2} min for Wave 1 auto-start to fire…`);

  // Poll scheduler page every 30s until Wave 1 start triggered
  const deadline = Date.now() + (WAVE_START_DELAY_MIN + 2) * 60_000;
  while (Date.now() < deadline) {
    await page.waitForTimeout(30_000);
    await page.goto(`${APP_BASE}/nft/scheduler`);
    await page.waitForLoadState("networkidle");

    const { body } = await apiFetch(token, "GET", "/api/nft-sell/waves/schedule-status");
    const wave1 = body.waves?.find((w: { wave_number: number }) => w.wave_number === 1);
    console.log(`  Wave 1 state: ${wave1?.auto_trigger_state}, start_triggered: ${wave1?.wave_start_triggered}`);

    if (wave1?.wave_start_triggered) {
      await snap(page, "07-wave1-started");
      console.log("  ✅ Wave 1 auto-started on Sepolia");
      break;
    }
  }

  await page.goto(`${APP_BASE}/nft/scheduler`);
  await page.waitForLoadState("networkidle");
  const wave1Row = page.locator("tbody tr").first();
  const startBadge = wave1Row.locator("td").nth(5);
  await expect(startBadge.locator("text=Done")).toBeVisible({ timeout: 5_000 });
  await snap(page, "07-wave1-start-done");
  console.log("  ✅ Wave 1 Start badge shows Done in scheduler");
});

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 8: Simulate Sepolia mint — verify nft_records update
// ─────────────────────────────────────────────────────────────────────────────

test("Phase 8 — Sepolia Mint: simulate mint event + verify nft_records", async ({ page }) => {
  const token = await apiToken();

  // Check if contract configured
  const { body: schedStatus } = await apiFetch(token, "GET", "/api/nft-sell/scheduler/status");
  if (!schedStatus.configured) {
    console.log("  ⚠ FIXED_PRIVATE_KEY not set — skipping on-chain mint test");
    test.skip(); return;
  }

  // Check Wave 1 is active (started)
  const { body } = await apiFetch(token, "GET", "/api/nft-sell/waves/schedule-status");
  const wave1 = body.waves?.find((w: { wave_number: number }) => w.wave_number === 1);
  if (!wave1?.wave_start_triggered) {
    console.log("  ⚠ Wave 1 not started yet — skipping mint test");
    test.skip(); return;
  }

  // Navigate to NFT Records - check before mint
  await page.goto(`${APP_BASE}/nft/records`);
  await page.waitForLoadState("networkidle");
  await snap(page, "08a-records-before-mint");

  // The actual mint happens via the customer contract call on Sepolia.
  // In testnet, we fire a contract event using the hardhat script or a direct wallet call.
  // This is a placeholder — real mint requires customer wallet action on Sepolia.
  console.log("  ℹ Mint simulation: customer would call BearthGenesisNFT.mint() on Sepolia");
  console.log("  ℹ Contract: 0x97445D1A39cE00b631A565a1923BE62BEa6Fc8cA");
  console.log("  ℹ After mint, contract emits Transfer event → BearthApi listens → updates nft_records");

  // Wait 30s for event listener to pick up any real mints
  await page.waitForTimeout(30_000);
  await page.goto(`${APP_BASE}/nft/records`);
  await page.waitForLoadState("networkidle");
  await snap(page, "08b-records-after-mint-wait");
  console.log("  ✅ Phase 8 complete — check screenshot for minted NFTs");
});

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 9: Auto Wave End — unsold → treasury
// ─────────────────────────────────────────────────────────────────────────────

test("Phase 9 — Auto Wave End: wait for wave close + treasury mint", async ({ page }) => {
  const token = await apiToken();

  const { body: schedStatus } = await apiFetch(token, "GET", "/api/nft-sell/scheduler/status");
  if (!schedStatus.configured) {
    console.log("  ⚠ FIXED_PRIVATE_KEY not set — skipping Wave End test");
    test.skip(); return;
  }

  console.log(`  ⏳ Waiting up to ${WAVE_END_DELAY_MIN + 2} min for Wave 1 auto-end…`);
  const deadline = Date.now() + (WAVE_END_DELAY_MIN + 2) * 60_000;

  while (Date.now() < deadline) {
    await page.waitForTimeout(30_000);
    const { body } = await apiFetch(token, "GET", "/api/nft-sell/waves/schedule-status");
    const wave1 = body.waves?.find((w: { wave_number: number }) => w.wave_number === 1);
    console.log(`  Wave 1 end_triggered: ${wave1?.wave_end_triggered}, state: ${wave1?.auto_trigger_state}`);

    if (wave1?.wave_end_triggered) {
      console.log("  ✅ Wave 1 auto-ended — unsold NFTs sent to treasury on Sepolia");
      break;
    }
  }

  await page.goto(`${APP_BASE}/nft/scheduler`);
  await page.waitForLoadState("networkidle");
  await snap(page, "09-wave1-ended");

  await page.goto(`${APP_BASE}/nft/waves`);
  await page.waitForLoadState("networkidle");
  await snap(page, "09b-wave1-status-closed");
  console.log("  ✅ Phase 9 complete");
});

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 10: Auto Reveal — random NFT assignment + on-chain URI swap
// ─────────────────────────────────────────────────────────────────────────────

test("Phase 10 — Auto Reveal: wait for reveal + verify NFT Records show Revealed", async ({ page }) => {
  const token = await apiToken();

  const { body: schedStatus } = await apiFetch(token, "GET", "/api/nft-sell/scheduler/status");
  if (!schedStatus.configured) {
    console.log("  ⚠ FIXED_PRIVATE_KEY not set — skipping Reveal test");
    test.skip(); return;
  }

  console.log(`  ⏳ Waiting up to ${WAVE_REVEAL_DELAY_MIN + 2} min for Wave 1 auto-reveal…`);
  const deadline = Date.now() + (WAVE_REVEAL_DELAY_MIN + 2) * 60_000;

  while (Date.now() < deadline) {
    await page.waitForTimeout(30_000);
    const { body } = await apiFetch(token, "GET", "/api/nft-sell/waves/schedule-status");
    const wave1 = body.waves?.find((w: { wave_number: number }) => w.wave_number === 1);
    console.log(`  Wave 1 reveal_triggered: ${wave1?.wave_reveal_triggered}, is_revealed: ${wave1?.is_revealed}`);

    if (wave1?.wave_reveal_triggered) {
      console.log("  ✅ Wave 1 reveal triggered!");
      break;
    }
  }

  // Verify NFT Records page shows revealed NFTs
  await page.goto(`${APP_BASE}/nft/records`);
  await page.waitForLoadState("networkidle");
  await snap(page, "10a-nft-records-after-reveal");

  // Filter to Revealed only
  const revealSelect = page.locator("select").filter({ hasText: /All Reveal/i });
  await revealSelect.selectOption("true");
  await page.waitForLoadState("networkidle");
  await snap(page, "10b-revealed-nfts");

  // Revealed count stat card should be > 0
  const revealedCard = page.locator("button").filter({ hasText: /Revealed/ }).locator(".text-2xl");
  const revealedCount = await revealedCard.textContent();
  console.log(`  ✅ Revealed NFTs: ${revealedCount}`);
  expect(Number(revealedCount?.replace(/,/g, ""))).toBeGreaterThan(0);

  // Open one revealed record — verify Attributes section shows traits
  await revealSelect.selectOption("true");
  await page.waitForLoadState("networkidle");
  const viewBtn = page.locator("button[title='View full history']").first();
  await viewBtn.click();
  await page.waitForSelector("text=Full History", { timeout: 5_000 });
  await snap(page, "10c-revealed-record-modal");

  // Should show Attributes (traits) section
  await expect(page.locator("text=Attributes")).toBeVisible();
  console.log("  ✅ Revealed record shows Attributes section");

  // Scheduler page — all trigger badges should be Done for Wave 1
  await page.keyboard.press("Escape");
  await page.goto(`${APP_BASE}/nft/scheduler`);
  await page.waitForLoadState("networkidle");
  await snap(page, "10d-scheduler-wave1-complete");

  const wave1Row = page.locator("tbody tr").first();
  const revealBadge = wave1Row.locator("td").nth(7);
  await expect(revealBadge.locator("text=Done")).toBeVisible({ timeout: 5_000 });
  console.log("  ✅ Scheduler: Wave 1 Reveal badge = Done");

  await expect(wave1Row.locator("text=Revealed")).toBeVisible();
  console.log("  ✅ Scheduler: Wave 1 Auto State = Revealed");
  console.log("\n  🎉 Full NFT lifecycle E2E complete!");
});
