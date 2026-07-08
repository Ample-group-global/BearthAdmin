import { test, expect } from "@playwright/test";
import { loginAs, screenshot } from "./helpers";

test.describe("Admin Section (RBAC Management)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin");
  });

  // ── Admin Overview ────────────────────────────────────────────────────────────

  test("admin overview: page loads", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await screenshot(page, "20-admin-overview");
    const body = await page.locator("body").textContent();
    expect(body).toBeTruthy();
  });

  // ── Roles Page ───────────────────────────────────────────────────────────────

  test("roles: page loads with list of roles", async ({ page }) => {
    await page.goto("/admin/roles");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await screenshot(page, "21-admin-roles");
    const body = await page.locator("main").textContent();
    expect(body).toBeTruthy();
  });

  // ── Permissions Page ─────────────────────────────────────────────────────────

  test("permissions: page loads", async ({ page }) => {
    await page.goto("/admin/permissions");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await screenshot(page, "22-admin-permissions");
    const body = await page.locator("main").textContent();
    expect(body).toBeTruthy();
  });

  // ── Menus Page ───────────────────────────────────────────────────────────────

  test("menus: page loads", async ({ page }) => {
    await page.goto("/admin/menus");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await screenshot(page, "23-admin-menus");
    const body = await page.locator("main").textContent();
    expect(body).toBeTruthy();
  });

  // ── Admin Users Page ─────────────────────────────────────────────────────────

  test("admin users: page loads", async ({ page }) => {
    await page.goto("/admin/users");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await screenshot(page, "24-admin-users");
    const body = await page.locator("main").textContent();
    expect(body).toBeTruthy();
  });

  // ── Auth guard ───────────────────────────────────────────────────────────────

  test("unauthenticated user cannot access /admin", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/admin");
    await page.waitForURL(/\/login/, { timeout: 8000 });
    expect(page.url()).toContain("/login");
  });

  test("ops user cannot access /admin", async ({ page }) => {
    await page.context().clearCookies();
    await loginAs(page, "ops");
    await page.goto("/admin");
    // Should be redirected — either to /login or /presale
    await page.waitForURL(/\/(login|presale)/, { timeout: 8000 });
    expect(page.url()).not.toContain("/admin");
    await screenshot(page, "24-admin-ops-blocked");
  });
});
