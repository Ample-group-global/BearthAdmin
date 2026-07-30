import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const SCREENSHOT_DIR = path.join(
  process.cwd(),
  "tests",
  "results",
  "scheduler"
);

// Standalone test — does its own login via API and avoids global-setup dependency
test.describe.configure({ mode: "serial" });

test("scheduler page - full inspection", async ({ browser }) => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  // Create a fresh browser context (no stored state)
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
    }
  });

  page.on("response", (response) => {
    const status = response.status();
    const url = response.url();
    if (status >= 400 && !url.includes("favicon")) {
      networkErrors.push(`${status} ${url}`);
    }
  });

  // ── Step 1: Login via API POST, capture Set-Cookie ────────────────────────
  // Use page.request to make authenticated request and capture cookies
  const loginResponse = await page.request.post(
    "http://localhost:3000/api/auth/login",
    {
      data: {
        email: "amplecapitalholding@gmail.com",
        password: "amplecapitalholding@123",
      },
      headers: { "Content-Type": "application/json" },
    }
  );

  const loginStatus = loginResponse.status();
  const loginBody = await loginResponse.json().catch(() => ({}));
  console.log(`[login] status=${loginStatus} body=${JSON.stringify(loginBody)}`);

  // The cookies from the API call should be set in the context automatically
  // since page.request shares the context's cookie jar
  const cookies = await context.cookies("http://localhost:3000");
  const sessionCookie = cookies.find((c) => c.name === "admin_session");
  console.log(
    `[login] session cookie found: ${!!sessionCookie} name=${sessionCookie?.name} expires=${sessionCookie?.expires}`
  );

  // ── Step 2: Navigate to scheduler page ───────────────────────────────────
  await page.goto("http://localhost:3000/nft/scheduler", {
    waitUntil: "networkidle",
    timeout: 30000,
  });

  // Wait for page to fully render (API calls, etc.)
  await page.waitForTimeout(4000);

  const finalUrl = page.url();
  console.log(`[nav] Final URL: ${finalUrl}`);

  // ── Step 3: Screenshot ────────────────────────────────────────────────────
  const screenshotPath = path.join(SCREENSHOT_DIR, "scheduler-page.png");
  await page.screenshot({
    path: screenshotPath,
    fullPage: true,
  });
  console.log(`[screenshot] saved to: ${screenshotPath}`);

  // ── Step 4: Get full page text ────────────────────────────────────────────
  const bodyText = await page.locator("body").innerText();
  console.log("\n=== FULL PAGE TEXT ===");
  console.log(bodyText.substring(0, 5000));
  console.log("=== END PAGE TEXT ===\n");

  // ── Step 5: Headings ──────────────────────────────────────────────────────
  const headings = await page.locator("h1, h2, h3, h4").allTextContents();
  console.log(`[headings] ${JSON.stringify(headings)}`);

  // ── Step 6: Table headers ─────────────────────────────────────────────────
  const thTexts = await page.locator("th").allTextContents();
  console.log(`[table headers] ${JSON.stringify(thTexts)}`);

  // ── Step 7: Table rows ────────────────────────────────────────────────────
  const tableRowCount = await page.locator("table tbody tr").count();
  console.log(`[table tbody rows] ${tableRowCount}`);

  // ── Step 8: All table cell contents ───────────────────────────────────────
  const tdContents = await page.locator("table tbody tr td").allTextContents();
  console.log(`[all TD contents] ${JSON.stringify(tdContents)}`);

  // ── Step 9: Badge / status elements ──────────────────────────────────────
  const badgeTexts = await page
    .locator("span[class*='badge'], span[class*='status'], [class*='badge'], [class*='pill']")
    .allTextContents();
  console.log(`[badges] ${JSON.stringify(badgeTexts)}`);

  // ── Step 10: "How it works" check ────────────────────────────────────────
  const howItWorksFound = bodyText.toLowerCase().includes("how it works");
  console.log(`[section] "How it works" found: ${howItWorksFound}`);

  // ── Step 11: Cards check ──────────────────────────────────────────────────
  const cardCount = await page
    .locator("[class*='card'], [class*='Card']")
    .count();
  console.log(`[cards] ${cardCount}`);

  // ── Step 12: Buttons ──────────────────────────────────────────────────────
  const buttonTexts = await page.locator("button").allTextContents();
  console.log(`[buttons] ${JSON.stringify(buttonTexts)}`);

  // ── Step 13: Wave keyword count ───────────────────────────────────────────
  const waveMatches = bodyText.match(/Wave\s*\d/gi) || [];
  console.log(`[wave keyword matches] ${JSON.stringify(waveMatches)}`);

  // ── Step 14: Check specific column content ────────────────────────────────
  // Start, End, Reveal trigger badge values
  const startBadges = await page
    .locator("td:nth-child(3), [data-col='start']")
    .allTextContents();
  console.log(`[start col] ${JSON.stringify(startBadges)}`);

  const endBadges = await page
    .locator("td:nth-child(4), [data-col='end']")
    .allTextContents();
  console.log(`[end col] ${JSON.stringify(endBadges)}`);

  const revealBadges = await page
    .locator("td:nth-child(5), [data-col='reveal']")
    .allTextContents();
  console.log(`[reveal col] ${JSON.stringify(revealBadges)}`);

  // Auto state column (likely col 6 or has toggle)
  const toggleCount = await page.locator("input[type='checkbox'], [role='switch']").count();
  console.log(`[toggle/switch count] ${toggleCount}`);

  // ── FINAL REPORT ──────────────────────────────────────────────────────────
  console.log("\n=============== SCHEDULER PAGE REPORT ===============");
  console.log(`URL: ${finalUrl}`);
  console.log(`On scheduler page: ${finalUrl.includes("/nft/scheduler")}`);
  console.log(`Table row count: ${tableRowCount}`);
  console.log(`Has exactly 7 rows: ${tableRowCount === 7}`);
  console.log(`Wave references in text: ${waveMatches.length}`);
  console.log(`"How it works" visible: ${howItWorksFound}`);
  console.log(`Card elements: ${cardCount}`);
  console.log(`Toggle/switch elements: ${toggleCount}`);
  console.log(`Console errors: ${consoleErrors.length}`);
  consoleErrors.forEach((e) => console.log(`  ${e}`));
  console.log(`Network errors: ${networkErrors.length}`);
  networkErrors.forEach((e) => console.log(`  ${e}`));
  const jsOrCssErrors500 = networkErrors.filter(
    (e) => e.startsWith("5") && (e.includes(".js") || e.includes(".css"))
  );
  console.log(`JS/CSS 500 errors: ${jsOrCssErrors500.length}`);
  jsOrCssErrors500.forEach((e) => console.log(`  ${e}`));
  console.log("=====================================================\n");

  await context.close();

  // Assertions
  expect(finalUrl).toContain("/nft/scheduler");
  expect(jsOrCssErrors500).toHaveLength(0);
});
