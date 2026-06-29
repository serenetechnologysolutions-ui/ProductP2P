const express = require('express');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { authenticate, requireRole } = require('../auth/auth.middleware');
const { calculateVendorRiskScore } = require('./risk.service');

const router = express.Router();

// GET /api/risk/scores — List all vendor risk scores with vendor name
router.get('/scores', authenticate, requireRole('procurement_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT rs.*, v.vendor_name FROM vendor_risk_scores rs LEFT JOIN vendors v ON rs.vendor_id = v.id ORDER BY rs.risk_score DESC'
  );
  res.json({ success: true, data: rows });
}));

// POST /api/risk/calculate — Recalculate all vendor risk scores
router.post('/calculate', authenticate, requireRole('procurement_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const [vendors] = await pool.query('SELECT id FROM vendors');

  for (const vendor of vendors) {
    await calculateVendorRiskScore(vendor.id);
  }

  res.json({ success: true, message: `Risk scores recalculated for ${vendors.length} vendors` });
}));

// GET /api/risk/dashboard — Summary + scores list
router.get('/dashboard', authenticate, requireRole('procurement_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const [scores] = await pool.query(
    'SELECT rs.*, v.vendor_name FROM vendor_risk_scores rs LEFT JOIN vendors v ON rs.vendor_id = v.id ORDER BY rs.risk_score DESC'
  );

  const [[{ lowCount }]] = await pool.query("SELECT COUNT(*) as lowCount FROM vendor_risk_scores WHERE risk_level = 'low'");
  const [[{ mediumCount }]] = await pool.query("SELECT COUNT(*) as mediumCount FROM vendor_risk_scores WHERE risk_level = 'medium'");
  const [[{ highCount }]] = await pool.query("SELECT COUNT(*) as highCount FROM vendor_risk_scores WHERE risk_level = 'high'");

  res.json({
    success: true,
    data: {
      summary: { low: lowCount, medium: mediumCount, high: highCount },
      scores,
    },
  });
}));

module.exports = router;
