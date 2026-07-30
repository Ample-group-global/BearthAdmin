/**
 * Standalone Playwright script — run with:
 *   npx ts-node tests/scheduler-standalone.ts
 * OR:
 *   node -r ts-node/register tests/scheduler-standalone.ts
 *
 * Does NOT go through playwright.config.ts or global-setup.
 */

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCREENSHOT_DIR = path.join(
  __dirname,
  "results",
  "scheduler"
);

async function run() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-dev-shm-usage", "--no-sandbox"],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  page.on("response", (response) => {
    const status = response.status();
    const url = response.url();
    if (status >= 400 && !url.includes("favicon")) {
      networkErrors.push(`${status} ${url}`);
    }
  });

  // ── Step 1: Login via browser page form submit ───────────────────────────
  console.log("[step 1] Logging in via login form ...");
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle", timeout: 15000 });

  await page.fill('input[type="email"]', "amplecapitalholding@gmail.com");
  await page.fill('input[type="password"]', "amplecapitalholding@123");

  // Submit and wait for navigation
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle", timeout: 20000 }),
    page.click('button[type="submit"]'),
  ]);

  const afterLoginUrl = page.url();
  console.log(`[login] After login URL: ${afterLoginUrl}`);

  // Check cookies in context
  const cookies = await context.cookies("http://localhost:3000");
  const sessionCookie = cookies.find((c) => c.name === "admin_session");
  console.log(
    `[login] session cookie: ${sessionCookie ? sessionCookie.name + "=..." + sessionCookie.value?.slice(-10) : "NOT FOUND"}`
  );

  if (!sessionCookie) {
    console.warn("[WARN] No admin_session cookie — trying API fallback");
    // Fallback: call API and set cookie manually
    const apiRes = await context.request.post("http://localhost:3000/api/auth/login", {
      data: { email: "amplecapitalholding@gmail.com", password: "amplecapitalholding@123" },
      headers: { "Content-Type": "application/json" },
    });
    console.log(`[api-login] status=${apiRes.status()}`);
    // Check again
    const cookies2 = await context.cookies("http://localhost:3000");
    const sc2 = cookies2.find((c) => c.name === "admin_session");
    console.log(`[api-login] cookie after API: ${sc2 ? "FOUND" : "STILL NOT FOUND"}`);
  }

  // ── Step 2: Navigate to scheduler page ───────────────────────────────────
  console.log("[step 2] Navigating to /nft/scheduler ...");
  await page.goto("http://localhost:3000/nft/scheduler", {
    waitUntil: "networkidle",
    timeout: 30000,
  });

  // Wait for any async data fetching
  await page.waitForTimeout(4000);

  const finalUrl = page.url();
  console.log(`[nav] Final URL: ${finalUrl}`);

  if (!finalUrl.includes("/nft/scheduler")) {
    console.warn(`[WARN] Not on scheduler page! Redirected to: ${finalUrl}`);
    // Take screenshot anyway to see what page we're on
    const redirectScreenshot = path.join(SCREENSHOT_DIR, "redirect-page.png");
    await page.screenshot({ path: redirectScreenshot, fullPage: true });
    console.log(`[screenshot] redirect page saved to: ${redirectScreenshot}`);

    // Try navigating again after a short delay
    console.log("[retry] Waiting 2s then retrying navigation...");
    await page.waitForTimeout(2000);
    await page.goto("http://localhost:3000/nft/scheduler", {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await page.waitForTimeout(3000);
    console.log(`[retry] URL: ${page.url()}`);
  }

  // ── Step 3: Take full-page screenshot ────────────────────────────────────
  console.log("[step 3] Taking screenshot ...");
  const screenshotPath = path.join(SCREENSHOT_DIR, "scheduler-page.png");
  await page.screenshot({
    path: screenshotPath,
    fullPage: true,
  });
  console.log(`[screenshot] saved to: ${screenshotPath}`);

  // ── Step 4: Get full page text ────────────────────────────────────────────
  const bodyText = await page.locator("body").innerText();
  console.log("\n=== FULL PAGE TEXT ===");
  console.log(bodyText.substring(0, 6000));
  console.log("=== END PAGE TEXT ===\n");

  // ── Step 5: Headings ──────────────────────────────────────────────────────
  const headings = await page.locator("h1, h2, h3, h4").allTextContents();
  console.log(`[headings] ${JSON.stringify(headings)}`);

  // ── Step 6: Table analysis ────────────────────────────────────────────────
  const thTexts = await page.locator("th").allTextContents();
  console.log(`[table headers] ${JSON.stringify(thTexts)}`);

  const tableRowCount = await page.locator("table tbody tr").count();
  console.log(`[table tbody rows] ${tableRowCount}`);

  const tdContents = await page.locator("table tbody tr td").allTextContents();
  console.log(`[all TD contents] ${JSON.stringify(tdContents)}`);

  // ── Step 7: Badges / status indicators ────────────────────────────────────
  const badgeTexts = await page
    .locator("[class*='badge'], [class*='status'], [class*='pill'], span[class*='bg-']")
    .allTextContents();
  console.log(`[badge texts] ${JSON.stringify(badgeTexts)}`);

  // ── Step 8: "How it works" ────────────────────────────────────────────────
  const howItWorksFound = bodyText.toLowerCase().includes("how it works");
  console.log(`[section] "How it works" found: ${howItWorksFound}`);

  // ── Step 9: Cards ─────────────────────────────────────────────────────────
  const cardCount = await page
    .locator("[class*='card'], [class*='Card'], .rounded-xl, .rounded-2xl")
    .count();
  console.log(`[card-like elements] ${cardCount}`);

  // ── Step 10: Toggles / auto-state ─────────────────────────────────────────
  const toggleCount = await page
    .locator("input[type='checkbox'], [role='switch'], button[role='switch']")
    .count();
  console.log(`[toggles] ${toggleCount}`);

  // ── Step 11: Buttons ──────────────────────────────────────────────────────
  const buttonTexts = await page.locator("button").allTextContents();
  console.log(`[buttons] ${JSON.stringify(buttonTexts)}`);

  // ── Step 12: Wave keyword count ───────────────────────────────────────────
  const waveMatches = bodyText.match(/Wave\s*\d/gi) || [];
  console.log(`[wave matches] ${JSON.stringify(waveMatches)}`);

  // ── FINAL REPORT ──────────────────────────────────────────────────────────
  console.log("\n");
  console.log("=".repeat(60));
  console.log("         SCHEDULER PAGE REPORT");
  console.log("=".repeat(60));
  console.log(`URL: ${page.url()}`);
  console.log(`On scheduler page: ${page.url().includes("/nft/scheduler")}`);
  console.log("");
  console.log(`TABLE:`);
  console.log(`  Rows: ${tableRowCount}`);
  console.log(`  Has 7 rows: ${tableRowCount === 7}`);
  console.log(`  Headers: ${JSON.stringify(thTexts)}`);
  console.log("");
  console.log(`CONTENT:`);
  console.log(`  Wave references: ${waveMatches.length} (${JSON.stringify(waveMatches)})`);
  console.log(`  "How it works" section: ${howItWorksFound}`);
  console.log(`  Card-like elements: ${cardCount}`);
  console.log(`  Toggle/switch elements: ${toggleCount}`);
  console.log("");
  console.log(`ERRORS:`);
  console.log(`  Console errors: ${consoleErrors.length}`);
  consoleErrors.forEach((e, i) => console.log(`    [${i + 1}] ${e}`));
  console.log(`  Network errors (4xx/5xx): ${networkErrors.length}`);
  networkErrors.forEach((e) => console.log(`    ${e}`));
  const jsOrCssErrors500 = networkErrors.filter(
    (e) => e.startsWith("5") && (e.includes(".js") || e.includes(".css"))
  );
  console.log(`  JS/CSS 500 errors: ${jsOrCssErrors500.length}`);
  jsOrCssErrors500.forEach((e) => console.log(`    ${e}`));
  console.log("=".repeat(60));

  await context.close();
  await browser.close();

  console.log(`\n[done] Screenshot at: ${screenshotPath}`);
}

run().catch((err) => {
  console.error("[FATAL]", err);
  process.exit(1);
});
