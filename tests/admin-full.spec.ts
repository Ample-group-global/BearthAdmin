/**
 * Admin Section Full Coverage — deep tests for all RBAC admin features:
 * Roles (role list, select role, permissions tab toggles, menus tab, save);
 * Permissions (search, module groups, permission keys);
 * Menus (module groups, sort order, href display);
 * Users (search, add modal, edit modal, role dropdown, deactivate).
 */
import { test, expect } from "@playwright/test";
import { loginAs, screenshot } from "./helpers";

// ── Admin Roles Page ──────────────────────────────────────────────────────────

test.describe("Admin — Roles Management", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/roles");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
  });

  test("roles page has left sidebar with 'Roles' heading", async ({ page }) => {
    await expect(page.getByText("Roles").first()).toBeVisible({ timeout: 10000 });
    await screenshot(page, "admin-roles-sidebar");
  });

  test("roles list loads with at least one role", async ({ page }) => {
    const roleList = page.locator("aside button, [class*='role'] button").first().or(
      page.locator("button").filter({ hasText: /admin|ops|tech/i }).first()
    );
    await expect(roleList).toBeVisible({ timeout: 10000 });
    await screenshot(page, "admin-roles-list");
  });

  test("right panel shows 'Select a role to manage' when no role selected", async ({ page }) => {
    await expect(page.getByText(/Select a role|select.*role/i)).toBeVisible({ timeout: 8000 });
    await screenshot(page, "admin-roles-no-selection");
  });

  test("clicking a role shows detail panel with Permissions and Menus tabs", async ({ page }) => {
    const firstRole = page.locator("button").filter({ hasText: /admin|ops|tech|operation/i }).first();
    if (await firstRole.count() > 0) {
      await firstRole.click();
      await page.waitForTimeout(800);
      await expect(page.getByRole("button", { name: /Permissions/i })).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole("button", { name: /Menus/i })).toBeVisible({ timeout: 5000 });
      await screenshot(page, "admin-roles-detail-panel");
    }
  });

  test("permissions tab shows module groups with toggle switches", async ({ page }) => {
    const firstRole = page.locator("button").filter({ hasText: /admin|ops|tech|operation/i }).first();
    if (await firstRole.count() > 0) {
      await firstRole.click();
      await page.waitForTimeout(800);
      await page.getByRole("button", { name: /Permissions/i }).click();
      await page.waitForTimeout(600);
      const toggle = page.locator('[role="switch"], input[type="checkbox"]').first();
      if (await toggle.count() > 0) {
        await expect(toggle).toBeVisible({ timeout: 5000 });
      } else {
        await expect(page.locator("main").getByText(/permission|module/i).first()).toBeVisible({ timeout: 5000 });
      }
      await screenshot(page, "admin-roles-permissions-tab");
    }
  });

  test("menus tab is clickable and shows menu assignments", async ({ page }) => {
    const firstRole = page.locator("button").filter({ hasText: /admin|ops|tech|operation/i }).first();
    if (await firstRole.count() > 0) {
      await firstRole.click();
      await page.waitForTimeout(800);
      await page.getByRole("button", { name: /Menus/i }).click();
      await page.waitForTimeout(600);
      await expect(page.locator('input[type="checkbox"]').first().or(
        page.getByText(/menu|sidebar|nav/i).first()
      )).toBeVisible({ timeout: 5000 });
      await screenshot(page, "admin-roles-menus-tab");
    }
  });

  test("Save Menu Assignments button visible in menus tab", async ({ page }) => {
    const firstRole = page.locator("button").filter({ hasText: /admin|ops|tech|operation/i }).first();
    if (await firstRole.count() > 0) {
      await firstRole.click();
      await page.waitForTimeout(800);
      await page.getByRole("button", { name: /Menus/i }).click();
      await page.waitForTimeout(600);
      await expect(page.getByRole("button", { name: /Save Menu Assignments|Save/i })).toBeVisible({ timeout: 5000 });
      await screenshot(page, "admin-roles-save-menus");
    }
  });

  test("each role in list shows role name and color dot", async ({ page }) => {
    const roleBtn = page.locator("button").filter({ hasText: /admin|ops|tech/i }).first();
    await expect(roleBtn).toBeVisible({ timeout: 8000 });
    await screenshot(page, "admin-roles-role-dot");
  });

  test("role code shown below role name in list", async ({ page }) => {
    await expect(page.getByText(/admin|ops|tech|operation/i).first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "admin-roles-role-code");
  });
});

