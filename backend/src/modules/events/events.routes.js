const express = require('express');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { authenticate, requireRole } = require('../auth/auth.middleware');
const { getEventSubscribers } = require('../../common/eventBus');

const router = express.Router();

// GET /api/events/log — the durable event history (Module 8), admin-only.
router.get('/log', authenticate, requireRole('system_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const { event_type, page = 1, limit = 50 } = req.query;
  let sql = 'SELECT * FROM event_log WHERE 1=1';
  const params = [];
  if (event_type) { sql += ' AND event_type = ?'; params.push(event_type); }

  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
  const [countRows] = await pool.query(countSql, params);

  const offset = (parseInt(page) - 1) * parseInt(limit);
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);
  const [rows] = await pool.query(sql, params);

  res.json({ success: true, data: rows, pagination: { current: parseInt(page), pageSize: parseInt(limit), total: countRows[0].total } });
}));

// GET /api/events/subscribers — which in-process handlers listen to which
// event type, for the same admin visibility (Module 8's event_subscribers ask).
router.get('/subscribers', authenticate, requireRole('system_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  res.json({ success: true, data: getEventSubscribers() });
}));

module.exports = router;
