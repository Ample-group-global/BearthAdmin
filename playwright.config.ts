import { defineConfig, devices } from "@playwright/test";
import path from "path";

const ADMIN_AUTH = path.join(process.cwd(), "tests", ".auth", "admin.json");
const TECH_AUTH  = path.join(process.cwd(), "tests", ".auth", "tech.json");

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: 1,
  timeout: 60000,
  globalSetup: "./tests/global-setup.ts",
  use: {
    baseURL: "http://localhost:3000",
    actionTimeout: 5000,
    trace: "off",
    screenshot: "on",
    video: "off",
    headless: false,
  },
  outputDir: path.join("tests", "results"),
  projects: [
    {
      name: "Desktop Chrome",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--disable-dev-shm-usage",
            "--no-sandbox",
            "--js-flags=--max-old-space-size=4096",
          ],
        },
      },
    },
    // Authenticated project: reuses saved admin session — no login DB hit per test
    {
      name: "Authenticated",
      use: {
        ...devices["Desktop Chrome"],
        storageState: ADMIN_AUTH,
        launchOptions: {
          args: [
            "--disable-dev-shm-usage",
            "--no-sandbox",
            "--js-flags=--max-old-space-size=4096",
          ],
        },
      },
    },
    // Audit project: reuses saved tech session — no login DB hit per test
    {
      name: "Audit Chrome",
      use: {
        ...devices["Desktop Chrome"],
        storageState: TECH_AUTH,
        launchOptions: {
          args: [
            "--disable-dev-shm-usage",
            "--no-sandbox",
            "--js-flags=--max-old-space-size=4096",
          ],
        },
      },
    },
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 13"] },
    },
    {
      name: "Tablet",
      use: { ...devices["iPad Pro"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
    timeout: 60000,
  },
});
