const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrateV2() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Root@123',
    multipleStatements: true,
  });

  await connection.query('USE vendor_portal');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS item_master (
      id VARCHAR(36) PRIMARY KEY,
      item_code VARCHAR(50) UNIQUE NOT NULL,
      item_description VARCHAR(500) NOT NULL,
      uom VARCHAR(50) DEFAULT 'Nos',
      category VARCHAR(255),
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_item_active (is_active)
    )
  `);

  async function addColumnIfMissing(table, columnDef, columnName) {
    try {
      await connection.query(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME') throw err;
      console.log(`  (skip) ${table}.${columnName} already exists`);
    }
  }

  await addColumnIfMissing('rfq_line_items', 'item_master_id VARCHAR(36) NULL', 'item_master_id');
  await addColumnIfMissing('rfq_line_items', 'remarks TEXT NULL', 'remarks');
  await addColumnIfMissing('rfq_line_items', 'attachment_path VARCHAR(500) NULL', 'attachment_path');
  await addColumnIfMissing('rfq_line_items', 'attachment_name VARCHAR(255) NULL', 'attachment_name');

  await addColumnIfMissing('vendor_bid_items', 'attachment_path VARCHAR(500) NULL', 'attachment_path');
  await addColumnIfMissing('vendor_bid_items', 'attachment_name VARCHAR(255) NULL', 'attachment_name');

  console.log('✅ V2 migration complete (item_master table + RFQ attachment/remarks columns)');
  await connection.end();
}

migrateV2().catch(err => {
  console.error('V2 migration failed:', err);
  process.exit(1);
});
