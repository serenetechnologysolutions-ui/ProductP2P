const mysql = require('mysql2/promise');
require('dotenv').config();

// Backs the new Traceability Engine (backend/src/modules/traceability/).
// Adds transaction_chain_id to the four documents in the sourcing/fulfillment
// chain — purchase_requisitions, rfqs, purchase_orders, asns — so every
// document born from the same originating requisition (or, for documents
// created standalone with no PR, born from whichever document started that
// particular chain) shares one fast, indexed lookup key. This *complements*
// the existing FK chain (rfqs.pr_id, purchase_orders.pr_id/rfq_id,
// asns.po_id) and the document_flow_mapping ledger — it does not replace
// either; getFullTraceability() still uses both for line-level detail.
//
// Convention: a document's transaction_chain_id is its own id if it's the
// root of its chain (a PR is always a root; an RFQ or PO created standalone
// with no PR/RFQ behind it is also a root), otherwise it's inherited from
// whichever document it was created from. New rows get this set at insert
// time going forward (pr.routes.js, rfq.routes.js, po.routes.js, asn.routes.js);
// this migration only backfills what already exists.
async function migrateTraceability() {
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

  async function addIndexIfMissing(table, indexDef) {
    try {
      await connection.query(`ALTER TABLE ${table} ADD ${indexDef}`);
    } catch (err) {
      if (err.code !== 'ER_DUP_KEYNAME') throw err;
    }
  }

  for (const table of ['purchase_requisitions', 'rfqs', 'purchase_orders', 'asns']) {
    await addColumnIfMissing(table, 'transaction_chain_id VARCHAR(36) NULL', 'transaction_chain_id');
    await addIndexIfMissing(table, `INDEX idx_${table}_chain (transaction_chain_id)`);
  }

  // Backfill, strictly in dependency order: PR (root) -> RFQ -> PO -> ASN.

  const [prResult] = await connection.query(
    'UPDATE purchase_requisitions SET transaction_chain_id = id WHERE transaction_chain_id IS NULL'
  );
  console.log(`  + backfilled transaction_chain_id on ${prResult.affectedRows} requisition(s)`);

  const [rfqResult] = await connection.query(`
    UPDATE rfqs r
    LEFT JOIN purchase_requisitions pr ON r.pr_id = pr.id
    SET r.transaction_chain_id = COALESCE(pr.transaction_chain_id, r.id)
    WHERE r.transaction_chain_id IS NULL
  `);
  console.log(`  + backfilled transaction_chain_id on ${rfqResult.affectedRows} RFQ(s)`);

  const [poResult] = await connection.query(`
    UPDATE purchase_orders po
    LEFT JOIN purchase_requisitions pr ON po.pr_id = pr.id
    LEFT JOIN rfqs r ON po.rfq_id = r.id
    SET po.transaction_chain_id = COALESCE(pr.transaction_chain_id, r.transaction_chain_id, po.id)
    WHERE po.transaction_chain_id IS NULL
  `);
  console.log(`  + backfilled transaction_chain_id on ${poResult.affectedRows} PO(s)`);

  const [asnResult] = await connection.query(`
    UPDATE asns a
    JOIN purchase_orders po ON a.po_id = po.id
    SET a.transaction_chain_id = po.transaction_chain_id
    WHERE a.transaction_chain_id IS NULL
  `);
  console.log(`  + backfilled transaction_chain_id on ${asnResult.affectedRows} ASN(s)`);

  console.log('✅ Traceability migration complete');
  await connection.end();
}

migrateTraceability().catch(err => {
  console.error('Traceability migration failed:', err);
  process.exit(1);
});
