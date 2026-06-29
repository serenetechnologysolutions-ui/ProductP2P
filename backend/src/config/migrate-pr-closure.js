const mysql = require('mysql2/promise');
require('dotenv').config();

// Adds manual-closure tracking to purchase_requisitions — a requisition can
// now be closed with a mandatory reason at any point before it's already
// closed/rejected (POST /pr/:id/close), distinct from the automatic closure
// that already fires once every line is fully allocated to RFQ/PO. Purely
// additive, nullable columns.
async function migratePrClosure() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Root@123',
    multipleStatements: true,
  });

  await connection.query('USE vendor_portal');

  const addColumn = async (def) => {
    try {
      await connection.query(`ALTER TABLE purchase_requisitions ADD COLUMN ${def}`);
      console.log(`  + purchase_requisitions.${def.split(' ')[0]}`);
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME') throw err;
    }
  };

  await addColumn('closure_reason TEXT NULL');
  await addColumn('closed_by VARCHAR(36) NULL');
  await addColumn('closed_at TIMESTAMP NULL');

  console.log('✅ PR closure migration complete');
  await connection.end();
}

migratePrClosure().catch(err => {
  console.error('PR closure migration failed:', err);
  process.exit(1);
});