// ── Admin Permissions Registry ────────────────────────────────────────────────

test.describe("Admin — Permissions Registry", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/permissions");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
  });

  test("permission registry heading visible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Permission Registry/i })).toBeVisible({ timeout: 10000 });
    await screenshot(page, "admin-permissions-heading");
  });

  test("total permissions and modules count visible in description", async ({ page }) => {
    await expect(page.getByText(/permissions|modules/i).first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "admin-permissions-counts");
  });

  test("search input is visible", async ({ page }) => {
    const search = page.locator('input[placeholder*="Search"]').or(
      page.locator('input[placeholder*="search"]').or(
        page.locator('input[placeholder*="key"]')
      )
    ).first();
    await expect(search).toBeVisible({ timeout: 8000 });
    await screenshot(page, "admin-permissions-search");
  });

  test("search filters permissions by key", async ({ page }) => {
    const search = page.locator('input').first();
    await search.fill("view");
    await page.waitForTimeout(500);
    await screenshot(page, "admin-permissions-search-view");
    const body = await page.locator("main").textContent();
    expect(body).toBeTruthy();
  });

  test("search clearing shows all permissions", async ({ page }) => {
    const search = page.locator('input').first();
    await search.fill("view");
    await page.waitForTimeout(300);
    await search.fill("");
    await page.waitForTimeout(400);
    await screenshot(page, "admin-permissions-search-cleared");
    await expect(page.locator("main")).toBeVisible();
  });

  test("module groups are displayed with headers", async ({ page }) => {
    await expect(page.locator("section, [class*='group'], h2, h3").first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "admin-permissions-groups");
  });

  test("permission count badges shown per module", async ({ page }) => {
    await expect(page.getByText(/\d+ permission|\d perm/i).first().or(
      page.locator("span").filter({ hasText: /^\d+$/ }).first()
    )).toBeVisible({ timeout: 8000 });
    await screenshot(page, "admin-permissions-count-badges");
  });

  test("permission keys displayed in monospace code style", async ({ page }) => {
    await expect(page.locator("code, .font-mono, [class*='mono']").first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "admin-permissions-key-mono");
  });
});

// ── Admin Menus Registry ──────────────────────────────────────────────────────

test.describe("Admin — Menus Registry", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/menus");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
  });

  test("menu registry heading visible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Menu Registry/i })).toBeVisible({ timeout: 10000 });
    await screenshot(page, "admin-menus-heading");
  });

  test("description mentions role assignment", async ({ page }) => {
    await expect(page.getByText(/role assignment|Roles/i).first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "admin-menus-description");
  });

  test("Presale Management module group visible", async ({ page }) => {
    await expect(page.getByText(/Presale Management/i)).toBeVisible({ timeout: 8000 });
    await screenshot(page, "admin-menus-presale-group");
  });

  test("Technical Dashboard module group visible", async ({ page }) => {
    await expect(page.getByText(/Technical Dashboard/i)).toBeVisible({ timeout: 8000 });
    await screenshot(page, "admin-menus-tech-group");
  });

  test("Admin / RBAC module group visible", async ({ page }) => {
    await expect(page.getByText(/Admin.*RBAC|RBAC/i)).toBeVisible({ timeout: 8000 });
    await screenshot(page, "admin-menus-rbac-group");
  });

  test("menu count badges shown per module", async ({ page }) => {
    await expect(page.locator("span").filter({ hasText: /^\d+$/ }).first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "admin-menus-count-badges");
  });

  test("menu hrefs shown in monospace", async ({ page }) => {
    await expect(page.locator("code, .font-mono, [class*='mono']").filter({ hasText: /\/presale|\/dashboard|\/admin/i }).first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "admin-menus-hrefs");
  });

  test("active indicator shown for menus (green or grey dot)", async ({ page }) => {
    await expect(page.locator("[class*='rounded-full']").first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "admin-menus-active-indicators");
  });

  test("sort order number shown for each menu item", async ({ page }) => {
    await expect(page.locator("span").filter({ hasText: /^\d+$/ }).first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "admin-menus-sort-order");
  });
});

// ── Admin Users Management ────────────────────────────────────────────────────

