const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { authenticate, requireRole } = require('../auth/auth.middleware');
const { NotFoundError } = require('../../common/errors');

const router = express.Router();

// GET /api/purchase-orders (vendor sees own, admin sees all)
router.get('/', authenticate, asyncHandler(async (req, res) => {
  let sql = 'SELECT * FROM purchase_orders WHERE 1=1';
  const params = [];
  if (req.user.role === 'vendor') { sql += ' AND vendor_id = ?'; params.push(req.user.vendorId); }
  if (req.query.vendor_id) { sql += ' AND vendor_id = ?'; params.push(req.query.vendor_id); }
  sql += ' ORDER BY created_at DESC';
  const [rows] = await pool.query(sql, params);
  res.json({ success: true, data: rows });
}));

// GET /api/purchase-orders/:id
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM purchase_orders WHERE id = ?', [req.params.id]);
  if (rows.length === 0) throw new NotFoundError('PO not found');
  const [lineItems] = await pool.query('SELECT * FROM po_line_items WHERE po_id = ? ORDER BY line_number', [req.params.id]);

  // Calculate actual consumed quantity from ALL ASNs (draft, submitted, validated, posted)
  // This gives the true "available" quantity for new ASN creation
  for (const line of lineItems) {
    const [asnQty] = await pool.query(
      'SELECT COALESCE(SUM(ali.quantity), 0) as total_asn_qty FROM asn_line_items ali INNER JOIN asns a ON ali.asn_id = a.id WHERE ali.po_line_id = ? AND a.status != ?',
      [line.id, 'rejected']
    );
    line.consumed_quantity = Number(asnQty[0].total_asn_qty);
    line.available_quantity = Number(line.quantity) - line.consumed_quantity;
  }

  res.json({ success: true, data: { ...rows[0], line_items: lineItems } });
}));

// POST /api/purchase-orders (admin creates PO for testing)
router.post('/', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const { po_number, vendor_id, total_amount, line_items, buyer_name, buyer_address, gstin, state_name, state_code, po_date, terms_of_payment, validity_date } = req.body;
  const poId = uuidv4();
  await pool.query(
    'INSERT INTO purchase_orders (id, po_number, po_date, vendor_id, buyer_name, buyer_address, gstin, state_name, state_code, total_amount, terms_of_payment, validity_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [poId, po_number, po_date || null, vendor_id, buyer_name || null, buyer_address || null, gstin || null, state_name || null, state_code || null, total_amount, terms_of_payment || null, validity_date || null]
  );

  if (line_items && Array.isArray(line_items)) {
    for (let i = 0; i < line_items.length; i++) {
      const item = line_items[i];
      const lineAmount = (item.quantity || 0) * (item.unit_price || 0);
      const taxAmount = lineAmount * ((item.tax_percent || 0) / 100);
      const totalLineAmount = lineAmount + taxAmount;
      await pool.query(
        'INSERT INTO po_line_items (id, po_id, line_number, description, hsn_sac, quantity, uom, unit_price, amount, tax_percent, tax_amount, total_line_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), poId, i + 1, item.description, item.hsn_sac || null, item.quantity, item.uom || 'Nos', item.unit_price, lineAmount, item.tax_percent || 0, taxAmount, totalLineAmount]
      );
    }
  }

  res.status(201).json({ success: true, data: { id: poId, po_number } });
}));

module.exports = router;
