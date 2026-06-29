const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Backs PO Versioning. purchase_orders.version is the PO's current applied
// version number; amendment_status tracks whether a proposed change is
// awaiting approval (see po-versioning.service.js — propose/approve/reject).
// po_versions is the append-only change log: one row per proposed amendment,
// each carrying a JSON diff (change_log) against the version before it and a
// full snapshot of the state it would produce once approved. Every existing
// PO is seeded a baseline version 1 "approved" row so version history is
// complete from day one, not just from whenever this migration ran.
async function migratePoVersioning() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Root@123',
    multipleStatements: true,
  });

  await connection.query('USE vendor_portal');

  for (const [name, def] of [
    ['version', 'version INT NOT NULL DEFAULT 1'],
    ['amendment_status', "amendment_status ENUM('none','pending_approval') NOT NULL DEFAULT 'none'"],
  ]) {
    try {
      await connection.query(`ALTER TABLE purchase_orders ADD COLUMN ${def}`);
      console.log(`  + purchase_orders.${name}`);
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME') throw err;
    }
  }

  await connection.query(`
    CREATE TABLE IF NOT EXISTS po_versions (
      id VARCHAR(36) PRIMARY KEY,
      po_id VARCHAR(36) NOT NULL,
      version_number INT NOT NULL,
      change_log JSON NULL,
      snapshot JSON NOT NULL,
      status ENUM('pending_approval','approved','rejected') NOT NULL DEFAULT 'pending_approval',
      change_reason TEXT NULL,
      requested_by VARCHAR(36) NULL,
      requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      decided_by VARCHAR(36) NULL,
      decided_at TIMESTAMP NULL,
      decision_remarks TEXT NULL,
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
      UNIQUE KEY uq_po_version (po_id, version_number),
      INDEX idx_po_versions_po (po_id),
      INDEX idx_po_versions_status (status)
    )
  `);
  console.log('  + po_versions table');

  const [pos] = await connection.query('SELECT * FROM purchase_orders');
  let seeded = 0;
  for (const po of pos) {
    const [[{ cnt }]] = await connection.query('SELECT COUNT(*) as cnt FROM po_versions WHERE po_id = ?', [po.id]);
    if (cnt > 0) continue;
    const [lineItems] = await connection.query('SELECT * FROM po_line_items WHERE po_id = ?', [po.id]);
    await connection.query(
      `INSERT INTO po_versions (id, po_id, version_number, change_log, snapshot, status, change_reason, requested_by, decided_by, decided_at)
       VALUES (?, ?, 1, NULL, ?, 'approved', 'Baseline version recorded by migration', ?, ?, NOW())`,
      [uuidv4(), po.id, JSON.stringify({ header: po, line_items: lineItems }), po.requester_id || null, po.requester_id || null]
    );
    seeded++;
  }
  console.log(`  + seeded baseline version 1 for ${seeded} existing PO(s)`);

  console.log('✅ PO versioning migration complete');
  await connection.end();
}

migratePoVersioning().catch(err => {
  console.error('PO versioning migration failed:', err);
  process.exit(1);
});
