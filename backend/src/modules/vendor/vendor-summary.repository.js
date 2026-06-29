const { pool } = require('../../config/database');

// Pure data access for the Vendor 360 summary. Reads only — no new columns,
// no new tables. Everything the summary needs already exists on
// purchase_orders and asns.

async function getVendorBasic(vendorId, conn) {
  const c = conn || pool;
  const [rows] = await c.query('SELECT id, vendor_name, status FROM vendors WHERE id = ?', [vendorId]);
  return rows[0] || null;
}

async function getPoAggregatesForVendor(vendorId, conn) {
  const c = conn || pool;
  const [[row]] = await c.query(
    `SELECT
       COUNT(*) AS total_po_count,
       COALESCE(SUM(total_amount), 0) AS total_spend,
       SUM(CASE WHEN status IN ('open', 'partially_fulfilled') THEN 1 ELSE 0 END) AS active_po_count,
       MAX(created_at) AS last_po_date
     FROM purchase_orders WHERE vendor_id = ?`,
    [vendorId]
  );
  return row;
}

// Raw rows rather than a pre-aggregated query — on-time delivery needs a
// per-row fallback decision (actual_delivery_date when present, else the
// same eta-vs-created_at proxy risk.service.js already uses), which is
// clearer to express in JS than as one large CASE expression.
async function getAsnRowsForVendor(vendorId, conn) {
  const c = conn || pool;
  const [rows] = await c.query(
    'SELECT status, eta, created_at, actual_delivery_date FROM asns WHERE vendor_id = ?',
    [vendorId]
  );
  return rows;
}

module.exports = { getVendorBasic, getPoAggregatesForVendor, getAsnRowsForVendor };
