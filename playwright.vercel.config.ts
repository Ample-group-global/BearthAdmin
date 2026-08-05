import { defineConfig, devices } from "@playwright/test";
import path from "path";

const TECH_AUTH = path.join(process.cwd(), "tests", ".auth", "tech.json");

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: 1,
  timeout: 600_000,
  globalSetup: "./tests/global-setup.ts",
  use: {
    baseURL: "https://bearth-admin-it.vercel.app",
    actionTimeout: 15_000,
    trace: "off",
    screenshot: "off",
    video: "off",
    headless: false,
  },
  outputDir: path.join("tests", "results"),
  projects: [
    {
      name: "Desktop Chrome",
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
  ],
});
