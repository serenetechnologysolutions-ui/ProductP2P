const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { ValidationError, NotFoundError, InvalidStateTransitionError, ConflictError, AuthorizationError } = require('../../common/errors');
const { authenticate, requireRole } = require('../auth/auth.middleware');

const router = express.Router();

const ASN_TRANSITIONS = {
  draft: ['submitted'],
  submitted: ['validated', 'rejected'],
  validated: ['posted'],
};

// POST /api/asns
router.post('/', authenticate, requireRole('vendor', 'procurement_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const {
    po_id, eta, invoice_number, total_amount, lr_number, transporter_name, driver_name, driver_number, remarks, line_items, vendor_id,
    shipment_mode, vehicle_number, eway_bill_number, dispatch_date, actual_delivery_date, invoice_currency, exchange_rate,
    cgst_amount, sgst_amount, igst_amount, freight_charges,
  } = req.body;

  const missing = [];
  if (!po_id) missing.push('po_id');
  if (!eta) missing.push('eta');
  if (!invoice_number) missing.push('invoice_number');
  if (!total_amount) missing.push('total_amount');
  if (!lr_number) missing.push('lr_number');
  if (!transporter_name) missing.push('transporter_name');
  if (!driver_name) missing.push('driver_name');
  if (missing.length > 0) throw new ValidationError('Missing mandatory fields', missing);

  // Validate PO belongs to vendor
  const effectiveVendorId = req.user.role === 'vendor' ? req.user.vendorId : (vendor_id || req.user.vendorId);
  const [poRows] = await pool.query('SELECT * FROM purchase_orders WHERE id = ?', [po_id]);
  if (poRows.length === 0) throw new NotFoundError('Purchase Order not found');
  if (req.user.role === 'vendor' && poRows[0].vendor_id !== req.user.vendorId) throw new NotFoundError('Purchase Order does not belong to you');

  // Check invoice number uniqueness
  const [invExists] = await pool.query('SELECT id FROM asns WHERE invoice_number = ?', [invoice_number]);
  if (invExists.length > 0) throw new ConflictError('Invoice number already exists');

  // Validate partial shipment quantities
  if (line_items && Array.isArray(line_items)) {
    for (const item of line_items) {
      const [poLine] = await pool.query('SELECT quantity FROM po_line_items WHERE id = ?', [item.po_line_id]);
      if (poLine.length > 0) {
        // Sum all existing ASN quantities for this PO line (excluding rejected)
        const [existingQty] = await pool.query(
          "SELECT COALESCE(SUM(ali.quantity), 0) as total FROM asn_line_items ali INNER JOIN asns a ON ali.asn_id = a.id WHERE ali.po_line_id = ? AND a.status != 'rejected'",
          [item.po_line_id]
        );
        const consumed = Number(existingQty[0].total);
        const available = Number(poLine[0].quantity) - consumed;
        if (item.quantity > available) {
          throw new ValidationError(`Quantity ${item.quantity} exceeds available ${available} for PO line ${item.po_line_id}`);
        }
      }
    }
  }

  const asnId = uuidv4();
  const asnNumber = 'ASN-' + Date.now().toString(36).toUpperCase();

  await pool.query(
    `INSERT INTO asns (
      id, asn_number, vendor_id, po_id, eta, invoice_number, total_amount, lr_number, transporter_name, driver_name, driver_number, remarks, status,
      shipment_mode, vehicle_number, eway_bill_number, dispatch_date, actual_delivery_date, invoice_currency, exchange_rate,
      cgst_amount, sgst_amount, igst_amount, freight_charges
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      asnId, asnNumber, effectiveVendorId || poRows[0].vendor_id, po_id, eta, invoice_number, total_amount, lr_number, transporter_name, driver_name, driver_number || null, remarks || null,
      shipment_mode || null, vehicle_number || null, eway_bill_number || null, dispatch_date || null, actual_delivery_date || null,
      invoice_currency || 'INR', exchange_rate ?? 1,
      cgst_amount ?? 0, sgst_amount ?? 0, igst_amount ?? 0, freight_charges ?? 0,
    ]
  );

  // Insert line items
  if (line_items && Array.isArray(line_items)) {
    for (let i = 0; i < line_items.length; i++) {
      const item = line_items[i];
      await pool.query(
        'INSERT INTO asn_line_items (id, asn_id, po_line_id, line_number, description, quantity, amount) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), asnId, item.po_line_id, i + 1, item.description || '', item.quantity, item.amount]
      );
    }
  }

  res.status(201).json({ success: true, data: { id: asnId, asn_number: asnNumber } });
}));

// GET /api/asns
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { status, vendor_id, po_id, page = 1, limit = 10 } = req.query;
  let sql = 'SELECT a.*, v.vendor_name, p.po_number FROM asns a LEFT JOIN vendors v ON a.vendor_id = v.id LEFT JOIN purchase_orders p ON a.po_id = p.id WHERE 1=1';
  const params = [];

  if (req.user.role === 'vendor') { sql += ' AND a.vendor_id = ?'; params.push(req.user.vendorId); }
  if (status) { sql += ' AND a.status = ?'; params.push(status); }
  if (vendor_id) { sql += ' AND a.vendor_id = ?'; params.push(vendor_id); }
  if (po_id) { sql += ' AND a.po_id = ?'; params.push(po_id); }

  const countSql = sql.replace('SELECT a.*, v.vendor_name, p.po_number', 'SELECT COUNT(*) as total');
  const [countRows] = await pool.query(countSql, params);
  const total = countRows[0].total;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  sql += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);
  const [rows] = await pool.query(sql, params);

  res.json({ success: true, data: rows, pagination: { current: parseInt(page), pageSize: parseInt(limit), total } });
}));

// GET /api/asns/:id
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [rows] = await pool.query('SELECT a.*, v.vendor_name, p.po_number FROM asns a LEFT JOIN vendors v ON a.vendor_id = v.id LEFT JOIN purchase_orders p ON a.po_id = p.id WHERE a.id = ?', [id]);
  if (rows.length === 0) throw new NotFoundError('ASN not found');
  if (req.user.role === 'vendor' && rows[0].vendor_id !== req.user.vendorId) throw new AuthorizationError();

  const [lineItems] = await pool.query('SELECT ali.*, pli.description as po_description, pli.quantity as po_quantity FROM asn_line_items ali LEFT JOIN po_line_items pli ON ali.po_line_id = pli.id WHERE ali.asn_id = ?', [id]);

  res.json({ success: true, data: { ...rows[0], line_items: lineItems } });
}));

// PUT /api/asns/:id/three-way-match — set 3-way match result (PO vs ASN vs Invoice), done at validation time, not creation
router.put('/:id/three-way-match', authenticate, requireRole('procurement_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { three_way_match_status, discrepancy_flag, discrepancy_reason } = req.body;

  const validStatuses = ['matched', 'mismatched', 'pending'];
  if (!three_way_match_status || !validStatuses.includes(three_way_match_status)) {
    throw new ValidationError('three_way_match_status must be one of: matched, mismatched, pending', ['three_way_match_status']);
  }

  const [rows] = await pool.query('SELECT id FROM asns WHERE id = ?', [id]);
  if (rows.length === 0) throw new NotFoundError('ASN not found');

  await pool.query(
    'UPDATE asns SET three_way_match_status = ?, discrepancy_flag = ?, discrepancy_reason = ? WHERE id = ?',
    [three_way_match_status, !!discrepancy_flag, discrepancy_reason || null, id]
  );

  res.json({ success: true, message: 'Three-way match status updated' });
}));

// POST /api/asns/:id/submit
router.post('/:id/submit', authenticate, requireRole('vendor'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [rows] = await pool.query('SELECT status, vendor_id FROM asns WHERE id = ?', [id]);
  if (rows.length === 0) throw new NotFoundError('ASN not found');
  if (rows[0].vendor_id !== req.user.vendorId) throw new AuthorizationError();
  if (!ASN_TRANSITIONS[rows[0].status]?.includes('submitted')) throw new InvalidStateTransitionError(rows[0].status, 'submitted');
  await pool.query('UPDATE asns SET status = ? WHERE id = ?', ['submitted', id]);
  res.json({ success: true, message: 'ASN submitted' });
}));

// POST /api/asns/:id/validate
router.post('/:id/validate', authenticate, requireRole('procurement_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [rows] = await pool.query('SELECT status FROM asns WHERE id = ?', [id]);
  if (rows.length === 0) throw new NotFoundError('ASN not found');
  if (!ASN_TRANSITIONS[rows[0].status]?.includes('validated')) throw new InvalidStateTransitionError(rows[0].status, 'validated');
  await pool.query('UPDATE asns SET status = ? WHERE id = ?', ['validated', id]);
  res.json({ success: true, message: 'ASN validated' });
}));

// POST /api/asns/:id/reject
router.post('/:id/reject', authenticate, requireRole('procurement_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [rows] = await pool.query('SELECT status FROM asns WHERE id = ?', [id]);
  if (rows.length === 0) throw new NotFoundError('ASN not found');
  if (!ASN_TRANSITIONS[rows[0].status]?.includes('rejected')) throw new InvalidStateTransitionError(rows[0].status, 'rejected');
  await pool.query('UPDATE asns SET status = ? WHERE id = ?', ['rejected', id]);
  res.json({ success: true, message: 'ASN rejected' });
}));

// POST /api/asns/:id/post — Post to ERP (mock)
router.post('/:id/post', authenticate, requireRole('procurement_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [rows] = await pool.query('SELECT status FROM asns WHERE id = ?', [id]);
  if (rows.length === 0) throw new NotFoundError('ASN not found');
  if (!ASN_TRANSITIONS[rows[0].status]?.includes('posted')) throw new InvalidStateTransitionError(rows[0].status, 'posted');

  // Mock ERP posting
  await pool.query('UPDATE asns SET status = ?, erp_posting_status = ?, erp_posting_message = ? WHERE id = ?', ['posted', 'posted', 'Successfully Posted', id]);

  // Update PO line fulfilled quantities
  const [lineItems] = await pool.query('SELECT po_line_id, quantity FROM asn_line_items WHERE asn_id = ?', [id]);
  for (const item of lineItems) {
    await pool.query('UPDATE po_line_items SET fulfilled_quantity = fulfilled_quantity + ? WHERE id = ?', [item.quantity, item.po_line_id]);
  }

  res.json({ success: true, message: 'Successfully Posted to ERP' });
}));

module.exports = router;
