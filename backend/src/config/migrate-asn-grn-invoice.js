const mysql = require('mysql2/promise');
require('dotenv').config();

// Refactors the ASN module by splitting the two concepts it has always
// conflated — the shipment notice (ASN itself, unchanged: LR/transporter
// info, ETA) and the financial/receiving documents that follow it — into
// their own formal records: goods_receipt_notes (what was physically
// received & inspected) and invoices (what's being billed, 3-way-matched
// against the PO and GRN). asns/asn_line_items are NOT modified or replaced —
// this is additive, and the existing ASN endpoints keep working exactly as
// before. Known limitation: existing ASNs already 'posted' under the old
// flow have no GRN/Invoice record — backfilling one would fabricate
// inspection/billing data that was never actually captured, so this only
// applies going forward (same reasoning as the Budget Commitment Model's
// non-backfill of historical committed/actual amounts).
async function migrateAsnGrnInvoice() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Root@123',
    multipleStatements: true,
  });

  await connection.query('USE vendor_portal');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS goods_receipt_notes (
      id VARCHAR(36) PRIMARY KEY,
      grn_number VARCHAR(50) UNIQUE NOT NULL,
      asn_id VARCHAR(36) NOT NULL,
      po_id VARCHAR(36) NOT NULL,
      vendor_id VARCHAR(36) NOT NULL,
      received_date DATE NOT NULL,
      received_by VARCHAR(36) NULL,
      status ENUM('draft','completed','exception') NOT NULL DEFAULT 'draft',
      remarks TEXT NULL,
      transaction_chain_id VARCHAR(36) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (asn_id) REFERENCES asns(id),
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id),
      FOREIGN KEY (vendor_id) REFERENCES vendors(id),
      INDEX idx_grn_asn (asn_id),
      INDEX idx_grn_status (status)
    )
  `);
  console.log('  + goods_receipt_notes table');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS grn_line_items (
      id VARCHAR(36) PRIMARY KEY,
      grn_id VARCHAR(36) NOT NULL,
      asn_line_item_id VARCHAR(36) NOT NULL,
      po_line_id VARCHAR(36) NOT NULL,
      ordered_quantity DECIMAL(15,3) NOT NULL,
      shipped_quantity DECIMAL(15,3) NOT NULL,
      received_quantity DECIMAL(15,3) NOT NULL,
      accepted_quantity DECIMAL(15,3) NOT NULL,
      rejected_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
      rejection_reason TEXT NULL,
      tolerance_status ENUM('within_tolerance','exceeds_tolerance') NOT NULL DEFAULT 'within_tolerance',
      FOREIGN KEY (grn_id) REFERENCES goods_receipt_notes(id) ON DELETE CASCADE,
      FOREIGN KEY (asn_line_item_id) REFERENCES asn_line_items(id),
      FOREIGN KEY (po_line_id) REFERENCES po_line_items(id)
    )
  `);
  console.log('  + grn_line_items table');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id VARCHAR(36) PRIMARY KEY,
      invoice_number VARCHAR(100) NOT NULL,
      asn_id VARCHAR(36) NOT NULL,
      grn_id VARCHAR(36) NULL,
      po_id VARCHAR(36) NOT NULL,
      vendor_id VARCHAR(36) NOT NULL,
      invoice_date DATE NULL,
      currency VARCHAR(3) DEFAULT 'INR',
      exchange_rate DECIMAL(10,4) DEFAULT 1,
      subtotal_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
      cgst_amount DECIMAL(15,2) DEFAULT 0,
      sgst_amount DECIMAL(15,2) DEFAULT 0,
      igst_amount DECIMAL(15,2) DEFAULT 0,
      freight_charges DECIMAL(15,2) DEFAULT 0,
      total_amount DECIMAL(15,2) NOT NULL,
      match_status ENUM('pending','matched','blocked') NOT NULL DEFAULT 'pending',
      blocked_reason TEXT NULL,
      transaction_chain_id VARCHAR(36) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_invoice_asn (asn_id),
      FOREIGN KEY (asn_id) REFERENCES asns(id),
      FOREIGN KEY (grn_id) REFERENCES goods_receipt_notes(id),
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id),
      FOREIGN KEY (vendor_id) REFERENCES vendors(id),
      INDEX idx_invoice_match_status (match_status)
    )
  `);
  console.log('  + invoices table');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS invoice_line_items (
      id VARCHAR(36) PRIMARY KEY,
      invoice_id VARCHAR(36) NOT NULL,
      asn_line_item_id VARCHAR(36) NOT NULL,
      po_line_id VARCHAR(36) NOT NULL,
      quantity DECIMAL(15,3) NOT NULL,
      unit_price DECIMAL(15,2) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      price_deviation_pct DECIMAL(6,2) NULL,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (asn_line_item_id) REFERENCES asn_line_items(id),
      FOREIGN KEY (po_line_id) REFERENCES po_line_items(id)
    )
  `);
  console.log('  + invoice_line_items table');

  // Widening an ENUM by adding values is additive and backward compatible.
  await connection.query(
    "ALTER TABLE procurement_exceptions MODIFY COLUMN exception_type ENUM('budget_breach','price_mismatch','quantity_mismatch','vendor_risk','compliance_expiry','grn_tolerance_breach','invoice_mismatch') NOT NULL"
  );
  console.log("  + procurement_exceptions.exception_type: added grn_tolerance_breach, invoice_mismatch");

  for (const [key, value] of [
    ['grn_quantity_tolerance_pct', '5'],
    ['invoice_price_tolerance_pct', '2'],
    ['asn_require_grn_invoice_match', 'true'],
  ]) {
    const [existing] = await connection.query('SELECT id FROM system_settings WHERE setting_key = ?', [key]);
    if (existing.length === 0) {
      await connection.query('INSERT INTO system_settings (id, setting_key, setting_value) VALUES (UUID(), ?, ?)', [key, value]);
      console.log(`  + system_settings.${key} = '${value}' (default)`);
    }
  }

  console.log('✅ ASN GRN/Invoice split migration complete');
  await connection.end();
}

migrateAsnGrnInvoice().catch(err => {
  console.error('ASN GRN/Invoice split migration failed:', err);
  process.exit(1);
});
