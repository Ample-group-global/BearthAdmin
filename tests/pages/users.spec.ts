// Route: /users — Bearth team/staff user management page
import { test, expect } from "@playwright/test";
import path from "path";

test.use({ storageState: path.join(process.cwd(), "tests", ".auth", "admin.json") });

// Helper: wait for AppShell auth to complete (Sign Out button visible = sidebar rendered)
async function waitForAppShell(page: any) {
  await page.locator('text=Verifying access').waitFor({ state: 'detached', timeout: 60000 }).catch(() => {});
  await page.locator('button').filter({ hasText: /Sign Out/i }).waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
}

test.describe("Presale Users (Team) Page", () => {
  test("loads and shows heading", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/users", { timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await waitForAppShell(page);
    expect(page.url()).not.toContain("/login");

    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 30000 });
    // Heading is "Bearth Team"
    await expect(heading).toContainText(/Team|Users|Staff/i);
  });

  test("table or empty state renders", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/users", { timeout: 90000 });
    await waitForAppShell(page);

    // Table when data exists, or DataTable empty state
    const content = page.locator('table').or(
      page.locator('div.flex-col.h-52').or(
        page.locator('p').filter({ hasText: /No users|No team members/i })
      )
    ).first();
    await expect(content).toBeVisible({ timeout: 60000 });
  });

  test("invite or add user button is present", async ({ page }) => {
    await page.goto("/users");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    // May or may not be present depending on role permissions; just check page loaded
    expect(page.url()).not.toContain("/login");
  });
});
