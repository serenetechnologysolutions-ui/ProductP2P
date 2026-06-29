const mysql = require('mysql2/promise');
require('dotenv').config();

// Seeds the toggle keys for three additive, isolated feature sets (Smart
// Procurement Assistant, Vendor Portal 2.0, UI/UX consistency fixes) into the
// EXISTING system_settings table — no new table, no schema change. Each key
// is read at runtime via GET /api/system/settings/:key (already open to any
// authenticated role) so both backend routes and the frontend can gate on it
// without a dedicated feature-flag API. Defaults to 'true' (on) so the new
// capabilities are visible immediately; an admin can flip any of them off via
// the existing PUT /api/system/settings without code changes.
async function migrateFeatureFlags() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Root@123',
    multipleStatements: true,
  });

  await connection.query('USE vendor_portal');

  for (const [key, value] of [
    ['smart_assistant_enabled', 'true'],
    ['vendor_portal_v2_enabled', 'true'],
    ['ui_improvements_enabled', 'true'],
  ]) {
    const [existing] = await connection.query('SELECT id FROM system_settings WHERE setting_key = ?', [key]);
    if (existing.length === 0) {
      await connection.query('INSERT INTO system_settings (id, setting_key, setting_value) VALUES (UUID(), ?, ?)', [key, value]);
      console.log(`  + system_settings.${key} = '${value}' (default)`);
    }
  }

  console.log('✅ Feature flags migration complete');
  await connection.end();
}

migrateFeatureFlags().catch(err => {
  console.error('Feature flags migration failed:', err);
  process.exit(1);
});
