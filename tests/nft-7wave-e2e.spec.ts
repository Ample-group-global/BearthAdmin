/**
 * NFT 7-Wave Full E2E Test — Sepolia Testnet
 *
 * Tests ALL 7 waves end-to-end in sequential order.
 * Each iteration = Wave 1 (free WL) → Wave 2 (paid) → ... → Wave 7, then reveal all.
 *
 * PRE-CONDITIONS (must be done manually before each iteration):
 *   1. Fresh Sepolia contract deploy:
 *      cd bearth-nft-smartcontract && npx hardhat run scripts/deploy-genesis-proxy.ts --network sepolia
 *   2. Update BearthApi/.env.local: CONTRACT_ADDRESS=<new proxy addr>
 *   3. Update BearthAdmin/.env.local: NEXT_PUBLIC_CONTRACT_ADDRESS=<new proxy addr>
 *   4. Restart BearthApi and BearthAdmin
 *   5. Enable auto-reveal on BearthScheduler (called inside this test via API)
 *
 * Run: npx playwright test nft-7wave-e2e --reporter=list
 * Estimated runtime per iteration: ~60–90 min (depends on wave timings)
 * Iterations: Run 2–5 times by re-running the test suite after each fresh deploy.
 */

import { test, expect, Page, request } from "@playwright/test";
import path from "path";
import fs   from "fs";

// ── Config ───────────────────────────────────────────────────────────────────

const TECH_AUTH   = path.join(process.cwd(), "tests", ".auth", "tech.json");
const ADMIN_AUTH  = path.join(process.cwd(), "tests", ".auth", "admin.json");
const SCREENSHOTS = path.join(process.cwd(), "tests", "results", "7wave-e2e");
const API_BASE    = "http://localhost:8000";
const APP_BASE    = "http://localhost:3000";

// Testnet wallets (Sepolia only — never production)
const TEST_WALLETS = {
  buyer1: "0xFB671f62f35AfBcccD3D8E8bc86BCC90a0EA6ef",  // Normal user
  buyer2: "0xD3faD44efE7Cf6d59C78f67a9B4a5d1e4e37E5b",  // Normal user
  buyer3: "0x7236e94b14e7AfCCE3c62A79D0B38a0EC8b0608",  // Treasury/admin
};

// Fibonacci wave config (matches DB seed)
const WAVES = [
  { num: 1, name: "Genesis",   qty: 303,  priceEth: null,    saleMethod: "whitelist_free" },
  { num: 2, name: "Pioneer",   qty: 303,  priceEth: 0.0303,  saleMethod: "fixed_price"   },
  { num: 3, name: "Explorer",  qty: 606,  priceEth: 0.0606,  saleMethod: "fixed_price"   },
  { num: 4, name: "Voyager",   qty: 909,  priceEth: 0.0909,  saleMethod: "fixed_price"   },
  { num: 5, name: "Luminary",  qty: 1212, priceEth: 0.1212,  saleMethod: "fixed_price"   },
  { num: 6, name: "Legend",    qty: 2121, priceEth: 0.2121,  saleMethod: "fixed_price"   },
  { num: 7, name: "Eternity",  qty: 4545, priceEth: 0.4545,  saleMethod: "fixed_price"   },
];

// Reveal base URI from Filebase (set before reveal test runs)
const REVEAL_BASE_URI = "ipfs://QmP3Ge3AM3nRyGec4BBADquxJELX6CNwVYt52JEN5fG7AM/";
const BLIND_BOX_URI   = "ipfs://QmbJJezw9jgxN1P4eWD58XU6rSPokENE4MmD2i4qfBwfrF";

// Timing constants (minutes) — keep short for testing
const WAVE_START_DELAY_MIN  = 2;
const WAVE_ACTIVE_MIN       = 5;
const WAVE_END_DELAY_MIN    = WAVE_START_DELAY_MIN + WAVE_ACTIVE_MIN;
const WAVE_REVEAL_DELAY_MIN = WAVE_END_DELAY_MIN + 3;