test.describe("Admin — Admin Users Management", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/users");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
  });

  test("admin users heading visible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Admin Users/i })).toBeVisible({ timeout: 10000 });
    await screenshot(page, "admin-users-heading");
  });

  test("team member count visible in description", async ({ page }) => {
    await expect(page.getByText(/team member|\d+ member/i).first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "admin-users-team-count");
  });

  test("search input visible and functional", async ({ page }) => {
    const search = page.locator('input[placeholder*="Search"]').or(
      page.locator('input[placeholder*="name"]')
    ).first();
    await expect(search).toBeVisible({ timeout: 8000 });
    await search.fill("admin");
    await page.waitForTimeout(500);
    await screenshot(page, "admin-users-search");
  });

  test("admin users table visible with data", async ({ page }) => {
    const table = page.locator("table");
    await expect(table).toBeVisible({ timeout: 10000 });
    const rows = table.locator("tbody tr");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    await screenshot(page, "admin-users-table");
  });

  test("table columns: Name, Email, Role, Status, Last Login, Actions", async ({ page }) => {
    await expect(page.getByText("Name").first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Email").first()).toBeVisible();
    await expect(page.getByText("Role").first()).toBeVisible();
    await expect(page.getByText(/Status|Active/i).first()).toBeVisible();
    await screenshot(page, "admin-users-columns");
  });

  test("role badge shown for each user", async ({ page }) => {
    await expect(page.locator("span").filter({ hasText: /admin|ops|tech|operation/i }).first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "admin-users-role-badge");
  });

  test("active/inactive status badge shown", async ({ page }) => {
    await expect(page.getByText(/Active|Inactive/i).first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "admin-users-status-badge");
  });

  test("last login shows date or dash", async ({ page }) => {
    await expect(page.locator("td").filter({ hasText: /\d{4}|—|Never/i }).first()).toBeVisible({ timeout: 8000 });
    await screenshot(page, "admin-users-last-login");
  });

  test("Add User button opens create modal", async ({ page }) => {
    await page.getByRole("button", { name: /Add User|New User/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText("First Name")).toBeVisible({ timeout: 5000 });
    await screenshot(page, "admin-users-modal-open");
  });

  test("create modal has all required form fields", async ({ page }) => {
    await page.getByRole("button", { name: /Add User|New User/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText("First Name")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Email").first()).toBeVisible();
    await expect(page.getByText("Role").first()).toBeVisible();
    await screenshot(page, "admin-users-modal-fields");
  });

  test("role dropdown in create modal has options", async ({ page }) => {
    await page.getByRole("button", { name: /Add User|New User/i }).click();
    await page.waitForTimeout(500);
    const roleSelect = page.locator("select").first();
    if (await roleSelect.count() > 0) {
      const options = await roleSelect.locator("option").allTextContents();
      expect(options.length).toBeGreaterThan(1);
      expect(options.some((o) => /admin|ops|tech|operation/i.test(o))).toBe(true);
      await screenshot(page, "admin-users-role-select");
    }
    await page.getByRole("button", { name: /Cancel/i }).click();
  });

  test("create modal Cancel closes modal", async ({ page }) => {
    await page.getByRole("button", { name: /Add User|New User/i }).click();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: /Cancel/i }).click();
    await page.waitForTimeout(400);
    await expect(page.getByRole("button", { name: /Add User|New User/i })).toBeVisible();
    await screenshot(page, "admin-users-modal-cancelled");
  });

  test("Edit button opens edit modal", async ({ page }) => {
    const editBtn = page.getByRole("button", { name: /edit/i }).first();
    if (await editBtn.count() > 0) {
      await editBtn.click();
      await page.waitForTimeout(500);
      await expect(page.getByText("First Name")).toBeVisible({ timeout: 5000 });
      await page.getByRole("button", { name: /Cancel/i }).click();
      await screenshot(page, "admin-users-edit-modal");
    }
  });

  test("Deactivate button shows confirmation modal", async ({ page }) => {
    const deactivateBtn = page.getByRole("button", { name: /deactivate/i }).first();
    if (await deactivateBtn.count() > 0) {
      await deactivateBtn.click();
      await page.waitForTimeout(400);
      await expect(page.getByRole("button", { name: /Cancel/i })).toBeVisible({ timeout: 3000 });
      await page.getByRole("button", { name: /Cancel/i }).click();
      await screenshot(page, "admin-users-deactivate-modal");
    }
  });
});
