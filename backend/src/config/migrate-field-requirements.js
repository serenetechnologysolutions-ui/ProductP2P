const mysql = require('mysql2/promise');
require('dotenv').config();

// Creates the field_requirements table backing the System Admin "Field Settings"
// page — lets an admin flip any registered form field between mandatory/optional.
// Safe to re-run against a database that already has it.
async function migrateFieldRequirements() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Root@123',
    multipleStatements: true,
  });

  await connection.query('USE vendor_portal');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS field_requirements (
      id VARCHAR(36) PRIMARY KEY,
      module_key VARCHAR(50) NOT NULL,
      field_key VARCHAR(100) NOT NULL,
      field_label VARCHAR(150) NOT NULL,
      section VARCHAR(100),
      is_mandatory BOOLEAN NOT NULL DEFAULT FALSE,
      display_order INT DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_module_field (module_key, field_key)
    )
  `);

  console.log('✅ field_requirements table ready');
  await connection.end();
}

migrateFieldRequirements().catch(err => { console.error('field_requirements migration failed:', err); process.exit(1); });
