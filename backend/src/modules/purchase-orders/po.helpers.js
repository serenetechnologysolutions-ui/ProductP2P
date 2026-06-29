const { pool } = require('../../config/database');

// Rolls up each PO line's fulfilled_quantity against its ordered quantity to
// derive the PO's overall status. Driven by GRN receipt (see asn/grn.service.js);
// 'closed' is intentionally never set here — it's a separate, currently-manual
// lifecycle stage tied to invoicing/payment, not receipt, so this never
// transitions a PO out of 'closed' once it's been set there by something else.
async function recomputePoFulfillmentStatus(poId, conn) {
  const c = conn || pool;
  const [lines] = await c.query('SELECT quantity, fulfilled_quantity FROM po_line_items WHERE po_id = ?', [poId]);
  if (lines.length === 0) return;

  const allFulfilled = lines.every(l => Number(l.fulfilled_quantity || 0) >= Number(l.quantity));
  const anyFulfilled = lines.some(l => Number(l.fulfilled_quantity || 0) > 0);
  const status = allFulfilled ? 'fulfilled' : anyFulfilled ? 'partially_fulfilled' : 'open';

  await c.query("UPDATE purchase_orders SET status = ? WHERE id = ? AND status != 'closed'", [status, poId]);
}

module.exports = { recomputePoFulfillmentStatus };
