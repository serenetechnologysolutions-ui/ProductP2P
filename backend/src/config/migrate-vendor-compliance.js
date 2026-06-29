const mysql = require('mysql2/promise');
require('dotenv').config();

// Backs the Vendor Compliance Engine. No new tables: compliance expiry dates
// already live in vendors.compliance_expiry_dates (a JSON label->date map),
// "blocked" already exists as a vendor.lifecycle_stage value, and the
// "configurable alert days" setting fits the existing system_settings
// key/value table exactly like pr_rfq_threshold_value etc. The only real
// schema change is widening procurement_exceptions.exception_type so
// pre-expiry/expired alerts can be tracked the same way budget/price/
// quantity/vendor-risk exceptions already are.
async function migrateVendorCompliance() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Root@123',
    multipleStatements: true,
  });

  await connection.query('USE vendor_portal');

  // Widening an ENUM by adding a value is additive and backward compatible —
  // existing rows keep their current value, nothing is renamed or removed.
  await connection.query(
    "ALTER TABLE procurement_exceptions MODIFY COLUMN exception_type ENUM('budget_breach','price_mismatch','quantity_mismatch','vendor_risk','compliance_expiry') NOT NULL"
  );
  console.log('  + procurement_exceptions.exception_type: added compliance_expiry');

  const [existing] = await connection.query(
    "SELECT id FROM system_settings WHERE setting_key = 'vendor_compliance_alert_days'"
  );
  if (existing.length === 0) {
    await connection.query(
      "INSERT INTO system_settings (id, setting_key, setting_value) VALUES (UUID(), 'vendor_compliance_alert_days', '30')"
    );
    console.log('  + system_settings.vendor_compliance_alert_days = 30 (default)');
  }

  console.log('✅ Vendor compliance migration complete');
  await connection.end();
}

migrateVendorCompliance().catch(err => {
  console.error('Vendor compliance migration failed:', err);
  process.exit(1);
});
