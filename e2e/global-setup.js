const { request } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { CREDENTIALS } = require('./tests/helpers');

// Logs in once per role via the API (not the UI) and saves a storageState file per
// role. Specs load these instead of submitting the login form themselves — with
// ~25 tests across the suite, everyone re-logging in through the UI blew straight
// through the login endpoint's rate limit (10/min/IP) and made runs flaky.
module.exports = async function globalSetup(config) {
  const { baseURL } = config.projects[0].use;
  const backendURL = process.env.E2E_BACKEND_URL || 'http://localhost:5500';
  const authDir = path.join(__dirname, '.auth');
  fs.mkdirSync(authDir, { recursive: true });

  const ctx = await request.newContext();
  for (const [role, { email, password }] of Object.entries(CREDENTIALS)) {
    const res = await ctx.post(`${backendURL}/api/auth/login`, { data: { email, password } });
    const body = await res.json();
    if (!body.token) throw new Error(`Global setup login failed for ${role}: ${JSON.stringify(body)}`);

    const storageState = {
      cookies: [],
      origins: [{
        origin: baseURL,
        localStorage: [
          { name: 'vendor_token', value: body.token },
          { name: 'vendor_user', value: JSON.stringify(body.user) },
        ],
      }],
    };
    fs.writeFileSync(path.join(authDir, `${role}.json`), JSON.stringify(storageState));
  }
  await ctx.dispose();
};
