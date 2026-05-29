const express = require('express');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { authenticate, requireRole } = require('../auth/auth.middleware');

const router = express.Router();

// GET /api/pricing/benchmarks — Group by item_description, calc avg/min/max/last
router.get('/benchmarks', authenticate, requireRole('procurement_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const [rows] = await pool.query(`
    SELECT
      ph.item_description,
      COUNT(*) as record_count,
      ROUND(AVG(ph.unit_price), 2) as avg_price,
      MIN(ph.unit_price) as min_price,
      MAX(ph.unit_price) as max_price,
      (SELECT p2.unit_price FROM price_history p2
       WHERE p2.item_description = ph.item_description
       ORDER BY p2.recorded_at DESC LIMIT 1) as last_price
    FROM price_history ph
    GROUP BY ph.item_description
    ORDER BY ph.item_description
  `);
  res.json({ success: true, data: rows });
}));

// GET /api/pricing/history — List all price_history with vendor name
router.get('/history', authenticate, requireRole('procurement_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT ph.*, v.vendor_name
     FROM price_history ph
     LEFT JOIN vendors v ON ph.vendor_id = v.id
     ORDER BY ph.recorded_at DESC`
  );
  res.json({ success: true, data: rows });
}));

module.exports = router;
