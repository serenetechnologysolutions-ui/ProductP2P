const express = require('express');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { NotFoundError } = require('../../common/errors');
const { authenticate, requireRole } = require('../auth/auth.middleware');
const { retryDlqEntry } = require('../../common/retry');
const {
  registerSapEventSubscribers, syncToSap, pullPaymentStatusFromSap, pushVendorToSap, pullVendorFromSap,
} = require('./sap-connector.service');

const router = express.Router();

registerSapEventSubscribers();

const ADMIN_ROLES = ['system_admin', 'mdm_admin'];

// ─── Module 12: integration_logs visibility ────────────────────────────────
router.get('/logs', authenticate, requireRole(...ADMIN_ROLES), asyncHandler(async (req, res) => {
  const { integration_type, status, page = 1, limit = 50 } = req.query;
  let sql = 'SELECT * FROM integration_logs WHERE 1=1';
  const params = [];
  if (integration_type) { sql += ' AND integration_type = ?'; params.push(integration_type); }
  if (status) { sql += ' AND status = ?'; params.push(status); }

  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
  const [countRows] = await pool.query(countSql, params);
  const offset = (parseInt(page) - 1) * parseInt(limit);
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);
  const [rows] = await pool.query(sql, params);
  res.json({ success: true, data: rows, pagination: { current: parseInt(page), pageSize: parseInt(limit), total: countRows[0].total } });
}));

// ─── Module 12: generic audit_logs visibility ──────────────────────────────
router.get('/audit-logs', authenticate, requireRole(...ADMIN_ROLES), asyncHandler(async (req, res) => {
  const { module_name, record_id, page = 1, limit = 50 } = req.query;
  let sql = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];
  if (module_name) { sql += ' AND module_name = ?'; params.push(module_name); }
  if (record_id) { sql += ' AND record_id = ?'; params.push(record_id); }

  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
  const [countRows] = await pool.query(countSql, params);
  const offset = (parseInt(page) - 1) * parseInt(limit);
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);
  const [rows] = await pool.query(sql, params);
  res.json({ success: true, data: rows, pagination: { current: parseInt(page), pageSize: parseInt(limit), total: countRows[0].total } });
}));

// ─── Module 11: Dead-letter queue ──────────────────────────────────────────
router.get('/dlq', authenticate, requireRole(...ADMIN_ROLES), asyncHandler(async (req, res) => {
  const { resolved } = req.query;
  let sql = 'SELECT * FROM integration_dlq WHERE 1=1';
  const params = [];
  if (resolved !== undefined) { sql += ' AND resolved = ?'; params.push(resolved === 'true'); }
  sql += ' ORDER BY created_at DESC';
  const [rows] = await pool.query(sql, params);
  res.json({ success: true, data: rows });
}));

// POST /api/integration/dlq/:id/retry — manual retry of a dead-lettered sync.
router.post('/dlq/:id/retry', authenticate, requireRole(...ADMIN_ROLES), asyncHandler(async (req, res) => {
  const [[entry]] = await pool.query('SELECT * FROM integration_dlq WHERE id = ?', [req.params.id]);
  if (!entry) throw new NotFoundError('DLQ entry not found');

  const result = await retryDlqEntry(req.params.id, (payload) => syncToSap(entry.integration_type, entry.record_id, payload));
  res.json({ success: true, data: result });
}));

// ─── Module 4: manual sync triggers (for the rare case a sync needs forcing
// outside the normal event-driven path, plus the inbound pulls) ───────────
router.post('/vendors/:id/push', authenticate, requireRole(...ADMIN_ROLES), asyncHandler(async (req, res) => {
  const result = await pushVendorToSap(req.params.id);
  res.json({ success: true, data: result });
}));

router.post('/vendors/pull/:sapVendorCode', authenticate, requireRole(...ADMIN_ROLES), asyncHandler(async (req, res) => {
  const result = await pullVendorFromSap(req.params.sapVendorCode);
  res.json({ success: true, data: result });
}));

router.post('/payments/:id/pull-status', authenticate, requireRole(...ADMIN_ROLES), asyncHandler(async (req, res) => {
  const result = await pullPaymentStatusFromSap(req.params.id);
  res.json({ success: true, data: result });
}));

module.exports = router;