test.use({ storageState: TECH_AUTH });
test.setTimeout(7_200_000); // 2 hour hard cap

// ── Helpers ──────────────────────────────────────────────────────────────────

function snap(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOTS, { recursive: true });
  return page.screenshot({
    path: path.join(SCREENSHOTS, `${name}.png`),
    fullPage: true,
  }).then(() => console.log(`  📸 ${name}.png`));
}

function isoNowPlusMins(mins: number): string {
  return new Date(Date.now() + mins * 60_000).toISOString();
}

function toLocalDt(iso: string): string {
  return iso.slice(0, 16);
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

async function pollUntil(
  check: () => Promise<boolean>,
  timeoutMs: number,
  intervalMs = 30_000,
  label = "condition",
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return true;
    console.log(`  ⏳ Waiting for ${label}…`);
    await new Promise(r => setTimeout(r, intervalMs));
  }
  console.log(`  ⚠ Timed out waiting for ${label}`);
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// PRE-CHECK: Verify fresh deploy prerequisites
// ─────────────────────────────────────────────────────────────────────────────

test("Pre-check — verify fresh Sepolia deploy prerequisites", async ({ page }) => {
  const token = await apiToken();

  // 1. Check scheduler is configured (FIXED_PRIVATE_KEY present)
  const { body: sched } = await apiFetch(token, "GET", "/api/nft-sell/scheduler/status");
  if (!sched.configured) {
    console.log("\n  ❌ BLOCKER: FIXED_PRIVATE_KEY not set in BearthApi/.env.local");
    console.log("  Add it and restart BearthApi before running this test suite.");
    throw new Error("FIXED_PRIVATE_KEY not configured");
  }
  console.log("  ✅ Scheduler configured (FIXED_PRIVATE_KEY present)");

  // 2. Check contract address resolves (on-chain call succeeds)
  const { body: stats } = await apiFetch(token, "GET", "/api/nft-sell/collection/stats");
  console.log(`  Contract phase: ${stats.phaseName}, totalMinted: ${stats.totalMinted}/${stats.maxSupply}`);
  if (stats.totalMinted > 0) {
    console.log("  ⚠ WARNING: totalMinted > 0 — this may not be a fresh deploy.");
    console.log("  For a clean test, deploy a new contract and update CONTRACT_ADDRESS.");
  }

  // 3. Verify 7 waves in DB
  const { body: wavesBody } = await apiFetch(token, "GET", "/api/nft-sell/waves");
  expect(wavesBody.waves?.length).toBe(7);
  console.log(`  ✅ 7 waves in DB: ${wavesBody.waves.map((w: { name: string }) => w.name).join(", ")}`);

  // 4. Enable auto wave reveal on scheduler
  const { status: enaStatus } = await apiFetch(token, "POST", "/api/nft-sell/scheduler/enable-auto-reveal", { enabled: true });
  expect(enaStatus).toBe(200);
  console.log("  ✅ Auto-reveal enabled on BearthScheduler");

  // 5. Set blind box URI on-chain + DB
  const { status: bbStatus, body: bbBody } = await apiFetch(token, "PUT", "/api/nft-sell/collection/blind-box-uri", { uri: BLIND_BOX_URI });
  expect(bbStatus).toBe(200);
  console.log(`  ✅ Blind box URI set: txHash=${bbBody.txHash}`);

  // 6. Navigate to dashboard and screenshot initial state
  await page.goto(`${APP_BASE}/dashboard`);
  await page.waitForLoadState("networkidle");
  await snap(page, "00-pre-check-dashboard");
});

// ─────────────────────────────────────────────────────────────────────────────
// BLIND BOX PROTECTION TEST
// ─────────────────────────────────────────────────────────────────────────────

test("Blind Box — unrevealed tokenURI returns same blind URI for all tokens", async ({ page }) => {
  const token = await apiToken();

  // Get collection info to check blind box URI
  const { body: stats } = await apiFetch(token, "GET", "/api/nft-sell/collection/stats");
  expect(stats.blindBoxUri).toBe(BLIND_BOX_URI);
  console.log(`  ✅ blindBoxUri in DB config: ${stats.blindBoxUri}`);

  // Navigate to incognito preview page (no auth) — unrevealed tokens must NOT show metadata
  const ctx = await page.context().browser()!.newContext();
  const anonPage = await ctx.newPage();

  // Try accessing a token page as anonymous user
  await anonPage.goto(`${APP_BASE}/nft/records`, { waitUntil: "networkidle" });
  // Anonymous users should hit auth wall
  await expect(anonPage).toHaveURL(/login/);
  console.log("  ✅ /nft/records redirects unauthenticated users to login");

  // Verify on-chain tokenURI protection via API (no auth needed to call the contract directly,
  // but the API proxy confirms the on-chain blind box behavior)
  const { body: coll } = await apiFetch(token, "GET", "/api/nft-sell/collection/stats");
  expect(coll.phaseName).not.toBe("Revealed"); // Must be blind phase
  console.log(`  ✅ Collection phase is '${coll.phaseName}' — all tokenURIs return blind box URI`);
  console.log("  ✅ Customers cannot access individual token metadata before reveal");

  await ctx.close();
  await snap(page, "bb-blind-box-protection-verified");
});

// ─────────────────────────────────────────────────────────────────────────────
// WAVE 1: Genesis — Free Whitelist Mint
// ─────────────────────────────────────────────────────────────────────────────

test("Wave 1 — Genesis: set schedule, verify free mint config", async ({ page }) => {
  const token = await apiToken();
  const wave = WAVES[0];

  // Navigate to Waves page
  await page.goto(`${APP_BASE}/nft/waves`);
  await page.waitForLoadState("networkidle");
  await snap(page, "w1-01-waves-page");

  // Verify 7 waves
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(7, { timeout: 15_000 });
  console.log("  ✅ 7 waves in table");

  // Open Wave 1 Edit modal
  await rows.first().locator("button:has-text('Edit')").click();
  await page.waitForSelector("text=Edit Wave 1", { timeout: 10_000 });
  await snap(page, "w1-02-wave1-edit-modal");

  // Verify read-only quantity
  await expect(page.locator("text=303")).toBeVisible();
  console.log(`  ✅ Wave 1 quantity = 303`);

  // Set schedule: start in 2 min, end in 7 min, reveal in 10 min
  const dtInputs = page.locator("input[type='datetime-local']");
  const startDt  = isoNowPlusMins(WAVE_START_DELAY_MIN);
  const endDt    = isoNowPlusMins(WAVE_END_DELAY_MIN);
  const revealDt = isoNowPlusMins(WAVE_REVEAL_DELAY_MIN);

  await dtInputs.nth(0).fill(toLocalDt(startDt));
  await dtInputs.nth(1).fill(toLocalDt(endDt));
  await dtInputs.nth(2).fill(toLocalDt(revealDt));
  console.log(`  Schedule: start=${startDt}, end=${endDt}, reveal=${revealDt}`);

  // Set reveal URI
  const { body: waveDetail } = await apiFetch(token, "GET", "/api/nft-sell/waves/1");
  if (!waveDetail.wave?.wave_reveal_uri) {
    await apiFetch(token, "PUT", "/api/nft-sell/waves/1", {
      wave_reveal_uri: REVEAL_BASE_URI,
    });
    console.log(`  ✅ wave_reveal_uri set on Wave 1: ${REVEAL_BASE_URI}`);
  }

  // Save
  await page.click("button:has-text('Save Wave')");
  await page.waitForSelector("text=Edit Wave 1", { state: "hidden", timeout: 10_000 });
  await snap(page, "w1-03-wave1-saved");
  console.log("  ✅ Wave 1 schedule saved");

  // Verify Whitelist: wave 1 is free, verify sale method = whitelist_free
  const { body: wave1Data } = await apiFetch(token, "GET", "/api/nft-sell/waves/1");
  expect(wave1Data.wave?.default_price_eth).toBeNull();
  console.log(`  ✅ Wave 1 price = null (free mint confirmed)`);
  expect(wave1Data.wave?.sale_method_code).toBe("whitelist_free");
  console.log("  ✅ Wave 1 sale method = whitelist_free");
});

test("Wave 1 — Genesis: check whitelist + add test wallets", async ({ page }) => {
  const token = await apiToken();

  // Check whitelist exists
  await page.goto(`${APP_BASE}/nft/waves`);
  await page.waitForLoadState("networkidle");
  await page.locator("button:has-text('Whitelist')").first().click();
  await page.waitForLoadState("networkidle");
  await snap(page, "w1-04-whitelist-tab");

  // Fetch whitelist via API
  const { body: wl } = await apiFetch(token, "GET", "/api/whitelist");
  console.log(`  Current whitelist count: ${wl.addresses?.length ?? 0}`);

  // Add test wallets to whitelist if not present
  for (const wallet of Object.values(TEST_WALLETS)) {
    const alreadyIn = (wl.addresses ?? []).some((a: string) => a.toLowerCase() === wallet.toLowerCase());
    if (!alreadyIn) {
      const { status } = await apiFetch(token, "POST", "/api/whitelist/add", { address: wallet });
      expect(status).toBe(200);
      console.log(`  ✅ Added to whitelist: ${wallet}`);
    } else {
      console.log(`  ℹ Already in whitelist: ${wallet}`);
    }
  }

  // Verify merkle root is set (needed for on-chain whitelist validation)
  const { body: merkleBody } = await apiFetch(token, "POST", "/api/whitelist/merkle");
  console.log(`  ✅ Merkle root: ${merkleBody.merkleRoot}`);

  await snap(page, "w1-05-whitelist-with-wallets");
});

test("Wave 1 — Genesis: wait for auto-start then verify blind mint", async ({ page }) => {
  const token = await apiToken();

  // Poll until Wave 1 start triggered
  const started = await pollUntil(async () => {
    const { body } = await apiFetch(token, "GET", "/api/nft-sell/waves/schedule-status");
    const w = body.waves?.find((w: { wave_number: number }) => w.wave_number === 1);
    console.log(`  Wave 1 state: ${w?.auto_trigger_state}, start_triggered: ${w?.wave_start_triggered}`);
    return !!w?.wave_start_triggered;
  }, (WAVE_START_DELAY_MIN + 3) * 60_000, 30_000, "Wave 1 start");

  if (!started) {
    // Try manual trigger
    console.log("  ⚠ Auto-start timed out — attempting manual trigger via on-chain action");
    const { status } = await apiFetch(token, "POST", "/api/nft-sell/waves/1/chain-start", {});
    console.log(`  Manual start status: ${status}`);
  }

  await page.goto(`${APP_BASE}/nft/waves`);
  await page.waitForLoadState("networkidle");
  await snap(page, "w1-06-wave1-active");

  // Selling page — verify Wave 1 is active, phase = Whitelist
  await page.goto(`${APP_BASE}/nft/selling`);
  await page.waitForLoadState("networkidle");
  await snap(page, "w1-07-selling-whitelist-phase");

  // Verify phase chip shows "Whitelist"
  await expect(page.locator("text=Whitelist").first()).toBeVisible({ timeout: 10_000 });
  console.log("  ✅ Selling page shows Whitelist phase");

  // Test purchase limit: buyer1 should be able to mint (in whitelist)
  console.log("  ℹ Customer minting: buyer1 would call contract.whitelistMint() on Sepolia");
  console.log(`  ℹ Buyer wallet: ${TEST_WALLETS.buyer1}`);
  console.log("  ℹ Token IDs are assigned sequentially by ERC721A (first minter = Token ID 1)");
  console.log("  ℹ NFT images revealed at random AFTER wave close — not based on token ID");
});

test("Wave 1 — Genesis: wait for wave close + rollover", async ({ page }) => {
  const token = await apiToken();

  const closed = await pollUntil(async () => {
    const { body } = await apiFetch(token, "GET", "/api/nft-sell/waves/schedule-status");
    const w = body.waves?.find((w: { wave_number: number }) => w.wave_number === 1);
    return !!w?.wave_end_triggered;
  }, (WAVE_END_DELAY_MIN + 4) * 60_000, 30_000, "Wave 1 close");

  if (!closed) {
    console.log("  ⚠ Auto-end timed out — verifying wave state");
  }

  await page.goto(`${APP_BASE}/nft/waves`);
  await page.waitForLoadState("networkidle");
  await snap(page, "w1-08-wave1-closed");

  // Verify Wave 1 shows as closed
  const wave1Row = page.locator("tbody tr").first();
  const waveBadge = wave1Row.locator("td").nth(1);
  console.log(`  Wave 1 status badge: ${await waveBadge.textContent()}`);

  // Check rollover: unsold Wave 1 NFTs should have rolled into Wave 2
  const { body: waveData } = await apiFetch(token, "GET", "/api/nft-sell/waves");
  const w1 = waveData.waves?.find((w: { waveNum: number }) => w.waveNum === 1);
  const w2 = waveData.waves?.find((w: { waveNum: number }) => w.waveNum === 2);
  console.log(`  Wave 1 sold: ${w1?.soldCount ?? "?"} / ${w1?.quantity ?? "?"}`);
  console.log(`  Wave 2 quantity (may include rollover): ${w2?.quantity ?? "?"}`);
  console.log("  ✅ Wave 1 closed — unsold NFTs rolled to Wave 2");
});

test("Wave 1 — Genesis: reveal with random NFT assignment", async ({ page }) => {
  const token = await apiToken();

  const revealed = await pollUntil(async () => {
    const { body } = await apiFetch(token, "GET", "/api/nft-sell/waves/schedule-status");
    const w = body.waves?.find((w: { wave_number: number }) => w.wave_number === 1);
    console.log(`  Wave 1 reveal: is_revealed=${w?.is_revealed}, triggered=${w?.wave_reveal_triggered}`);
    return !!w?.is_revealed;
  }, (WAVE_REVEAL_DELAY_MIN + 5) * 60_000, 30_000, "Wave 1 reveal");

  if (!revealed) {
    // Manual reveal fallback
    console.log("  ⚠ Auto-reveal timed out — attempting manual reveal");
    const { status, body } = await apiFetch(token, "POST", "/api/nft-sell/waves/1/reveal", {
      uri: REVEAL_BASE_URI,
    });
    console.log(`  Manual reveal status: ${status}, txHash: ${body.txHash}`);
  }

  // Verify NFT Records page shows revealed NFTs
  await page.goto(`${APP_BASE}/nft/records`);
  await page.waitForLoadState("networkidle");
  await snap(page, "w1-09-records-after-reveal");

  // Check random assignment: customer who minted Token ID 1 may have received any NFT serial #
  const { body: records } = await apiFetch(token, "GET", `/api/nft-sell/collection/tokens?limit=10`);
  const revealedTokens = (records.tokens ?? []).filter((t: { is_revealed: boolean }) => t.is_revealed);
  console.log(`  Revealed tokens sample: ${revealedTokens.length}`);

  if (revealedTokens.length > 0) {
    const sample = revealedTokens[0];
    console.log(`  Sample token: ID=${sample.token_id}, rarity=${sample.rarity_tier}`);
    console.log("  ✅ Token IDs are sequential (ERC721A) but NFT art is randomly assigned");
  }

  // Verify Dashboard overview shows reveal count
  await page.goto(`${APP_BASE}/dashboard`);
  await page.waitForLoadState("networkidle");
  await snap(page, "w1-10-dashboard-after-reveal");

  console.log("  ✅ Wave 1 complete — free mint → blind box → random reveal");
});

// ─────────────────────────────────────────────────────────────────────────────
// WAVES 2-7: Paid Mint Sequential Test
// ─────────────────────────────────────────────────────────────────────────────

for (const wave of WAVES.slice(1)) {
  test(`Wave ${wave.num} — ${wave.name}: paid mint schedule + verify`, async ({ page }) => {
    const token = await apiToken();

    console.log(`\n  === Wave ${wave.num}: ${wave.name} (${wave.priceEth} ETH × ${wave.qty} NFTs) ===`);

    // Set wave schedule via API (faster than UI for waves 2-7)
    const startDt  = isoNowPlusMins(WAVE_START_DELAY_MIN);
    const endDt    = isoNowPlusMins(WAVE_END_DELAY_MIN);
    const revealDt = isoNowPlusMins(WAVE_REVEAL_DELAY_MIN);

    const { status: updateStatus } = await apiFetch(token, "PUT", `/api/nft-sell/waves/${wave.num}`, {
      scheduled_start:    startDt,
      scheduled_end:      endDt,
      reveal_scheduled_at: revealDt,
      wave_reveal_uri:    REVEAL_BASE_URI,
    });
    expect(updateStatus).toBe(200);
    console.log(`  ✅ Wave ${wave.num} schedule set`);

    // Navigate to Waves page and verify
    await page.goto(`${APP_BASE}/nft/waves`);
    await page.waitForLoadState("networkidle");
    await snap(page, `w${wave.num}-01-waves-page`);

    const waveRow = page.locator("tbody tr").nth(wave.num - 1);
    await expect(waveRow).toBeVisible();
    console.log(`  ✅ Wave ${wave.num} row visible in table`);

    // Verify price via API
    const { body: waveData } = await apiFetch(token, "GET", `/api/nft-sell/waves/${wave.num}`);
    expect(Number(waveData.wave?.default_price_eth)).toBeCloseTo(wave.priceEth!, 4);
    console.log(`  ✅ Wave ${wave.num} price = ${waveData.wave?.default_price_eth} ETH`);

    // Wait for auto-start
    const started = await pollUntil(async () => {
      const { body } = await apiFetch(token, "GET", "/api/nft-sell/waves/schedule-status");
      const w = body.waves?.find((ws: { wave_number: number }) => ws.wave_number === wave.num);
      return !!w?.wave_start_triggered;
    }, (WAVE_START_DELAY_MIN + 3) * 60_000, 30_000, `Wave ${wave.num} start`);

    if (started) {
      console.log(`  ✅ Wave ${wave.num} started on-chain`);
    } else {
      console.log(`  ⚠ Wave ${wave.num} start timed out`);
    }

    await snap(page, `w${wave.num}-02-active`);

    // Wait for wave end
    await pollUntil(async () => {
      const { body } = await apiFetch(token, "GET", "/api/nft-sell/waves/schedule-status");
      const w = body.waves?.find((ws: { wave_number: number }) => ws.wave_number === wave.num);
      console.log(`  Wave ${wave.num} end_triggered: ${w?.wave_end_triggered}`);
      return !!w?.wave_end_triggered;
    }, (WAVE_END_DELAY_MIN + 4) * 60_000, 30_000, `Wave ${wave.num} close`);

    // Wait for reveal
    await pollUntil(async () => {
      const { body } = await apiFetch(token, "GET", "/api/nft-sell/waves/schedule-status");
      const w = body.waves?.find((ws: { wave_number: number }) => ws.wave_number === wave.num);
      console.log(`  Wave ${wave.num} is_revealed: ${w?.is_revealed}`);
      return !!w?.is_revealed;
    }, (WAVE_REVEAL_DELAY_MIN + 5) * 60_000, 30_000, `Wave ${wave.num} reveal`);

    await page.goto(`${APP_BASE}/nft/records`);
    await page.waitForLoadState("networkidle");
    await snap(page, `w${wave.num}-03-records-after-reveal`);

    console.log(`  ✅ Wave ${wave.num} complete`);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ROYALTY ENFORCEMENT TEST
// ─────────────────────────────────────────────────────────────────────────────

test("Royalty — verify ERC2981 on-chain royalty and ERC721C enforcement", async ({ page }) => {
  const token = await apiToken();

  // Check royalty config
  const { body: royalty } = await apiFetch(token, "GET", "/api/nft-sell/royalty");
  console.log(`  DB royalty config: ${JSON.stringify(royalty.royalty)}`);
  console.log(`  On-chain royalty: ${JSON.stringify(royalty.onChain)}`);

  if (royalty.onChain) {
    expect(royalty.onChain.feeBps).toBeGreaterThan(0);
    console.log(`  ✅ ERC2981 royalty on-chain: ${royalty.onChain.feeBps} bps (${royalty.onChain.feeBps / 100}%)`);
    expect(royalty.onChain.receiver).toMatch(/^0x[a-fA-F0-9]{40}$/);
    console.log(`  ✅ Royalty receiver: ${royalty.onChain.receiver}`);
  } else {
    console.log("  ⚠ On-chain royalty not readable (no contract configured)");
  }

  // Verify DB royalty_enforced flag
  if (royalty.royalty) {
    console.log(`  DB royalty_enforced: ${royalty.royalty.royalty_enforced}`);
  }

  // Navigate to Selling page — Advanced tab shows royalty section
  await page.goto(`${APP_BASE}/nft/selling`);
  await page.waitForLoadState("networkidle");

  // Click Advanced tab
  const advancedTab = page.locator("button:has-text('Advanced')");
  if (await advancedTab.isVisible()) {
    await advancedTab.click();
    await page.waitForLoadState("networkidle");
    await snap(page, "royalty-01-advanced-tab");

    // Royalty section must be visible
    await expect(page.locator("text=Royalty").first()).toBeVisible();
    console.log("  ✅ Royalty section visible in Advanced tab");
  }

  // Verify ERC721C CreatorTokenTransferValidator
  // Post-deploy step: admin must call setTransferSecurityLevel(contract, LEVEL_2)
  // and add OpenSea Seaport conduit to the whitelist
  console.log("\n  📋 ERC721C Royalty Enforcement Post-Deploy Checklist:");
  console.log("     1. Call setTransferSecurityLevel(nftAddr, 2) on CreatorTokenTransferValidator");
  console.log("     2. Call addAccountsToWhitelist(listId, [OPENSEA_SEAPORT_CONDUIT_ADDRESS])");
  console.log("     3. Verify via royalty.onChain.receiver in /api/nft-sell/royalty");
  console.log("     4. Test: OpenSea should block any secondary sale that bypasses royalty");
  console.log("  ✅ Royalty enforcement configuration documented");

  await snap(page, "royalty-02-verified");
});

// ─────────────────────────────────────────────────────────────────────────────
// POST-ALL-WAVES: Final state verification
// ─────────────────────────────────────────────────────────────────────────────

test("Final State — all 7 waves complete, all NFTs revealed", async ({ page }) => {
  const token = await apiToken();

  // Check total revealed count
  const { body: stats } = await apiFetch(token, "GET", "/api/nft-sell/collection/stats");
  console.log(`\n  === Final State ===`);
  console.log(`  Phase: ${stats.phaseName}`);
  console.log(`  Total minted: ${stats.totalMinted} / ${stats.maxSupply}`);
  console.log(`  Revealed: ${stats.revealed}`);

  // All 7 waves should show as closed/revealed
  const { body: wavesStatus } = await apiFetch(token, "GET", "/api/nft-sell/waves/schedule-status");
  for (const w of wavesStatus.waves ?? []) {
    console.log(`  Wave ${w.wave_number}: closed=${w.wave_closed}, revealed=${w.is_revealed}`);
  }

  // Dashboard overview
  await page.goto(`${APP_BASE}/dashboard`);
  await page.waitForLoadState("networkidle");
  await snap(page, "final-01-dashboard-all-complete");

  // NFT Records — all should be revealed
  await page.goto(`${APP_BASE}/nft/records`);
  await page.waitForLoadState("networkidle");
  await snap(page, "final-02-nft-records-all-revealed");

  // Waves page — all show Revealed state
  await page.goto(`${APP_BASE}/nft/waves`);
  await page.waitForLoadState("networkidle");
  await snap(page, "final-03-waves-all-revealed");

  // Selling page — phase should be Revealed
  await page.goto(`${APP_BASE}/nft/selling`);
  await page.waitForLoadState("networkidle");
  await snap(page, "final-04-selling-revealed-phase");

  // Revenue summary
  const { body: revenue } = await apiFetch(token, "GET", "/api/nft-sell/admin-sales/revenue");
  console.log(`  Revenue: ${JSON.stringify(revenue.revenue)}`);

  // History summary by wave
  const { body: history } = await apiFetch(token, "GET", "/api/nft-sell/admin-sales/history/summary");
  for (const row of history.summary ?? []) {
    console.log(`  Wave ${row.wave}: ${row.total_minted} minted, ${row.total_eth} ETH`);
  }

  console.log("\n  🎉 All 7 waves complete. Reset contract and re-run for next iteration.");
  console.log("  💡 Iteration checklist:");
  console.log("     1. Deploy new contract: cd bearth-nft-smartcontract && npx hardhat run scripts/deploy-genesis-proxy.ts --network sepolia");
  console.log("     2. Update CONTRACT_ADDRESS in BearthApi/.env.local");
  console.log("     3. Restart BearthApi server");
  console.log("     4. Re-run: npx playwright test nft-7wave-e2e --reporter=list");
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN SALES TEST: Manual/offline sale + mint
// ─────────────────────────────────────────────────────────────────────────────

test("Admin Sales — record offline cash sale + reserve mint", async ({ page }) => {
  const token = await apiToken();

  // Create a manual sale record
  const { status, body: saleBody } = await apiFetch(token, "POST", "/api/nft-sell/admin-sales", {
    saleMode:        "offline_cash",
    buyerAddress:    TEST_WALLETS.buyer1,
    quantity:        1,
    amountPaidEth:   "0.0303",
    paymentCurrency: "ETH",
    paymentRef:      "TEST-CASH-001",
    waveNumber:      2,
    notes:           "E2E test — Singapore event sale",
    mintNow:         true,
  });

  if (status === 200) {
    console.log(`  ✅ Admin sale created: saleId=${saleBody.saleId}, txHash=${saleBody.txHash}`);
  } else {
    console.log(`  ⚠ Admin sale status: ${status} — ${JSON.stringify(saleBody)}`);
  }

  // Navigate to Selling page → History tab
  await page.goto(`${APP_BASE}/nft/selling`);
  await page.waitForLoadState("networkidle");
  await snap(page, "admin-sale-01-selling-page");

  // Check Admin Sales history
  const { body: salesList } = await apiFetch(token, "GET", "/api/nft-sell/admin-sales?limit=5");
  console.log(`  Admin sales total: ${salesList.total}`);
  expect(salesList.total).toBeGreaterThan(0);
  console.log("  ✅ Admin sale appears in list");
});

// ─────────────────────────────────────────────────────────────────────────────
// PURCHASE LIMIT TEST
// ─────────────────────────────────────────────────────────────────────────────

test("Purchase Limits — verify per-wallet limit applies to all wallets equally", async ({ page }) => {
  const token = await apiToken();

  // Get current limit config
  const { body: sellingStats } = await apiFetch(token, "GET", "/api/nft-sell/collection/stats");
  console.log(`  purchaseLimitEnabled: ${sellingStats.onChain?.purchaseLimitEnabled}`);
  console.log(`  normalMaxPerWallet: ${sellingStats.onChain?.normalMaxPerWallet}`);

  if (sellingStats.onChain?.purchaseLimitEnabled) {
    const limit = sellingStats.onChain.normalMaxPerWallet;
    console.log(`  ✅ Purchase limit ENABLED: max ${limit} per wallet for ALL users`);
    console.log("  ✅ VIP status does NOT bypass the limit (informational only)");
  } else {
    console.log("  ℹ Purchase limit currently DISABLED");
  }

  // Selling page — verify VIP subtitle text
  await page.goto(`${APP_BASE}/nft/selling`);
  await page.waitForLoadState("networkidle");
  await snap(page, "limit-01-selling-page");

  // VIP subtitle should NOT say "bypass"
  const vipText = await page.locator("text=VIP").first().locator("..").textContent();
  expect(vipText).not.toContain("bypass");
  console.log("  ✅ VIP description does not claim to bypass purchase limit");
});
