const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { authenticate, requireRole } = require('../auth/auth.middleware');

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
    // Count rejected ASNs
    const [[{ rejectedCount }]] = await pool.query(
      "SELECT COUNT(*) as rejectedCount FROM asns WHERE vendor_id = ? AND status = 'rejected'",
      [vendor.id]
    );

    // Count late ASNs (ETA < created_at means the ASN was created after its ETA — late delivery)
    const [[{ lateCount }]] = await pool.query(
      'SELECT COUNT(*) as lateCount FROM asns WHERE vendor_id = ? AND eta < created_at',
      [vendor.id]
    );

    // Count open audit findings for this vendor
    const [[{ findingsCount }]] = await pool.query(
      `SELECT COUNT(*) as findingsCount FROM audit_findings af
       INNER JOIN audit_executions ae ON af.execution_id = ae.id
       INNER JOIN audit_schedules asc2 ON ae.schedule_id = asc2.id
       WHERE asc2.vendor_id = ? AND af.status = 'open'`,
      [vendor.id]
    );

    // Calculate scores (normalize to 0-100 scale, cap at 100)
    const rejectionScore = Math.min(rejectedCount * 10, 100);
    const delayScore = Math.min(lateCount * 10, 100);
    const auditScore = Math.min(findingsCount * 15, 100);

    // Weighted average
    const riskScore = Math.round((rejectionScore * 0.4 + delayScore * 0.35 + auditScore * 0.25) * 100) / 100;

    // Determine level
    let riskLevel = 'low';
    if (riskScore >= 60) riskLevel = 'high';
    else if (riskScore >= 30) riskLevel = 'medium';

    // Upsert
    const [existing] = await pool.query('SELECT id FROM vendor_risk_scores WHERE vendor_id = ?', [vendor.id]);
    if (existing.length === 0) {
      await pool.query(
        'INSERT INTO vendor_risk_scores (id, vendor_id, risk_score, risk_level, delay_score, rejection_score, audit_score, calculated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
        [uuidv4(), vendor.id, riskScore, riskLevel, delayScore, rejectionScore, auditScore]
      );
    } else {
      await pool.query(
        'UPDATE vendor_risk_scores SET risk_score = ?, risk_level = ?, delay_score = ?, rejection_score = ?, audit_score = ?, calculated_at = NOW() WHERE vendor_id = ?',
        [riskScore, riskLevel, delayScore, rejectionScore, auditScore, vendor.id]
      );
    }
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
