const mysql = require('mysql2/promise');
require('dotenv').config();

// Encodes a lifecycle stage (experimental/beta/stable) into the 3 flags
// migrate-feature-flags.js already seeded — appending ":beta" to their
// existing 'true' value (see common/featureFlags.js's parseValue). All three
// graduated from an internal experiment to "live, still being watched" this
// session, so 'beta' is accurate; only flips bare 'true' rows (idempotent —
// a flag already carrying a lifecycle, or since flipped to 'stable' by an
// admin, is left untouched).
async function migrateFeatureFlagLifecycle() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Root@123',
    multipleStatements: true,
  });

  await connection.query('USE vendor_portal');

  for (const key of ['smart_assistant_enabled', 'vendor_portal_v2_enabled', 'ui_improvements_enabled']) {
    const [rows] = await connection.query('SELECT setting_value FROM system_settings WHERE setting_key = ?', [key]);
    if (rows.length > 0 && rows[0].setting_value === 'true') {
      await connection.query('UPDATE system_settings SET setting_value = ? WHERE setting_key = ?', ['true:beta', key]);
      console.log(`  + system_settings.${key} = 'true:beta'`);
    }
  }

  console.log('✅ Feature flag lifecycle migration complete');
  await connection.end();
}

migrateFeatureFlagLifecycle().catch(err => {
  console.error('Feature flag lifecycle migration failed:', err);
  process.exit(1);
});
