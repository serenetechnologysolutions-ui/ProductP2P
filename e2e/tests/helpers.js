const path = require('path');

const CREDENTIALS = {
  system_admin: { email: 'sysadmin@procuretrack.com', password: 'SysAdmin@123' },
  mdm_admin: { email: 'admin@vendorportal.com', password: 'Admin@123' },
  procurement_admin: { email: 'procurement@vendorportal.com', password: 'Proc@123' },
  vendor: { email: 'vendor1@tatasteel.com', password: 'Vendor@123' },
};

// Only for the auth.spec.js tests that exercise the login form itself — everywhere
// else, use authedPage() below to avoid tripping the login endpoint's rate limit.
async function login(page, role) {
  const { email, password } = CREDENTIALS[role];
  await page.goto('/login');
  await page.locator('button[type="submit"]').waitFor({ state: 'visible' });
  await page.fill('input#email, input[name="email"]', email);
  await page.fill('input#password, input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
}

function authFile(role) {
  return path.join(__dirname, '..', '.auth', `${role}.json`);
}

// Returns a page that's already logged in as `role`, via the storageState global
// setup wrote — no UI login, no hitting the rate limiter.
async function authedPage(browser, role) {
  const context = await browser.newContext({ storageState: authFile(role) });
  return context.newPage();
}

module.exports = { login, CREDENTIALS, authFile, authedPage };
