/**
 * Responsive visual check — 375 / 768 / 1280
 * Run: npx playwright test tests/responsive-check.ts --config playwright.config.ts
 */
import { test, expect, Page } from "@playwright/test";
import path from "path";
import fs from "fs";

const BASE = "http://localhost:3000";
const OUT  = path.join(process.cwd(), "tests", "responsive-shots");
fs.mkdirSync(OUT, { recursive: true });

const BREAKPOINTS = [
  { name: "mobile-375",  width: 375,  height: 812  },
  { name: "tablet-768",  width: 768,  height: 1024 },
  { name: "desktop-1280",width: 1280, height: 900  },
];

const PAGES = [
  { slug: "login",          path: "/login",               auth: false },
  { slug: "forgot-password",path: "/forgot-password",     auth: false },
  { slug: "dashboard",      path: "/",                    auth: true  },
  { slug: "nft-waves",      path: "/nft/waves",           auth: true  },
  { slug: "nft-records",    path: "/nft/records",         auth: true  },
  { slug: "orders",         path: "/orders",              auth: true  },
  { slug: "customers",      path: "/customers",           auth: true  },
  { slug: "products",       path: "/products",            auth: true  },
  { slug: "fulfillment",    path: "/fulfillment",         auth: true  },
  { slug: "payment-methods",path: "/settings/payment-methods", auth: true },
  { slug: "opensea-nfts",   path: "/admin/opensea/nfts",  auth: true  },
  { slug: "opensea-collections", path: "/admin/opensea/collections", auth: true },
];

async function shot(page: Page, slug: string, bp: typeof BREAKPOINTS[0]) {
  await page.waitForTimeout(800);
  const file = path.join(OUT, `${bp.name}--${slug}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  ✓ ${bp.name}--${slug}.png`);
}

test.describe("Responsive check", () => {
  for (const bp of BREAKPOINTS) {
    test(`Breakpoint ${bp.name} (${bp.width}px)`, async ({ browser }) => {
      // Auth pages — no login needed
      const noAuthCtx = await browser.newContext({ viewport: { width: bp.width, height: bp.height } });
      const noAuthPage = await noAuthCtx.newPage();

      for (const pg of PAGES.filter(p => !p.auth)) {
        await noAuthPage.goto(`${BASE}${pg.path}`, { waitUntil: "networkidle" });
        await shot(noAuthPage, pg.slug, bp);
      }
      await noAuthCtx.close();

      // Authenticated pages
      const authCtx = await browser.newContext({
        viewport: { width: bp.width, height: bp.height },
        storageState: path.join(process.cwd(), "tests", ".auth", "tech.json"),
      });
      const authPage = await authCtx.newPage();

      for (const pg of PAGES.filter(p => p.auth)) {
        await authPage.goto(`${BASE}${pg.path}`, { waitUntil: "networkidle" });
        await shot(authPage, pg.slug, bp);
      }
      await authCtx.close();
    });
  }
});
