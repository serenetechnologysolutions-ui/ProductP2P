const { test, expect } = require('@playwright/test');
const { authedPage, CREDENTIALS } = require('./helpers');

// Smoke test: each role's dashboard should render without throwing (would show the
// new ErrorBoundary fallback instead of real content if a render error occurred).
test.describe('Dashboards render per role', () => {
  for (const role of Object.keys(CREDENTIALS)) {
    test(`${role} dashboard renders without error`, async ({ browser }) => {
      const page = await authedPage(browser, role);
      await page.goto('/');
      await expect(page).toHaveURL('/');
      await expect(page.locator('text=Something went wrong')).toHaveCount(0);
    });
  }
});
