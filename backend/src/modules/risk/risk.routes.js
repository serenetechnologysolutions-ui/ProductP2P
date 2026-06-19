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

    // Financial risk: derive from vendor's blacklist_flag/risk_category (existing vendor master fields) —
    // no dedicated financial transaction data exists yet, so this is a simple categorical proxy rather than a computed metric.
    const [[vendorInfo]] = await pool.query(
      'SELECT blacklist_flag, risk_category FROM vendors WHERE id = ?',
      [vendor.id]
    );
    let financialRiskScore = 10;
    if (vendorInfo) {
      if (vendorInfo.blacklist_flag) financialRiskScore = 100;
      else if (vendorInfo.risk_category === 'high') financialRiskScore = 70;
      else if (vendorInfo.risk_category === 'medium') financialRiskScore = 40;
      else financialRiskScore = 10;
    }

    // Dependency risk: proxy via count of open purchase orders placed with this vendor in the last 90 days,
    // normalized the same way as rejection/delay scores above.
    const [[{ poCount }]] = await pool.query(
      "SELECT COUNT(*) as poCount FROM purchase_orders WHERE vendor_id = ? AND status = 'open' AND created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)",
      [vendor.id]
    );
    const dependencyRiskScore = Math.min(poCount * 10, 100);

    // Geographic risk: no reliable geographic risk signal (e.g. region risk ratings) exists yet on vendors;
    // default to 0 rather than fabricate a derivation from lat/long or serviceable_regions presence.
    const geographicRiskScore = 0;

    // ESG risk: derive from vendor_esg.compliance_status, which has a clear existing signal.
    const [[esgInfo]] = await pool.query(
      'SELECT compliance_status FROM vendor_esg WHERE vendor_id = ?',
      [vendor.id]
    );
    let esgRiskScore = 0;
    if (esgInfo) {
      if (esgInfo.compliance_status === 'non_compliant') esgRiskScore = 70;
      else if (esgInfo.compliance_status === 'pending') esgRiskScore = 40;
      else if (esgInfo.compliance_status === 'compliant') esgRiskScore = 10;
    }

    // Weighted average — extended to fold in the new sub-scores while keeping weights summing to 1.
    const riskScore = Math.round((
      rejectionScore * 0.25 +
      delayScore * 0.20 +
      auditScore * 0.15 +
      financialRiskScore * 0.15 +
      dependencyRiskScore * 0.10 +
      geographicRiskScore * 0.05 +
      esgRiskScore * 0.10
    ) * 100) / 100;

    // Determine level
    let riskLevel = 'low';
    if (riskScore >= 60) riskLevel = 'high';
    else if (riskScore >= 30) riskLevel = 'medium';

    // Read previous score (before overwrite) to determine trend
    const [existing] = await pool.query('SELECT id, risk_score FROM vendor_risk_scores WHERE vendor_id = ?', [vendor.id]);

    let riskTrend = 'stable';
    if (existing.length > 0 && existing[0].risk_score != null) {
      const prevScore = Number(existing[0].risk_score);
      const diff = riskScore - prevScore;
      if (diff > 5) riskTrend = 'worsening';
      else if (diff < -5) riskTrend = 'improving';
      else riskTrend = 'stable';
    }

    // Upsert
    if (existing.length === 0) {
      await pool.query(
        `INSERT INTO vendor_risk_scores
         (id, vendor_id, risk_score, risk_level, delay_score, rejection_score, audit_score,
          financial_risk_score, dependency_risk_score, geographic_risk_score, esg_risk_score, risk_trend, calculated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [uuidv4(), vendor.id, riskScore, riskLevel, delayScore, rejectionScore, auditScore,
          financialRiskScore, dependencyRiskScore, geographicRiskScore, esgRiskScore, riskTrend]
      );
    } else {
      await pool.query(
        `UPDATE vendor_risk_scores SET
          risk_score = ?, risk_level = ?, delay_score = ?, rejection_score = ?, audit_score = ?,
          financial_risk_score = ?, dependency_risk_score = ?, geographic_risk_score = ?, esg_risk_score = ?,
          risk_trend = ?, calculated_at = NOW()
         WHERE vendor_id = ?`,
        [riskScore, riskLevel, delayScore, rejectionScore, auditScore,
          financialRiskScore, dependencyRiskScore, geographicRiskScore, esgRiskScore, riskTrend, vendor.id]
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
