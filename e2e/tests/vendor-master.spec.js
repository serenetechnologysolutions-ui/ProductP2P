const { test, expect } = require('@playwright/test');
const { authedPage } = require('./helpers');

test.describe('Vendor Master', () => {
  test('mdm_admin creates a new vendor and sees it in the list', async ({ browser }) => {
    const page = await authedPage(browser, 'mdm_admin');
    await page.goto('/vendors');
    await page.click('text=Add Vendor');

    const uniqueName = `E2E Test Vendor ${Date.now()}`;
    await page.fill('#vendor_name', uniqueName);
    await page.fill('#email', `e2e${Date.now()}@example.com`);
    await page.fill('#phone', '+91 9999999999');

    // Company / Department / Supplier Group / Category — antd Select dropdowns.
    // Keyboard selection avoids pointer-interception flakiness from clicking
    // through an animating dropdown panel.
    for (const fieldId of ['company_name', 'department', 'supplier_group', 'supplier_category']) {
      await page.locator(`#${fieldId}`).click();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
    }
    await page.fill('#supplier_location', 'Mumbai');

    await page.click('text=Create Vendor');
    await expect(page.locator('.ant-message-success, text=Vendor created')).toBeVisible({ timeout: 5000 }).catch(() => {});
    await page.goto('/vendors');
    await page.fill('input[placeholder="Search by Name"]', uniqueName);
    await page.click('text=Search');
    await expect(page.locator(`text=${uniqueName}`)).toBeVisible({ timeout: 5000 });
  });

  test('vendor list search and clear work', async ({ browser }) => {
    const page = await authedPage(browser, 'mdm_admin');
    await page.goto('/vendors');
    await page.fill('input[placeholder="Search by Name"]', 'zzz-no-such-vendor-zzz');
    await page.click('text=Search');
    await expect(page.locator('.ant-empty')).toBeVisible({ timeout: 5000 });
    await page.click('text=Clear');
    await expect(page.locator('input[placeholder="Search by Name"]')).toHaveValue('');
  });
});
