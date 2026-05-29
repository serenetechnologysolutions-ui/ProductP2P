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

module.exports = router;
