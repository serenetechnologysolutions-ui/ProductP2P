const mysql = require('mysql2/promise');
require('dotenv').config();

// Item-Company Mapping migration — creates the item_company_mapping junction
// table to support many-to-many relationships between items and companies.
// All operations are idempotent using CREATE TABLE IF NOT EXISTS.
async function migrateItemCompanyMapping() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Root@123',
    multipleStatements: true,
  });

  await connection.query('USE vendor_portal');

  console.log('Item-Company Mapping migration starting...');

  // ─── Create item_company_mapping table ─────────────────────────────────
  console.log('\n[1/1] Creating item_company_mapping table...');
  await connection.query(`
    CREATE TABLE IF NOT EXISTS item_company_mapping (
      id VARCHAR(36) PRIMARY KEY,
      item_id VARCHAR(36) NOT NULL,
      company_id VARCHAR(36) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES item_master(id),
      FOREIGN KEY (company_id) REFERENCES company_master(id),
      UNIQUE KEY uq_item_company (item_id, company_id),
      INDEX idx_icm_item (item_id),
      INDEX idx_icm_company (company_id)
    )
  `);
  console.log('  + item_company_mapping table');

  console.log('\n✅ Item-Company Mapping migration complete');
  await connection.end();
}

migrateItemCompanyMapping().catch(err => {
  console.error('Item-Company Mapping migration failed:', err);
  process.exit(1);
});
