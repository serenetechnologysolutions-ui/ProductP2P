const { test, expect } = require('@playwright/test');
const { login, CREDENTIALS } = require('./helpers');

test.describe('Authentication', () => {
  test('rejects invalid credentials', async ({ page }) => {
    await page.goto('/login');
    // On a cold dev-server start this can be the very first navigation in the run —
    // the HTML shell loads before React finishes hydrating, so wait for a real
    // form control to be interactive rather than filling immediately after goto.
    await page.locator('button[type="submit"]').waitFor({ state: 'visible' });
    await page.fill('input#email, input[name="email"]', 'nobody@nowhere.com');
    await page.fill('input#password, input[name="password"]', 'WrongPass123');
    await page.click('button[type="submit"]');
    await expect(page.locator('.ant-alert-error, .ant-message-error')).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });

  for (const role of Object.keys(CREDENTIALS)) {
    test(`logs in successfully as ${role}`, async ({ page }) => {
      await login(page, role);
      await expect(page).not.toHaveURL(/\/login/);
      // Role badge in the header should reflect the logged-in role. Exact match —
      // a plain substring `text=` query for e.g. "SYSTEM ADMIN" also matches the
      // unrelated "System Administrator" full-name text shown right next to it.
      await expect(page.getByText(role.toUpperCase().replace('_', ' '), { exact: true })).toBeVisible({ timeout: 5000 });
    });
  }

  test('logout clears session and redirects to login', async ({ page }) => {
    await login(page, 'mdm_admin');
    await page.locator('.ant-layout-header .ant-space').click();
    await page.locator('.ant-dropdown-menu-item', { hasText: 'Logout' }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});
