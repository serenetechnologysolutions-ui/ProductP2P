const { test, expect } = require('@playwright/test');
const { authedPage } = require('./helpers');

// Regression test for the popup -> Drawer conversion: these used to be centered
// antd Modals; they should now be right-side Drawers with no .ant-modal in the DOM.
test.describe('Popups are Drawers', () => {
  test('Add User opens as a Drawer', async ({ browser }) => {
    const page = await authedPage(browser, 'mdm_admin');
    await page.goto('/user-management');
    await page.click('text=Add User');
    await expect(page.locator('.ant-drawer-content')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.ant-modal-content')).toHaveCount(0);
    await expect(page.locator('.ant-drawer-body')).toBeVisible();
    await expect(page.locator('.ant-drawer-footer')).toBeVisible();
  });

  test('Import Excel (Vendors) opens as a Drawer', async ({ browser }) => {
    const page = await authedPage(browser, 'mdm_admin');
    await page.goto('/vendors');
    await page.click('text=Import Excel');
    await expect(page.locator('.ant-drawer-content')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.ant-modal-content')).toHaveCount(0);
  });

  test('Create Ticket opens as a Drawer', async ({ browser }) => {
    const page = await authedPage(browser, 'mdm_admin');
    await page.goto('/tickets');
    await page.click('text=Create Ticket');
    await expect(page.locator('.ant-drawer-content')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.ant-modal-content')).toHaveCount(0);
  });
});
