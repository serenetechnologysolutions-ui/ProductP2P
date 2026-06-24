const { test, expect } = require('@playwright/test');
const { authedPage } = require('./helpers');

// Regression test for the role-based route guard added during the security pass:
// a vendor typing an admin URL directly should be bounced to the dashboard, not
// shown the admin page (even transiently) while relying only on a 403 from the API.
test.describe('Role-based route access', () => {
  test('vendor cannot reach system-settings by direct URL', async ({ browser }) => {
    const page = await authedPage(browser, 'vendor');
    await page.goto('/system-settings');
    await expect(page).toHaveURL('/');
  });

  test('vendor cannot reach user-management by direct URL', async ({ browser }) => {
    const page = await authedPage(browser, 'vendor');
    await page.goto('/user-management');
    await expect(page).toHaveURL('/');
  });

  test('vendor cannot reach vendors (master list) by direct URL', async ({ browser }) => {
    const page = await authedPage(browser, 'vendor');
    await page.goto('/vendors');
    await expect(page).toHaveURL('/');
  });

  test('system_admin can reach system-settings', async ({ browser }) => {
    const page = await authedPage(browser, 'system_admin');
    await page.goto('/system-settings');
    await expect(page).toHaveURL('/system-settings');
    await expect(page.getByRole('heading', { name: 'System Settings' })).toBeVisible();
  });

  test('mdm_admin can reach vendors', async ({ browser }) => {
    const page = await authedPage(browser, 'mdm_admin');
    await page.goto('/vendors');
    await expect(page).toHaveURL('/vendors');
    await expect(page.getByRole('heading', { name: 'Vendor Master' })).toBeVisible();
  });
});
