/**
 * pages-check.spec.ts
 * Tests three BearthAdmin pages: NFT Records, NFT Waves, NFT Scheduler
 * Login: amplecapitalholding@gmail.com / amplecapitalholding@123
 * Screenshots saved to tests/results/pages-check/
 */

import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const SCREENSHOT_DIR = path.join(
  process.cwd(),
  "tests",
  "results",
  "pages-check"
);

// Shared login helper — uses cookie-based API login like scheduler.spec.ts
async function loginViaApi(page: import("@playwright/test").Page, context: import("@playwright/test").BrowserContext) {
  const res = await page.request.post("http://localhost:3000/api/auth/login", {
    data: {
      email: "amplecapitalholding@gmail.com",
      password: "amplecapitalholding@123",
    },
    headers: { "Content-Type": "application/json" },
  });
  const body = await res.json().catch(() => ({}));
  console.log(`[login] status=${res.status()} body=${JSON.stringify(body)}`);

  const cookies = await context.cookies("http://localhost:3000");
  const session = cookies.find((c) => c.name === "admin_session");
  console.log(`[login] session cookie present: ${!!session}`);
  return res.status();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. NFT Records Page  /nft/records
// ═══════════════════════════════════════════════════════════════════════════════

test("nft-records page - full inspection", async ({ browser }) => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on("response", (response) => {
    const status = response.status();
    const url = response.url();
    if (status >= 400 && !url.includes("favicon") && !url.includes("_next/static")) {
      networkErrors.push(`${status} ${url}`);
    }
  });

  // Login
  const loginStatus = await loginViaApi(page, context);
  console.log(`[login] result: ${loginStatus}`);

  // Navigate to NFT Records
  await page.goto("http://localhost:3000/nft/records", {
    waitUntil: "networkidle",
    timeout: 30000,
  });
  await page.waitForTimeout(4000);

  const finalUrl = page.url();
  console.log(`[nav] Final URL: ${finalUrl}`);

  // ── Full-page screenshot ───────────────────────────────────────────────────
  const screenshotPath = path.join(SCREENSHOT_DIR, "nft-records.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`[screenshot] saved: ${screenshotPath}`);

  // ── Page text ────────────────────────────────────────────────────────────
  const bodyText = await page.locator("body").innerText();
  console.log("\n=== NFT RECORDS PAGE TEXT (first 4000 chars) ===");
  console.log(bodyText.substring(0, 4000));
  console.log("=== END ===\n");

  // ── Stat cards: Total / Blind Box / Revealed / Sold / Delivered ──────────
  const statCardCount = await page.locator("button").filter({ hasText: /Total NFTs|Blind Box|Revealed|Sold|Delivered/ }).count();
  const totalNFTsCard = await page.locator("button").filter({ hasText: "Total NFTs" }).first().innerText().catch(() => "not found");
  const blindBoxCard  = await page.locator("button").filter({ hasText: "Blind Box"  }).first().innerText().catch(() => "not found");
  const revealedCard  = await page.locator("button").filter({ hasText: "Revealed"   }).first().innerText().catch(() => "not found");
  const soldCard      = await page.locator("button").filter({ hasText: /^Sold/      }).first().innerText().catch(() => "not found");
  const deliveredCard = await page.locator("button").filter({ hasText: "Delivered"  }).first().innerText().catch(() => "not found");

  console.log("[stat cards] count:", statCardCount);
  console.log("[stat card] Total NFTs:", totalNFTsCard);
  console.log("[stat card] Blind Box:", blindBoxCard);
  console.log("[stat card] Revealed:", revealedCard);
  console.log("[stat card] Sold:", soldCard);
  console.log("[stat card] Delivered:", deliveredCard);

  // ── Table headers ─────────────────────────────────────────────────────────
  const thTexts = await page.locator("th").allTextContents();
  console.log("[table headers]", JSON.stringify(thTexts));

  // ── Table rows ────────────────────────────────────────────────────────────
  const rowCount = await page.locator("table tbody tr").count();
  console.log("[table rows]", rowCount);

  // ── Wave column — check it shows wave info ─────────────────────────────
  const waveCellTexts = await page.locator("table tbody tr td:nth-child(3)").allTextContents();
  console.log("[wave column cells]", JSON.stringify(waveCellTexts.slice(0, 5)));

  // ── Key Dates column ──────────────────────────────────────────────────────
  const keyDateCells = await page.locator("table tbody tr td:nth-child(8)").allTextContents();
  console.log("[key dates column cells]", JSON.stringify(keyDateCells.slice(0, 5)));

  // ── Wave filter test ──────────────────────────────────────────────────────
  const waveSelect = page.locator("select").first();
  await waveSelect.selectOption("1");
  await page.waitForTimeout(1500);
  const rowCountAfterWaveFilter = await page.locator("table tbody tr").count();
  console.log("[wave filter Wave 1] row count:", rowCountAfterWaveFilter);

  // Reset filter
  await waveSelect.selectOption("");
  await page.waitForTimeout(1000);

  // ── Status filter ─────────────────────────────────────────────────────────
  const allSelects = await page.locator("select").all();
  console.log("[filters] select elements count:", allSelects.length);

  // ── View modal — click the first View button ──────────────────────────────
  const viewBtn = page.locator("button[title='View full history']").first();
  const viewBtnCount = await viewBtn.count();
  console.log("[view button] found:", viewBtnCount > 0);

  if (viewBtnCount > 0) {
    await viewBtn.click();
    await page.waitForTimeout(1500);

    const modalVisible = await page.locator(".fixed.inset-0").isVisible().catch(() => false);
    console.log("[modal] visible:", modalVisible);

    const modalText = await page.locator(".fixed.inset-0").innerText().catch(() => "");
    console.log("[modal text] first 1000 chars:", modalText.substring(0, 1000));

    // Modal screenshot
    const modalScreenshotPath = path.join(SCREENSHOT_DIR, "nft-records-modal.png");
    await page.screenshot({ path: modalScreenshotPath, fullPage: false });
    console.log(`[screenshot] modal saved: ${modalScreenshotPath}`);

    // Close modal
    const closeBtn = page.locator(".fixed.inset-0 button").filter({ hasText: "Close" }).first();
    if (await closeBtn.count() > 0) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    }
  } else {
    console.log("[modal] no View buttons found — table may be empty");
    // Still take a screenshot as the "modal" placeholder
    const modalScreenshotPath = path.join(SCREENSHOT_DIR, "nft-records-modal.png");
    await page.screenshot({ path: modalScreenshotPath, fullPage: true });
    console.log(`[screenshot] fallback saved to nft-records-modal.png`);
  }

  // ── Headings ──────────────────────────────────────────────────────────────
  const headings = await page.locator("h1, h2, h3").allTextContents();
  console.log("[headings]", JSON.stringify(headings));

  // ── Buttons ───────────────────────────────────────────────────────────────
  const buttonTexts = await page.locator("button").allTextContents();
  console.log("[buttons]", JSON.stringify(buttonTexts.slice(0, 20)));

  // ── FINAL REPORT ──────────────────────────────────────────────────────────
  console.log("\n======= NFT RECORDS PAGE REPORT =======");
  console.log(`URL: ${finalUrl}`);
  console.log(`On records page: ${finalUrl.includes("/nft/records")}`);
  console.log(`Table rows: ${rowCount}`);
  console.log(`Stat cards found: ${statCardCount} / 5`);
  console.log(`All 5 stat cards present: ${statCardCount >= 5}`);
  console.log(`Table headers: ${JSON.stringify(thTexts)}`);
  console.log(`Has Wave column: ${thTexts.some(h => h.toLowerCase().includes("wave"))}`);
  console.log(`Has Key Dates column: ${thTexts.some(h => h.toLowerCase().includes("date") || h.toLowerCase().includes("dates"))}`);
  console.log(`View modal opened: ${viewBtnCount > 0}`);
  console.log(`Console errors: ${consoleErrors.length}`);
  consoleErrors.forEach(e => console.log(`  ${e}`));
  console.log(`Network errors: ${networkErrors.length}`);
  networkErrors.forEach(e => console.log(`  ${e}`));
  console.log("=========================================\n");

  await context.close();

  // Assertions
  expect(finalUrl).toContain("/nft/records");
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. NFT Waves Page  /nft/waves
// ═══════════════════════════════════════════════════════════════════════════════

test("nft-waves page - full inspection", async ({ browser }) => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on("response", (response) => {
    const status = response.status();
    const url = response.url();
    if (status >= 400 && !url.includes("favicon") && !url.includes("_next/static")) {
      networkErrors.push(`${status} ${url}`);
    }
  });

  // Login
  await loginViaApi(page, context);

  // Navigate
  await page.goto("http://localhost:3000/nft/waves", {
    waitUntil: "networkidle",
    timeout: 30000,
  });
  await page.waitForTimeout(4000);

  const finalUrl = page.url();
  console.log(`[nav] Final URL: ${finalUrl}`);

  // ── Full-page screenshot ───────────────────────────────────────────────────
  const screenshotPath = path.join(SCREENSHOT_DIR, "nft-waves.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`[screenshot] saved: ${screenshotPath}`);

  // ── Page text ────────────────────────────────────────────────────────────
  const bodyText = await page.locator("body").innerText();
  console.log("\n=== NFT WAVES PAGE TEXT (first 4000 chars) ===");
  console.log(bodyText.substring(0, 4000));
  console.log("=== END ===\n");

  // ── Table headers ─────────────────────────────────────────────────────────
  const thTexts = await page.locator("th").allTextContents();
  console.log("[table headers]", JSON.stringify(thTexts));

  // Check all 10 expected columns
  const expectedCols = ["Wave", "Qty", "Price", "Sold", "Sale Method", "Schedule", "Reveal Date", "Status", "Revealed", "Actions"];
  for (const col of expectedCols) {
    const found = thTexts.some(h => h.toLowerCase().includes(col.toLowerCase()));
    console.log(`[column] "${col}" present: ${found}`);
  }

  // ── Table rows ────────────────────────────────────────────────────────────
  const rowCount = await page.locator("table tbody tr").count();
  console.log("[table rows]", rowCount);
  console.log("[has 7 rows]", rowCount === 7);

  // ── All row text contents (wave names) ────────────────────────────────────
  const rowTexts = await page.locator("table tbody tr").allTextContents();
  rowTexts.forEach((t, i) => console.log(`[row ${i + 1}] ${t.substring(0, 200)}`));

  // ── Stat cards on waves page ──────────────────────────────────────────────
  const statCardCount = await page.locator("div.rounded-xl").count();
  console.log("[rounded-xl elements / cards]", statCardCount);

  // ── Edit Wave 1 modal ─────────────────────────────────────────────────────
  // Find the first Edit button (Wave 1)
  const editBtns = page.locator("button").filter({ hasText: /^Edit$/ });
  const editBtnCount = await editBtns.count();
  console.log("[edit buttons] count:", editBtnCount);

  if (editBtnCount > 0) {
    await editBtns.first().click();
    await page.waitForTimeout(1500);

    const modalVisible = await page.locator(".fixed.inset-0").isVisible().catch(() => false);
    console.log("[edit modal] visible:", modalVisible);

    const modalText = await page.locator(".fixed.inset-0").innerText().catch(() => "");
    console.log("[edit modal text] first 2000 chars:", modalText.substring(0, 2000));

    // Check for "Wave Quantity:" panel at top of modal
    const hasWaveQtyPanel = modalText.includes("Wave Quantity:");
    const hasFixedAtLaunch = modalText.includes("Fixed at launch");
    console.log("[edit modal] has 'Wave Quantity:' read-only panel:", hasWaveQtyPanel);
    console.log("[edit modal] has 'Fixed at launch' text:", hasFixedAtLaunch);

    // Check specifically for "Wave Quantity: 303 NFTs"
    const has303 = modalText.includes("303");
    console.log("[edit modal] shows '303':", has303);

    // Screenshot modal
    const modalScreenshotPath = path.join(SCREENSHOT_DIR, "nft-waves-edit-modal.png");
    await page.screenshot({ path: modalScreenshotPath, fullPage: false });
    console.log(`[screenshot] modal saved: ${modalScreenshotPath}`);

    // Close modal
    const cancelBtn = page.locator(".fixed.inset-0 button").filter({ hasText: /Cancel|Close/ }).first();
    if (await cancelBtn.count() > 0) {
      await cancelBtn.click();
      await page.waitForTimeout(500);
    }
  } else {
    console.log("[edit modal] no Edit buttons found");
    const modalScreenshotPath = path.join(SCREENSHOT_DIR, "nft-waves-edit-modal.png");
    await page.screenshot({ path: modalScreenshotPath, fullPage: true });
  }

  // ── Headings ──────────────────────────────────────────────────────────────
  const headings = await page.locator("h1, h2, h3").allTextContents();
  console.log("[headings]", JSON.stringify(headings));

  // ── Badges / sale methods ─────────────────────────────────────────────────
  const badgeTexts = await page.locator("span[class*='rounded-full']").allTextContents();
  console.log("[badges]", JSON.stringify(badgeTexts.slice(0, 20)));

  // ── FINAL REPORT ──────────────────────────────────────────────────────────
  console.log("\n======= NFT WAVES PAGE REPORT =======");
  console.log(`URL: ${finalUrl}`);
  console.log(`On waves page: ${finalUrl.includes("/nft/waves")}`);
  console.log(`Table rows: ${rowCount}`);
  console.log(`Has all 7 waves: ${rowCount === 7}`);
  console.log(`Table headers: ${JSON.stringify(thTexts)}`);
  expectedCols.forEach(col => {
    console.log(`  Column "${col}": ${thTexts.some(h => h.toLowerCase().includes(col.toLowerCase()))}`);
  });
  console.log(`Edit button found: ${editBtnCount > 0}`);
  console.log(`Console errors: ${consoleErrors.length}`);
  consoleErrors.forEach(e => console.log(`  ${e}`));
  console.log(`Network errors: ${networkErrors.length}`);
  networkErrors.forEach(e => console.log(`  ${e}`));
  console.log("=========================================\n");

  await context.close();

  expect(finalUrl).toContain("/nft/waves");
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Scheduler Page  /nft/scheduler  (full-page scroll screenshot)
// ═══════════════════════════════════════════════════════════════════════════════

test("nft-scheduler page - full page with how-it-works check", async ({ browser }) => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on("response", (response) => {
    const status = response.status();
    const url = response.url();
    if (status >= 400 && !url.includes("favicon") && !url.includes("_next/static")) {
      networkErrors.push(`${status} ${url}`);
    }
  });

  // Login
  await loginViaApi(page, context);

  // Navigate
  await page.goto("http://localhost:3000/nft/scheduler", {
    waitUntil: "networkidle",
    timeout: 30000,
  });
  await page.waitForTimeout(4000);

  // Scroll to bottom so full content loads
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  // Scroll back to top for full-page screenshot
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  const finalUrl = page.url();
  console.log(`[nav] Final URL: ${finalUrl}`);

  // ── Full-page screenshot ───────────────────────────────────────────────────
  const screenshotPath = path.join(SCREENSHOT_DIR, "scheduler-full.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`[screenshot] saved: ${screenshotPath}`);

  // ── Page text ────────────────────────────────────────────────────────────
  const bodyText = await page.locator("body").innerText();
  console.log("\n=== SCHEDULER PAGE TEXT (first 5000 chars) ===");
  console.log(bodyText.substring(0, 5000));
  console.log("=== END ===\n");

  // ── How it works section ──────────────────────────────────────────────────
  const howItWorksFound = bodyText.toLowerCase().includes("how it works");
  console.log(`["How it works" section] found: ${howItWorksFound}`);

  // Check the 3 specific cards
  const autoWaveStart = bodyText.toLowerCase().includes("auto wave start");
  const autoWaveEnd   = bodyText.toLowerCase().includes("auto wave end");
  const autoReveal    = bodyText.toLowerCase().includes("auto reveal");
  console.log(`[card] "Auto Wave Start": ${autoWaveStart}`);
  console.log(`[card] "Auto Wave End": ${autoWaveEnd}`);
  console.log(`[card] "Auto Reveal": ${autoReveal}`);

  // ── Table ─────────────────────────────────────────────────────────────────
  const thTexts = await page.locator("th").allTextContents();
  console.log("[table headers]", JSON.stringify(thTexts));
  const rowCount = await page.locator("table tbody tr").count();
  console.log("[table rows]", rowCount);
  console.log("[has 7 rows]", rowCount === 7);

  // ── Toggles / switches ────────────────────────────────────────────────────
  const toggleCount = await page.locator("input[type='checkbox'], [role='switch']").count();
  console.log("[toggle count]", toggleCount);

  // ── Headings ──────────────────────────────────────────────────────────────
  const headings = await page.locator("h1, h2, h3, h4").allTextContents();
  console.log("[headings]", JSON.stringify(headings));

  // ── Wave wave matches in text ─────────────────────────────────────────────
  const waveMatches = bodyText.match(/Wave\s*\d/gi) || [];
  console.log(`[wave references] ${waveMatches.length} — ${JSON.stringify(waveMatches.slice(0, 10))}`);

  // ── FINAL REPORT ──────────────────────────────────────────────────────────
  console.log("\n======= SCHEDULER PAGE REPORT =======");
  console.log(`URL: ${finalUrl}`);
  console.log(`On scheduler page: ${finalUrl.includes("/nft/scheduler")}`);
  console.log(`Table rows: ${rowCount}`);
  console.log(`Has 7 rows: ${rowCount === 7}`);
  console.log(`"How it works" section found: ${howItWorksFound}`);
  console.log(`"Auto Wave Start" card: ${autoWaveStart}`);
  console.log(`"Auto Wave End" card: ${autoWaveEnd}`);
  console.log(`"Auto Reveal" card: ${autoReveal}`);
  console.log(`All 3 how-it-works cards present: ${autoWaveStart && autoWaveEnd && autoReveal}`);
  console.log(`Toggle/switch count: ${toggleCount}`);
  console.log(`Console errors: ${consoleErrors.length}`);
  consoleErrors.forEach(e => console.log(`  ${e}`));
  console.log(`Network errors: ${networkErrors.length}`);
  networkErrors.forEach(e => console.log(`  ${e}`));
  console.log("=========================================\n");

  await context.close();

  expect(finalUrl).toContain("/nft/scheduler");
});
