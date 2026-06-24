const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { ValidationError } = require('../../common/errors');
const { authenticate, requireRole } = require('../auth/auth.middleware');

const router = express.Router();

// GET /api/system/settings — Get all system settings
router.get('/settings', authenticate, requireRole('system_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM system_settings ORDER BY setting_key');
  res.json({ success: true, data: rows });
}));

// GET /api/system/settings/:key — single-setting lookup, open to any authenticated
// role (unlike the bulk catalog above), since some settings drive non-admin pages'
// own UI (e.g. procurement_admin needs po_require_pr_reference on the PO screen).
router.get('/settings/:key', authenticate, asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT setting_value FROM system_settings WHERE setting_key = ?', [req.params.key]);
  res.json({ success: true, data: { key: req.params.key, value: rows.length > 0 ? rows[0].setting_value : null } });
}));

// PUT /api/system/settings — Update a setting
router.put('/settings', authenticate, requireRole('system_admin'), asyncHandler(async (req, res) => {
  const { key, value } = req.body;
  if (!key) throw new ValidationError('Missing required field', ['key']);

  const [existing] = await pool.query('SELECT id FROM system_settings WHERE setting_key = ?', [key]);
  if (existing.length === 0) {
    await pool.query('INSERT INTO system_settings (id, setting_key, setting_value) VALUES (?, ?, ?)', [uuidv4(), key, value]);
  } else {
    await pool.query('UPDATE system_settings SET setting_value = ? WHERE setting_key = ?', [value, key]);
  }

  res.json({ success: true, message: 'Setting updated' });
}));

// GET /api/system/usage — System usage statistics
router.get('/usage', authenticate, requireRole('system_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const [[{ totalUsers }]] = await pool.query('SELECT COUNT(*) as totalUsers FROM users');
  const [[{ activeUsers }]] = await pool.query("SELECT COUNT(*) as activeUsers FROM users WHERE is_active = TRUE");
  const [[{ totalVendors }]] = await pool.query('SELECT COUNT(*) as totalVendors FROM vendors');
  const [[{ totalASNs }]] = await pool.query('SELECT COUNT(*) as totalASNs FROM asns');
  const [[{ totalPOs }]] = await pool.query('SELECT COUNT(*) as totalPOs FROM purchase_orders');
  const [[{ totalTickets }]] = await pool.query('SELECT COUNT(*) as totalTickets FROM tickets');
  const [[{ dbSize }]] = await pool.query(
    "SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as dbSize FROM information_schema.tables WHERE table_schema = DATABASE()"
  );

  res.json({
    success: true,
    data: {
      totalUsers,
      activeUsers,
      totalVendors,
      totalASNs,
      totalPOs,
      totalTickets,
      dbSizeMB: dbSize || 0,
    },
  });
}));

// GET /api/system/field-config — All field mandatory/optional settings (admin UI)
router.get('/field-config', authenticate, requireRole('system_admin'), asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM field_requirements ORDER BY module_key, display_order');
  res.json({ success: true, data: rows });
}));

// GET /api/system/field-config/:module — { field_key: is_mandatory } map for one module, used by forms at render time
router.get('/field-config/:module', authenticate, asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT field_key, is_mandatory FROM field_requirements WHERE module_key = ?', [req.params.module]);
  const map = {};
  rows.forEach(r => { map[r.field_key] = !!r.is_mandatory; });
  res.json({ success: true, data: map });
}));

// PUT /api/system/field-config/:id — Toggle a single field's mandatory flag
router.put('/field-config/:id', authenticate, requireRole('system_admin'), asyncHandler(async (req, res) => {
  const { is_mandatory } = req.body;
  if (typeof is_mandatory !== 'boolean') throw new ValidationError('Missing required field', ['is_mandatory']);

  await pool.query('UPDATE field_requirements SET is_mandatory = ? WHERE id = ?', [is_mandatory, req.params.id]);
  const [rows] = await pool.query('SELECT * FROM field_requirements WHERE id = ?', [req.params.id]);
  res.json({ success: true, data: rows[0] });
}));

module.exports = router;
