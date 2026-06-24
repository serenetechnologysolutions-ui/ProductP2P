const mysql = require('mysql2/promise');
require('dotenv').config();

// Adds: a single attachment per PR line item (mirrors rfq_line_items.attachment_path/
// attachment_name), and an overall (bid-level, not per-line) attachment for vendor
// bids. Safe to re-run.
async function migratePrEnhancements() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Root@123',
    multipleStatements: true,
  });

  await connection.query('USE vendor_portal');

  async function addColumnIfMissing(table, columnDef, columnName) {
    try {
      await connection.query(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
      console.log(`  + ${table}.${columnName}`);
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME') throw err;
    }
  }

  await addColumnIfMissing('pr_line_items', 'attachment_path VARCHAR(500) NULL', 'attachment_path');
  await addColumnIfMissing('pr_line_items', 'attachment_name VARCHAR(255) NULL', 'attachment_name');

  await addColumnIfMissing('vendor_bids', 'overall_attachment_path VARCHAR(500) NULL', 'overall_attachment_path');
  await addColumnIfMissing('vendor_bids', 'overall_attachment_name VARCHAR(255) NULL', 'overall_attachment_name');

  console.log('✅ PR enhancements migration complete');
  await connection.end();
}

migratePrEnhancements().catch(err => {
  console.error('PR enhancements migration failed:', err);
  process.exit(1);
});
