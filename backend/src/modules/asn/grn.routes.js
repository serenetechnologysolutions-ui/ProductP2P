const express = require('express');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { authenticate, requireRole } = require('../auth/auth.middleware');
const { resolveCompanyAccess } = require('../company/company.middleware');
const { getGrnByAsnId } = require('./grn.service');
const { NotFoundError } = require('../../common/errors');

const router = express.Router();

// GET /api/grn — List all GRNs with ASN/PO/vendor details
router.get('/', authenticate, requireRole('procurement_admin', 'mdm_admin', 'system_admin'), resolveCompanyAccess, asyncHandler(async (req, res) => {
  let sql = `SELECT g.*, a.asn_number, p.po_number, v.vendor_name
             FROM goods_receipt_notes g
             LEFT JOIN asns a ON g.asn_id = a.id
             LEFT JOIN purchase_orders p ON g.po_id = p.id
             LEFT JOIN vendors v ON g.vendor_id = v.id
             WHERE 1=1`;
  const params = [];

  // Company isolation
  if (req.companyIds !== null && Array.isArray(req.companyIds)) {
    if (req.companyIds.length === 0) return res.json({ success: true, data: [] });
    sql += ` AND (a.company_id IN (${req.companyIds.map(() => '?').join(',')}) OR a.company_id IS NULL)`;
    params.push(...req.companyIds);
  }

  sql += ' ORDER BY g.created_at DESC';
  const [rows] = await pool.query(sql, params);
  res.json({ success: true, data: rows });
}));

// GET /api/grn/:id — GRN detail with line items
router.get('/:id', authenticate, requireRole('procurement_admin', 'mdm_admin', 'system_admin'), asyncHandler(async (req, res) => {
  const [[grn]] = await pool.query(
    `SELECT g.*, a.asn_number, p.po_number, v.vendor_name
     FROM goods_receipt_notes g
     LEFT JOIN asns a ON g.asn_id = a.id
     LEFT JOIN purchase_orders p ON g.po_id = p.id
     LEFT JOIN vendors v ON g.vendor_id = v.id
     WHERE g.id = ?`, [req.params.id]
  );
  if (!grn) throw new NotFoundError('GRN not found');
  const [lineItems] = await pool.query(
    `SELECT gli.*, ali.description FROM grn_line_items gli
     LEFT JOIN asn_line_items ali ON gli.asn_line_item_id = ali.id
     WHERE gli.grn_id = ?`, [grn.id]
  );
  res.json({ success: true, data: { ...grn, line_items: lineItems } });
}));

module.exports = router;
