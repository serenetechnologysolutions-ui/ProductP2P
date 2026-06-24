const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { ValidationError, NotFoundError } = require('../../common/errors');
const { authenticate, requireRole } = require('../auth/auth.middleware');
const { autoContractNumber } = require('../pr/pr.helpers');

const router = express.Router();

// GET /api/contracts — list (optional vendor_id/status filters)
router.get('/', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const { vendor_id, status } = req.query;
  let sql = `SELECT c.*, v.vendor_name FROM contracts c LEFT JOIN vendors v ON c.vendor_id = v.id WHERE 1=1`;
  const params = [];
  if (vendor_id) { sql += ' AND c.vendor_id = ?'; params.push(vendor_id); }
  if (status) { sql += ' AND c.status = ?'; params.push(status); }
  sql += ' ORDER BY c.created_at DESC';

  const [rows] = await pool.query(sql, params);
  res.json({ success: true, data: rows });
}));

// GET /api/contracts/:id
router.get('/:id', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT c.*, v.vendor_name FROM contracts c LEFT JOIN vendors v ON c.vendor_id = v.id WHERE c.id = ?`,
    [req.params.id]
  );
  if (rows.length === 0) throw new NotFoundError('Contract not found');
  res.json({ success: true, data: rows[0] });
}));

// POST /api/contracts — create
router.post('/', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const { vendor_id, title, start_date, end_date, payment_terms, currency, contract_value } = req.body;

  const missing = [];
  if (!vendor_id) missing.push('vendor_id');
  if (!title) missing.push('title');
  if (!start_date) missing.push('start_date');
  if (!end_date) missing.push('end_date');
  if (missing.length > 0) throw new ValidationError('Missing required fields', missing);

  const id = uuidv4();
  const contractNumber = await autoContractNumber();
  await pool.query(
    `INSERT INTO contracts (id, contract_number, vendor_id, title, start_date, end_date, payment_terms, currency, contract_value, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, contractNumber, vendor_id, title, start_date, end_date, payment_terms || null, currency || 'INR', contract_value ?? null, req.user.id]
  );

  res.status(201).json({ success: true, data: { id, contract_number: contractNumber } });
}));

module.exports = router;
