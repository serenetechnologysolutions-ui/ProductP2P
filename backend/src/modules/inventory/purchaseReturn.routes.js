const express = require('express');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { authenticate, requireRole } = require('../auth/auth.middleware');
const { withTransaction } = require('../../common/db');
const {
  createPurchaseReturn,
  confirmPurchaseReturn,
  getPurchaseReturns,
  getPurchaseReturnById,
} = require('./purchaseReturn.service');

const router = express.Router();

const PR_ROLES = ['procurement_admin', 'system_admin', 'mdm_admin'];

// GET /api/inventory/purchase-returns — list with query filters
router.get('/', authenticate, requireRole(...PR_ROLES), asyncHandler(async (req, res) => {
  const { status, vendor_id, date_from, date_to } = req.query;
  const filters = {};
  if (status) filters.status = status;
  if (vendor_id) filters.vendor_id = vendor_id;
  if (date_from) filters.date_from = date_from;
  if (date_to) filters.date_to = date_to;

  const returns = await getPurchaseReturns(filters);
  res.json({ success: true, data: returns });
}));

// GET /api/inventory/purchase-returns/eligible-batches — batches eligible for return
// Must be BEFORE /:id route to avoid matching "eligible-batches" as an id param
router.get('/eligible-batches', authenticate, requireRole(...PR_ROLES), asyncHandler(async (req, res) => {
  const { vendor_id, grn_date_from, grn_date_to, batch_number } = req.query;

  let query = `
    SELECT ib.id AS batch_id, ib.batch_number, ib.item_master_id, ib.grn_id,
           ib.location_id, ib.qty_available, ib.rate, ib.discount_percentage,
           ib.tax_percentage, ib.status, ib.created_at,
           im.item_code, im.item_description AS item_name,
           w.warehouse_name AS location_name,
           grn.grn_number, grn.received_date AS grn_date
    FROM inventory_batches ib
    LEFT JOIN item_master im ON ib.item_master_id = im.id
    LEFT JOIN warehouses w ON ib.location_id = w.id
    LEFT JOIN goods_receipt_notes grn ON ib.grn_id = grn.id
    WHERE ib.status = 'active' AND ib.qty_available > 0
  `;
  const params = [];

  // Filter by vendor through GRN → ASN → vendor chain
  if (vendor_id) {
    query += ` AND grn.id IN (
      SELECT g.id FROM goods_receipt_notes g
      JOIN advance_shipping_notices asn ON g.asn_id = asn.id
      WHERE asn.vendor_id = ?
    )`;
    params.push(vendor_id);
  }

  // Filter by GRN date range
  if (grn_date_from) {
    query += ' AND grn.received_date >= ?';
    params.push(grn_date_from);
  }
  if (grn_date_to) {
    query += ' AND grn.received_date <= ?';
    params.push(grn_date_to);
  }

  // Filter by batch number (partial match)
  if (batch_number) {
    query += ' AND ib.batch_number LIKE ?';
    params.push(`%${batch_number}%`);
  }

  query += ' ORDER BY ib.created_at DESC';

  const [rows] = await pool.query(query, params);
  res.json({ success: true, data: rows });
}));

// GET /api/inventory/purchase-returns/:id — get single return with lines
router.get('/:id', authenticate, requireRole(...PR_ROLES), asyncHandler(async (req, res) => {
  const result = await getPurchaseReturnById(req.params.id);
  res.json({ success: true, data: result });
}));

// POST /api/inventory/purchase-returns — create draft return
router.post('/', authenticate, requireRole(...PR_ROLES), asyncHandler(async (req, res) => {
  const result = await withTransaction(async (conn) => {
    return createPurchaseReturn(req.body, req.user.id, conn);
  });
  res.status(201).json({ success: true, data: result });
}));

// PUT /api/inventory/purchase-returns/:id — update draft return (not implemented yet)
router.put('/:id', authenticate, requireRole(...PR_ROLES), asyncHandler(async (req, res) => {
  res.status(501).json({ success: false, error: 'Not implemented' });
}));

// POST /api/inventory/purchase-returns/:id/confirm — confirm return (triggers inventory adjustments)
router.post('/:id/confirm', authenticate, requireRole(...PR_ROLES), asyncHandler(async (req, res) => {
  const result = await withTransaction(async (conn) => {
    return confirmPurchaseReturn(req.params.id, req.user.id, conn);
  });
  res.json({ success: true, data: result });
}));

module.exports = router;
