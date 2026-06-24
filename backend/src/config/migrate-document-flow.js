const mysql = require('mysql2/promise');
require('dotenv').config();

// Append-only ledger of every quantity hand-off between PR/RFQ/PO line items.
// Replaces the implicit "sum po_line_items.quantity" consumption math with an
// explicit record per allocation, so a PR line's remaining quantity reflects
// what's been sent to RFQ/PO immediately (not just once a PO exists) and an
// RFQ line's awardable quantity can be tracked independently. Every row is
// itself an audit entry — no separate mapping-history table needed.
async function migrateDocumentFlow() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Root@123',
    multipleStatements: true,
  });

  await connection.query('USE vendor_portal');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS document_flow_mapping (
      id VARCHAR(36) PRIMARY KEY,
      source_doc_type ENUM('PR','RFQ') NOT NULL,
      source_line_id VARCHAR(36) NOT NULL,
      target_doc_type ENUM('RFQ','PO') NOT NULL,
      target_line_id VARCHAR(36) NOT NULL,
      mapped_quantity DECIMAL(15,3) NOT NULL,
      created_by VARCHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_dfm_source (source_doc_type, source_line_id),
      INDEX idx_dfm_target (target_doc_type, target_line_id)
    )
  `);

  console.log('✅ Document flow mapping migration complete');
  await connection.end();
}

migrateDocumentFlow().catch(err => {
  console.error('Document flow mapping migration failed:', err);
  process.exit(1);
});
