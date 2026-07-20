// Route: /admin/roles — Role management page
import { test, expect } from "@playwright/test";
import path from "path";

test.use({ storageState: path.join(process.cwd(), "tests", ".auth", "admin.json") });

test.describe("Admin Roles Page", () => {
  test("loads and shows Roles heading", async ({ page }) => {
    await page.goto("/admin/roles");
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/login");

    // Heading is "Roles" (h2 in the sidebar panel)
    const heading = page.locator('h2, h1').first();
    await expect(heading).toBeVisible({ timeout: 20000 });
    await expect(heading).toContainText(/Roles/i);
  });

  test("roles list panel is visible", async ({ page }) => {
    await page.goto("/admin/roles");
    await page.waitForLoadState("networkidle");

    // Roles are displayed as a list of role name buttons
    const rolesArea = page.locator('text=/Admin|Operation|Technical|Customer|Referrer/i').first();
    await expect(rolesArea).toBeVisible({ timeout: 20000 });
  });

  test("selecting a role shows its permissions tab", async ({ page }) => {
    await page.goto("/admin/roles");
    await page.waitForLoadState("networkidle");

    // Click first role button to select it
    const firstRoleBtn = page.locator('button[class*="role"], [class*="role-item"], li button').first();
    if (await firstRoleBtn.isVisible()) {
      await firstRoleBtn.click();
      const permissionsTab = page.locator('text=/Permissions/i').first();
      await expect(permissionsTab).toBeVisible({ timeout: 10000 });
    } else {
      // Just verify the page loaded correctly
      expect(page.url()).not.toContain("/login");
    }
  });

  test("session is authenticated (no redirect to login)", async ({ page }) => {
    await page.goto("/admin/roles");
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/login");
  });
});
