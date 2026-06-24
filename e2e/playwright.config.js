const { defineConfig } = require('@playwright/test');

// Runs the app on dedicated ports so this suite never collides with whatever else
// might be running on the usual 5000/3000 in this dev environment. NOTE: 5060/5061
// are Chromium's "unsafe ports" (SIP) and get silently blocked with ERR_UNSAFE_PORT
// at the browser network layer — picked 5500/3500 instead to avoid that entirely.
const BACKEND_PORT = 5500;
const FRONTEND_PORT = 3500;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false, // shared seeded DB rows — keep tests sequential to avoid cross-test interference
  workers: 1,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: require.resolve('./global-setup'),
  use: {
    baseURL: FRONTEND_URL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: `PORT=${BACKEND_PORT} CORS_ORIGINS=${FRONTEND_URL} npm run dev`,
      cwd: '../backend',
      url: `${BACKEND_URL}/api/health`,
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      command: `PORT=${FRONTEND_PORT} BROWSER=none REACT_APP_API_BASE_URL=${BACKEND_URL} npm start`,
      cwd: '../frontend',
      url: FRONTEND_URL,
      reuseExistingServer: true,
      timeout: 60000,
    },
  ],
});
