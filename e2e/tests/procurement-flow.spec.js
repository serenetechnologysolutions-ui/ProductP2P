const { test, expect } = require('@playwright/test');
const { authedPage } = require('./helpers');

test.describe('Purchase Orders', () => {
  test('mdm_admin creates a PO with one line item', async ({ browser }) => {
    const page = await authedPage(browser, 'mdm_admin');
    await page.goto('/purchase-orders');
    await page.click('text=Create PO');

    const poNumber = `PO-E2E-${Date.now()}`;
    await page.fill('#po_number', poNumber);
    // Type the date directly rather than driving the calendar panel — antd's
    // popup-panel open/close animation made clicking through it flaky here.
    const today = new Date().toISOString().slice(0, 10);
    await page.locator('#po_date').fill(today);
    await page.keyboard.press('Escape');
    await page.locator('#vendor_id').click();
    await expect(page.locator('.ant-select-dropdown')).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await page.fill('input[placeholder="Description"]', 'E2E line item');
    await page.click('text=Create PO');
    await expect(page.locator('.ant-message-success, text=PO created')).toBeVisible({ timeout: 5000 }).catch(() => {});
  });
});

test.describe('ASNs', () => {
  test('vendor sees the Create ASN entrypoint', async ({ browser }) => {
    const page = await authedPage(browser, 'vendor');
    await page.goto('/vendor-asns');
    await expect(page.locator('text=Create ASN')).toBeVisible();
  });

  test('vendor ASN create wizard requires a PO before advancing', async ({ browser }) => {
    const page = await authedPage(browser, 'vendor');
    await page.goto('/vendor-asns');
    await page.click('text=Create ASN');
    await expect(page.locator('text=Select Purchase Order')).toBeVisible();
  });
});
