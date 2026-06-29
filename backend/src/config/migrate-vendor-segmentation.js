const mysql = require('mysql2/promise');
require('dotenv').config();

// Adds vendors.vendor_segment — a strategic sourcing classification
// (strategic / preferred / approved / tactical), distinct from the existing
// preferred_vendor_flag (a simple sourcing-eligibility boolean) and
// risk_category (a risk axis). New vendors default to 'approved'; admins
// elevate/demote from there via PUT /vendors/:id. Purely additive.
async function migrateVendorSegmentation() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Root@123',
    multipleStatements: true,
  });

  await connection.query('USE vendor_portal');

  try {
    await connection.query(
      "ALTER TABLE vendors ADD COLUMN vendor_segment ENUM('strategic','preferred','approved','tactical') NOT NULL DEFAULT 'approved'"
    );
    console.log('  + vendors.vendor_segment (default: approved)');
  } catch (err) {
    if (err.code !== 'ER_DUP_FIELDNAME') throw err;
  }

  try {
    await connection.query('ALTER TABLE vendors ADD INDEX idx_vendors_segment (vendor_segment)');
  } catch (err) {
    if (err.code !== 'ER_DUP_KEYNAME') throw err;
  }

  console.log('✅ Vendor segmentation migration complete');
  await connection.end();
}

migrateVendorSegmentation().catch(err => {
  console.error('Vendor segmentation migration failed:', err);
  process.exit(1);
});
