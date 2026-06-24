const mysql = require('mysql2/promise');
require('dotenv').config();

// Widens a handful of reference-data columns from a fixed ENUM to VARCHAR so
// they can be driven by admin-editable sub_masters categories instead of a
// hardcoded frontend list — an admin adding a new currency/incoterm/priority
// value via the Sub Masters page must be able to actually save it. These
// columns are never compared with `===` in backend business logic (verified:
// only ever stored/filtered/joined), unlike status/sourcing_strategy enums,
// which deliberately stay as hardcoded ENUMs. Safe to re-run.
async function migrateDropdownSubMasters() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Root@123',
    multipleStatements: true,
  });

  await connection.query('USE vendor_portal');

  await connection.query("ALTER TABLE purchase_requisitions MODIFY COLUMN document_type VARCHAR(50) DEFAULT 'Standard'");
  await connection.query("ALTER TABLE purchase_requisitions MODIFY COLUMN priority VARCHAR(20) DEFAULT 'Medium'");
  await connection.query("ALTER TABLE purchase_requisitions MODIFY COLUMN account_assignment_category VARCHAR(50) DEFAULT 'Cost Center'");
  await connection.query("ALTER TABLE rfqs MODIFY COLUMN rfq_type VARCHAR(20) DEFAULT 'Limited'");
  await connection.query("ALTER TABLE asns MODIFY COLUMN shipment_mode VARCHAR(20) NULL");

  console.log('✅ Dropdown sub-master column widening complete');
  await connection.end();
}

migrateDropdownSubMasters().catch(err => {
  console.error('Dropdown sub-master migration failed:', err);
  process.exit(1);
});
