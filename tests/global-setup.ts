import { chromium } from "@playwright/test";
import path from "path";
import fs from "fs";

const ADMIN_AUTH = path.join(process.cwd(), "tests", ".auth", "admin.json");
const TECH_AUTH  = path.join(process.cwd(), "tests", ".auth", "tech.json");

const ADMIN_EMAIL    = "official@imbearth.com";
const ADMIN_PASSWORD = "officialbearth@123";
const TECH_EMAIL     = "amplecapitalholding@gmail.com";
const TECH_PASSWORD  = "amplecapitalholding@123";

function sessionIsValid(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  try {
    const content = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!content.cookies || content.cookies.length === 0) return false;
  } catch { return false; }
  const stat = fs.statSync(filePath);
  // Reuse session if written within the last 23 hours
  const ageMs = Date.now() - stat.mtimeMs;
  return ageMs < 23 * 60 * 60 * 1000;
}

async function createSession(browser: any, email: string, password: string, filePath: string) {
  const context = await browser.newContext();
  const page    = await context.newPage();
  try {
    await page.goto("http://localhost:3000/login");
    await page.getByPlaceholder("Enter your email").fill(email);
    await page.getByPlaceholder("Enter your password").fill(password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await page.waitForURL((url: URL) => !url.pathname.includes("/login"), { timeout: 30000 });
    await context.storageState({ path: filePath });
    console.log(`[global-setup] Created session for ${email} → ${filePath}`);
  } finally {
    await context.close();
  }
}

export default async function globalSetup() {
  const adminValid = sessionIsValid(ADMIN_AUTH);
  const techValid  = sessionIsValid(TECH_AUTH);

  if (adminValid && techValid) {
    console.log("[global-setup] Reusing existing auth sessions (< 23h old).");
    return;
  }

  const browser = await chromium.launch({ headless: true });
  try {
    if (!adminValid) await createSession(browser, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_AUTH);
    if (!techValid)  await createSession(browser, TECH_EMAIL,  TECH_PASSWORD,  TECH_AUTH);
  } finally {
    await browser.close();
  }
}
