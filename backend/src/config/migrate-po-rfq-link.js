const mysql = require('mysql2/promise');
require('dotenv').config();

// Mirrors purchase_orders.pr_id with a direct rfq_id column, so a PO created
// by awarding an RFQ (whether or not that RFQ itself came from a PR) can be
// traced back to its source RFQ with a simple join, not a multi-hop walk
// through document_flow_mapping. Backfills existing awarded POs from the
// mapping ledger. Safe to re-run.
async function migratePoRfqLink() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Root@123',
    multipleStatements: true,
  });

  await connection.query('USE vendor_portal');

  try {
    await connection.query('ALTER TABLE purchase_orders ADD COLUMN rfq_id VARCHAR(36) NULL');
    console.log('  + purchase_orders.rfq_id');
  } catch (err) {
    if (err.code !== 'ER_DUP_FIELDNAME') throw err;
  }

  const [result] = await connection.query(`
    UPDATE purchase_orders po
    JOIN po_line_items pli ON pli.po_id = po.id
    JOIN document_flow_mapping dfm ON dfm.target_doc_type = 'PO' AND dfm.target_line_id = pli.id AND dfm.source_doc_type = 'RFQ'
    JOIN rfq_line_items rli ON rli.id = dfm.source_line_id
    SET po.rfq_id = rli.rfq_id
    WHERE po.rfq_id IS NULL
  `);
  console.log(`  + backfilled rfq_id on ${result.affectedRows} existing PO(s)`);

  console.log('✅ PO-RFQ link migration complete');
  await connection.end();
}

migratePoRfqLink().catch(err => {
  console.error('PO-RFQ link migration failed:', err);
  process.exit(1);
});
