/**
 * playwright.phases.config.ts
 *
 * Playwright config for phase-based priority testing.
 *
 * Usage:
 *   Run all phases (sequential):
 *     npx playwright test --config=playwright.phases.config.ts
 *
 *   Run a specific phase only:
 *     npx playwright test --config=playwright.phases.config.ts tests/phases/phase-01-filebase-sync.spec.ts
 *     npx playwright test --config=playwright.phases.config.ts tests/phases/phase-02-wave-scheduling.spec.ts
 *     npx playwright test --config=playwright.phases.config.ts tests/phases/phase-03-wave-revealing.spec.ts
 *     npx playwright test --config=playwright.phases.config.ts tests/phases/phase-04-treasury-transfer.spec.ts
 *
 *   Target Vercel (BearthAdmin-IT):
 *     BASE_URL=https://bearth-admin-it.vercel.app npx playwright test --config=playwright.phases.config.ts
 *
 * Phase order MUST be respected:
 *   Phase 01 → Phase 02 → Phase 03 → Phase 04
 *   Each phase is auto-skipped once locked (tests/phase-lock.json).
 *
 * Phase locking:
 *   - When ALL tests in a phase pass: phase is locked in tests/phase-lock.json
 *   - Locked phases are skipped on future runs
 *   - To re-run a locked phase: set "locked": false in tests/phase-lock.json
 */

import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const TECH_AUTH = path.join(process.cwd(), 'tests', '.auth', 'tech.json');
const BASE_URL  = process.env.BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir:     './tests/phases',
  testMatch:   ['**/phase-0[1-6]*.spec.ts'],
  globalSetup: './tests/global-setup-phases.ts',

  fullyParallel: false,
  workers:       1,         // phases must run sequentially
  retries:       1,         // one retry for Sepolia timing issues
  timeout:       300_000,   // 5 min per test (on-chain TX + VRF wait)

  use: {
    baseURL:           BASE_URL,
    storageState:      TECH_AUTH,
    actionTimeout:     30_000,
    navigationTimeout: 60_000,
    trace:             'off',
    screenshot:        'off',
    video:             'off',
    headless:          false,
  },

  outputDir: path.join('tests', 'phase-results'),

  reporter: [
    ['line'],
    ['json', { outputFile: path.join('tests', 'phase-results', 'phase-report.json') }],
  ],

  projects: [
    {
      name: 'Desktop Chrome',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--disable-dev-shm-usage',
            '--no-sandbox',
            '--js-flags=--max-old-space-size=4096',
          ],
        },
      },
    },
  ],
});
