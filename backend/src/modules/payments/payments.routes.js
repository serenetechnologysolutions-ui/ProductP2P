const express = require('express');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { authenticate, requireRole } = require('../auth/auth.middleware');
const {
  registerPaymentEventSubscribers, markOverdueSchedules, runPayments, reconcilePayment, recomputeCashflowProjection,
} = require('./payments.service');

const router = express.Router();

registerPaymentEventSubscribers();

const INTERNAL_ROLES = ['procurement_admin', 'mdm_admin', 'system_admin'];

// GET /api/payments/schedule — payment due list, with aging.
router.get('/schedule', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  await markOverdueSchedules();
  const { status, vendor_id } = req.query;
  let sql = `SELECT ps.*, v.vendor_name, i.invoice_number,
                    DATEDIFF(CURDATE(), ps.due_date) as days_overdue
             FROM payment_schedule ps
             LEFT JOIN vendors v ON ps.vendor_id = v.id
             LEFT JOIN invoices i ON ps.invoice_id = i.id WHERE 1=1`;
  const params = [];
  if (status) { sql += ' AND ps.status = ?'; params.push(status); }
  if (vendor_id) { sql += ' AND ps.vendor_id = ?'; params.push(vendor_id); }
  sql += ' ORDER BY ps.due_date ASC';
  const [rows] = await pool.query(sql, params);
  res.json({ success: true, data: rows });
}));

// GET /api/payments/aging — overdue amounts bucketed by days-overdue, per vendor.
router.get('/aging', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  await markOverdueSchedules();
  const [rows] = await pool.query(
    `SELECT v.id as vendor_id, v.vendor_name,
            SUM(CASE WHEN DATEDIFF(CURDATE(), ps.due_date) BETWEEN 0 AND 30 THEN ps.scheduled_amount - ps.paid_amount ELSE 0 END) as bucket_0_30,
            SUM(CASE WHEN DATEDIFF(CURDATE(), ps.due_date) BETWEEN 31 AND 60 THEN ps.scheduled_amount - ps.paid_amount ELSE 0 END) as bucket_31_60,
            SUM(CASE WHEN DATEDIFF(CURDATE(), ps.due_date) BETWEEN 61 AND 90 THEN ps.scheduled_amount - ps.paid_amount ELSE 0 END) as bucket_61_90,
            SUM(CASE WHEN DATEDIFF(CURDATE(), ps.due_date) > 90 THEN ps.scheduled_amount - ps.paid_amount ELSE 0 END) as bucket_90_plus
     FROM payment_schedule ps JOIN vendors v ON ps.vendor_id = v.id
     WHERE ps.status IN ('overdue','partial') GROUP BY v.id, v.vendor_name`
  );
  res.json({ success: true, data: rows });
}));

// POST /api/payments/run — pay a batch of due schedules.
router.post('/run', authenticate, requireRole('procurement_admin', 'system_admin'), asyncHandler(async (req, res) => {
  const { schedule_ids } = req.body;
  const results = await runPayments(schedule_ids, req.user.id);
  res.status(201).json({ success: true, data: results });
}));

// GET /api/payments — list payments.
router.get('/', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const { status, vendor_id } = req.query;
  let sql = `SELECT p.*, v.vendor_name FROM payments p LEFT JOIN vendors v ON p.vendor_id = v.id WHERE 1=1`;
  const params = [];
  if (status) { sql += ' AND p.status = ?'; params.push(status); }
  if (vendor_id) { sql += ' AND p.vendor_id = ?'; params.push(vendor_id); }
  sql += ' ORDER BY p.created_at DESC';
  const [rows] = await pool.query(sql, params);
  res.json({ success: true, data: rows });
}));

// PUT /api/payments/:id/reconcile — mark a payment bank-reconciled.
router.put('/:id/reconcile', authenticate, requireRole('procurement_admin', 'system_admin'), asyncHandler(async (req, res) => {
  const result = await reconcilePayment(req.params.id, req.body.bank_reference);
  res.json({ success: true, data: result });
}));

// GET /api/payments/vendor-ledger/:vendorId — running ledger for one vendor.
router.get('/vendor-ledger/:vendorId', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM vendor_ledger WHERE vendor_id = ? ORDER BY transaction_date, created_at', [req.params.vendorId]);
  res.json({ success: true, data: rows });
}));

// GET/POST /api/payments/cashflow-projection — recompute on demand, read any time.
router.get('/cashflow-projection', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM cashflow_projection ORDER BY bucket_date');
  res.json({ success: true, data: rows });
}));

router.post('/cashflow-projection/recompute', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const bucketCount = await recomputeCashflowProjection();
  res.json({ success: true, message: `Recomputed ${bucketCount} projection bucket(s)` });
}));

module.exports = router;
