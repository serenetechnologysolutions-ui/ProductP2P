const { test, expect } = require('@playwright/test');
const { authedPage } = require('./helpers');

// Regression test for the System Admin "Field Settings" feature: toggling a field's
// mandatory flag must take effect immediately in the actual form, and persist reload.
test.describe('Field Settings (mandatory/optional toggle)', () => {
  test.afterEach(async ({ browser }) => {
    // Always restore Department to mandatory regardless of pass/fail, so this test
    // doesn't leave the shared dev DB in a different state for other tests/users.
    const page = await authedPage(browser, 'system_admin');
    await page.goto('/system-settings');
    await page.click('text=Field Settings');
    await page.click('text=Vendor Master / Onboarding');
    const row = page.locator('tr', { hasText: 'Department' }).first();
    const checked = await row.locator('.ant-switch').getAttribute('aria-checked');
    if (checked === 'false') await row.locator('.ant-switch').click();
  });

  test('toggling Department to optional removes it from create-vendor validation', async ({ browser }) => {
    const adminPage = await authedPage(browser, 'system_admin');
    await adminPage.goto('/system-settings');
    await adminPage.click('text=Field Settings');
    await adminPage.click('text=Vendor Master / Onboarding');

    const row = adminPage.locator('tr', { hasText: 'Department' }).first();
    const wasChecked = (await row.locator('.ant-switch').getAttribute('aria-checked')) === 'true';
    expect(wasChecked).toBe(true); // sanity: Department starts mandatory by default
    await row.locator('.ant-switch').click();
    await expect(adminPage.locator('.ant-message-success')).toBeVisible({ timeout: 5000 });

    const vendorAdminPage = await authedPage(browser, 'mdm_admin');
    await vendorAdminPage.goto('/vendors');
    await vendorAdminPage.click('text=Add Vendor');
    await vendorAdminPage.fill('#vendor_name', 'Field Settings Regression Vendor');
    await vendorAdminPage.click('text=Create Vendor');

    await expect(vendorAdminPage.locator('.ant-form-item-explain-error', { hasText: 'Department' })).toHaveCount(0);
    await expect(vendorAdminPage.locator('.ant-form-item-explain-error', { hasText: 'Email' })).toBeVisible();
  });
});
