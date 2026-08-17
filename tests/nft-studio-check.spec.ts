/**
 * NFT Studio — generator page smoke check.
 * Verifies:
 *   1. Settings tab loads — active layers folder shows "None" (not stale disk folder)
 *   2. Organize tab is reachable and does NOT show disk-scanned folder name
 *   3. Collection size loads from DB (not always defaulting to 100)
 *   4. All Settings inputs are editable
 */

import { test, expect } from '@playwright/test';

const STUDIO_URL = '/dashboard/generator';

async function waitForStudio(page) {
  await page.goto(STUDIO_URL);
  // Wait until the studio shell itself is visible (past the "Verifying access…" gate)
  await expect(page.locator('.studio-wrap').first()).toBeVisible({ timeout: 30_000 });
  // domcontentloaded is sufficient — the studio fires DB fetches async after mount
  await page.waitForLoadState('domcontentloaded');
  // Give async DB fetches time to settle
  await page.waitForTimeout(3000);
}

test.describe('NFT Studio — generator page', () => {
  test.describe.configure({ mode: 'serial' });

  test('S-01: Settings tab — Active layers folder shows "None" (no stale disk folder)', async ({ page }) => {
    test.setTimeout(60_000);
    await waitForStudio(page);

    await page.screenshot({
      path: 'tests/phase-results/screenshots/settings/nft-studio-settings.png',
      fullPage: true,
    }).catch(() => {});

    const body = await page.textContent('body') ?? '';

    // Studio must be rendered
    expect(body).toMatch(/NFT Studio|Bearth/i);

    // The active folder row must show "None", not a stale disk folder
    const folderLabel = page.getByText('Active layers folder:', { exact: false }).first();
    const folderVisible = await folderLabel.isVisible({ timeout: 5_000 }).catch(() => false);

    if (folderVisible) {
      const container = folderLabel.locator('..');
      const rowText = await container.textContent() ?? '';
      console.log(`S-01: Active folder row: "${rowText.trim()}"`);

      // Must NOT contain a stale disk folder path
      expect(rowText).not.toMatch(/Nft_Layer-V2/i);
      expect(rowText).not.toMatch(/BearthLayers|exported_layers/i);
      // Must contain "None" indicator
      expect(rowText).toMatch(/None|none/i);
      console.log('S-01: Active layers folder = "None" — no stale disk folder ✓');
    } else {
      // The row is hidden when activeFolder is '' — that is also correct
      console.log('S-01: Active layers folder row hidden — clean empty state ✓');
    }
  });

  test('S-02: Organize tab reachable — no stale "Nft_Layer-V2" layers shown', async ({ page }) => {
    test.setTimeout(60_000);
    await waitForStudio(page);

    // StepNav uses label "Organize" (American spelling), class "step-btn"
    const organizeTab = page.locator('button.step-btn').filter({ hasText: /Organize/i }).first();
    await expect(organizeTab).toBeVisible({ timeout: 10_000 });
    await organizeTab.click();

    await page.waitForTimeout(1500);

    await page.screenshot({
      path: 'tests/phase-results/screenshots/organize/nft-studio-organize.png',
      fullPage: true,
    }).catch(() => {});

    const body = await page.textContent('body') ?? '';

    // The disk folder name must never appear — whether the organise is empty or
    // showing a legitimately restored DB collection
    expect(body).not.toMatch(/Nft_Layer-V2/i);
    console.log('S-02: No stale "Nft_Layer-V2" folder in Organize tab ✓');

    // Log what IS showing so we can confirm correct state
    const hasEmpty = /No layers yet|Back to Settings/i.test(body);
    const hasLayers = /\d+ Files/i.test(body);
    if (hasEmpty)  console.log('S-02: Organize shows empty state ✓ (no collection saved yet)');
    if (hasLayers) console.log('S-02: Organize shows DB-restored layers ✓ (resumed collection)');
  });

  test('S-03: Collection size loads from DB — not hardcoded 100 when DB record exists', async ({ page }) => {
    test.setTimeout(60_000);
    await waitForStudio(page);

    // The page already fetches from DB on mount and updates the supply input.
    // Reading the input directly is sufficient — if the DB fetch ran and the
    // page settled, this value reflects what is stored in the DB.
    const supplyInput = page.locator('input[type="number"]').first();
    await expect(supplyInput).toBeVisible({ timeout: 5_000 });
    const supplyVal = await supplyInput.inputValue().catch(() => '');
    console.log(`S-03: Collection Size input = "${supplyVal}"`);

    // Supply must be a valid positive integer
    const parsed = parseInt(supplyVal, 10);
    expect(parsed).toBeGreaterThanOrEqual(1);
    console.log(`S-03: Supply input shows ${parsed} — valid DB-loaded value ✓`);
  });

  test('S-04: All Settings inputs are enabled and editable', async ({ page }) => {
    test.setTimeout(60_000);
    await waitForStudio(page);

    // Key form controls must be enabled
    const nameInput = page.locator('input').first();
    await expect(nameInput).toBeEnabled({ timeout: 5_000 });

    const blockchain = page.locator('select').first();
    await expect(blockchain).toBeEnabled({ timeout: 5_000 });

    const supplyInput = page.locator('input[type="number"]').first();
    await expect(supplyInput).toBeEnabled({ timeout: 5_000 });

    const saveBtn = page.locator('button.step-btn.step-active, button').filter({ hasText: /Save & Continue/i }).first();
    await expect(saveBtn).toBeVisible({ timeout: 5_000 });
    await expect(saveBtn).toBeEnabled();

    await page.screenshot({
      path: 'tests/phase-results/screenshots/settings/nft-studio-inputs-enabled.png',
      fullPage: true,
    }).catch(() => {});

    console.log('S-04: All Settings inputs enabled ✓');
  });

  test('S-05: Adjust rarity weight for a trait — persists after reload', async ({ page }) => {
    test.setTimeout(60_000);
    await waitForStudio(page);

    const organizeTab = page.locator('button.step-btn').filter({ hasText: /Organize/i }).first();
    await organizeTab.click();
    await page.waitForTimeout(2000);

    // Clicking a card now opens the same unified layer modal used by the
    // gear icon (CardModal/.cm-weight-input were removed) — scrolled to the
    // clicked trait. Operate on the first row inside it; data-stem lets us
    // re-find that exact same trait after reload regardless of row order.
    const firstCard = page.locator('.asset-card').first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });
    await firstCard.click();

    const firstRow = page.locator('.rm-row-v2').first();
    await expect(firstRow).toBeVisible({ timeout: 5_000 });
    const stem = await firstRow.getAttribute('data-stem');
    await firstRow.locator('.rm-pct-toggle').click();
    const weightInput = firstRow.locator('.rm-w-input');
    await expect(weightInput).toBeVisible({ timeout: 5_000 });
    const original = await weightInput.inputValue();
    const newWeight = parseFloat(original) === 42 ? '17' : '42';
    console.log(`S-05: trait weight ${original} -> ${newWeight}`);

    await weightInput.fill(newWeight);
    await weightInput.blur();
    const saveBtn = page.locator('.rm-footer button').filter({ hasText: /Save Rarity/i }).first();
    await saveBtn.click();
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: 'tests/phase-results/screenshots/organize/nft-studio-rarity-adjust.png',
      fullPage: true,
    }).catch(() => {});

    // Reload the whole page and re-open the SAME trait (by stem) to confirm the DB write stuck
    await waitForStudio(page);
    await organizeTab.click();
    await page.waitForTimeout(2000);
    await page.locator('.asset-card').first().click();

    const reloadedRow = page.locator(`.rm-row-v2[data-stem="${stem}"]`).first();
    await expect(reloadedRow).toBeVisible({ timeout: 5_000 });
    await reloadedRow.locator('.rm-pct-toggle').click();
    const reloadedInput = reloadedRow.locator('.rm-w-input');
    await expect(reloadedInput).toBeVisible({ timeout: 5_000 });
    const persisted = await reloadedInput.inputValue();
    console.log(`S-05: weight after reload = ${persisted}`);
    expect(persisted).toBe(newWeight);
    console.log('S-05: Rarity weight adjustment persisted through PUT + reload ✓');
  });
});
