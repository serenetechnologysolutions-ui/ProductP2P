const mysql = require('mysql2/promise');
require('dotenv').config();

// Multi-Company Isolation migration — enriches company_master with statutory
// fields (CIN, PAN, certificate, address components), creates the
// vendor_company_mapping junction table, and adds company_id to sub_masters
// and warehouses for company-scoped filtering. All operations are idempotent.
async function migrateMultiCompanyIsolation() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Root@123',
    multipleStatements: true,
  });

  await connection.query('USE vendor_portal');

  // Helper: add column idempotently (swallows ER_DUP_FIELDNAME)
  const addColumn = async (table, def) => {
    try {
      await connection.query(`ALTER TABLE ${table} ADD COLUMN ${def}`);
      console.log(`  + ${table}.${def.split(' ')[0]}`);
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME') throw err;
      console.log(`  ~ ${table}.${def.split(' ')[0]} (already exists)`);
    }
  };

  // Helper: add index idempotently (swallows ER_DUP_KEYNAME)
  const addIndex = async (table, indexName, columnDef) => {
    try {
      await connection.query(`ALTER TABLE ${table} ADD INDEX ${indexName} (${columnDef})`);
      console.log(`  + index ${indexName} on ${table}`);
    } catch (err) {
      if (err.code !== 'ER_DUP_KEYNAME') throw err;
      console.log(`  ~ index ${indexName} on ${table} (already exists)`);
    }
  };

  console.log('Multi-Company Isolation migration starting...');

  // ─── 1. Enrich company_master with statutory fields ────────────────────
  console.log('\n[1/4] Enriching company_master...');
  await addColumn('company_master', 'cin VARCHAR(21) NULL');
  await addColumn('company_master', 'pan VARCHAR(10) NULL');
  await addColumn('company_master', 'certificate_path VARCHAR(500) NULL');
  await addColumn('company_master', 'city VARCHAR(100) NULL');
  await addColumn('company_master', 'state VARCHAR(100) NULL');
  await addColumn('company_master', 'pin_code VARCHAR(6) NULL');

  // ─── 2. Create vendor_company_mapping table ────────────────────────────
  console.log('\n[2/4] Creating vendor_company_mapping table...');
  await connection.query(`
    CREATE TABLE IF NOT EXISTS vendor_company_mapping (
      id VARCHAR(36) PRIMARY KEY,
      vendor_id VARCHAR(36) NOT NULL,
      company_id VARCHAR(36) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id),
      FOREIGN KEY (company_id) REFERENCES company_master(id),
      UNIQUE KEY uq_vendor_company (vendor_id, company_id),
      INDEX idx_vcm_vendor (vendor_id),
      INDEX idx_vcm_company (company_id)
    )
  `);
  console.log('  + vendor_company_mapping table');

  // ─── 3. Add company_id to sub_masters ──────────────────────────────────
  console.log('\n[3/4] Adding company_id to sub_masters...');
  await addColumn('sub_masters', 'company_id VARCHAR(36) NULL');
  await addIndex('sub_masters', 'idx_sub_masters_company', 'company_id');

  // ─── 4. Add company_id to warehouses ───────────────────────────────────
  console.log('\n[4/4] Adding company_id to warehouses...');
  await addColumn('warehouses', 'company_id VARCHAR(36) NULL');
  await addIndex('warehouses', 'idx_warehouses_company', 'company_id');

  console.log('\n✅ Multi-Company Isolation migration complete');
  await connection.end();
}

migrateMultiCompanyIsolation().catch(err => {
  console.error('Multi-Company Isolation migration failed:', err);
  process.exit(1);
});
