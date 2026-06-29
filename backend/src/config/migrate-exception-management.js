const mysql = require('mysql2/promise');
require('dotenv').config();

// Backs the new Exception Management Engine (backend/src/modules/exceptions/).
// Single central table for every detected exception type (budget breach,
// price mismatch, quantity mismatch, vendor risk) — linked generically to its
// source transaction via the same module_name/record_id pairing already used
// by `documents` and `workflow_instances`, so this introduces no new linking
// convention. Purely additive: no existing table or column is touched.
async function migrateExceptionManagement() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Root@123',
    multipleStatements: true,
  });

  await connection.query('USE vendor_portal');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS procurement_exceptions (
      id VARCHAR(36) PRIMARY KEY,
      exception_type ENUM('budget_breach','price_mismatch','quantity_mismatch','vendor_risk') NOT NULL,
      severity ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
      status ENUM('open','resolved') NOT NULL DEFAULT 'open',

      -- Generic transaction link -- same module_name/record_id pairing used by
      -- the documents and workflow_instances tables, not a new convention.
      module_name ENUM('purchase_requisition','purchase_order','asn','vendor') NOT NULL,
      record_id VARCHAR(36) NOT NULL,
      vendor_id VARCHAR(36) NULL,

      -- Shared with the Traceability Engine so every exception across one PR's
      -- entire lifecycle (PR + its RFQs/POs/ASNs) can be fetched with one
      -- indexed equality lookup. NULL for exceptions with no chain context
      -- (e.g. a vendor_risk alert isn't scoped to one transaction chain).
      transaction_chain_id VARCHAR(36) NULL,

      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      -- Type-specific detection detail (e.g. budget remaining/requested,
      -- benchmark/actual price, ordered/received quantity, risk sub-scores) —
      -- kept as JSON rather than a wide sparse column set, the same pattern
      -- already used by item_master.specification_template and
      -- rfq_line_items.technical_specifications for type-varying detail.
      metadata JSON NULL,

      -- Dedup key so repeated detection runs (e.g. nightly risk recalculation,
      -- or re-running a 3-way match) update the same open exception instead of
      -- spawning duplicates. Unique only while status = 'open' is enforced in
      -- the service layer (MySQL can't express a partial unique index cleanly
      -- pre-8.0.13 functional-key support), not at the schema level.
      dedup_key VARCHAR(150) NOT NULL,

      detected_by ENUM('system','manual') NOT NULL DEFAULT 'system',
      created_by VARCHAR(36) NULL,
      resolved_by VARCHAR(36) NULL,
      resolution_remarks TEXT NULL,
      resolved_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      INDEX idx_exc_status (status),
      INDEX idx_exc_type (exception_type),
      INDEX idx_exc_module_record (module_name, record_id),
      INDEX idx_exc_vendor (vendor_id),
      INDEX idx_exc_chain (transaction_chain_id),
      INDEX idx_exc_dedup (dedup_key)
    )
  `);
  console.log('  + procurement_exceptions table');

  console.log('✅ Exception management migration complete');
  await connection.end();
}

migrateExceptionManagement().catch(err => {
  console.error('Exception management migration failed:', err);
  process.exit(1);
});
