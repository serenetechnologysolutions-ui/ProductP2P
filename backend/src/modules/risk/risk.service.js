const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { detectVendorRiskAlert } = require('../exceptions/exceptions.service');

// Extracted from risk.routes.js's POST /calculate loop body so a single
// vendor's score can be (re)computed on demand — used by that endpoint in a
// loop over every vendor, and by ProcurementInsightsService.getVendorScore()
// for a fresh single-vendor read. Behavior/weights are unchanged from the
// original inline implementation; this is a pure extraction, not a rewrite.
async function calculateVendorRiskScore(vendorId, conn) {
  const c = conn || pool;

  // Count rejected ASNs
  const [[{ rejectedCount }]] = await c.query(
    "SELECT COUNT(*) as rejectedCount FROM asns WHERE vendor_id = ? AND status = 'rejected'",
    [vendorId]
  );

  // Count late ASNs (ETA < created_at means the ASN was created after its ETA — late delivery)
  const [[{ lateCount }]] = await c.query(
    'SELECT COUNT(*) as lateCount FROM asns WHERE vendor_id = ? AND eta < created_at',
    [vendorId]
  );

  // Count open audit findings for this vendor
  const [[{ findingsCount }]] = await c.query(
    `SELECT COUNT(*) as findingsCount FROM audit_findings af
     INNER JOIN audit_executions ae ON af.execution_id = ae.id
     INNER JOIN audit_schedules asc2 ON ae.schedule_id = asc2.id
     WHERE asc2.vendor_id = ? AND af.status = 'open'`,
    [vendorId]
  );

  // Calculate scores (normalize to 0-100 scale, cap at 100)
  const rejectionScore = Math.min(rejectedCount * 10, 100);
  const delayScore = Math.min(lateCount * 10, 100);
  const auditScore = Math.min(findingsCount * 15, 100);

  // Financial risk: derive from vendor's blacklist_flag/risk_category (existing vendor master fields) —
  // no dedicated financial transaction data exists yet, so this is a simple categorical proxy rather than a computed metric.
  const [[vendorInfo]] = await c.query(
    'SELECT blacklist_flag, risk_category FROM vendors WHERE id = ?',
    [vendorId]
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
  const [[{ poCount }]] = await c.query(
    "SELECT COUNT(*) as poCount FROM purchase_orders WHERE vendor_id = ? AND status = 'open' AND created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)",
    [vendorId]
  );
  const dependencyRiskScore = Math.min(poCount * 10, 100);

  // Geographic risk: no reliable geographic risk signal (e.g. region risk ratings) exists yet on vendors;
  // default to 0 rather than fabricate a derivation from lat/long or serviceable_regions presence.
  const geographicRiskScore = 0;

  // ESG risk: derive from vendor_esg.compliance_status, which has a clear existing signal.
  const [[esgInfo]] = await c.query(
    'SELECT compliance_status FROM vendor_esg WHERE vendor_id = ?',
    [vendorId]
  );
  let esgRiskScore = 0;
  if (esgInfo) {
    if (esgInfo.compliance_status === 'non_compliant') esgRiskScore = 70;
    else if (esgInfo.compliance_status === 'pending') esgRiskScore = 40;
    else if (esgInfo.compliance_status === 'compliant') esgRiskScore = 10;
  }

  // Weighted average — weights sum to 1.
  const riskScore = Math.round((
    rejectionScore * 0.25 +
    delayScore * 0.20 +
    auditScore * 0.15 +
    financialRiskScore * 0.15 +
    dependencyRiskScore * 0.10 +
    geographicRiskScore * 0.05 +
    esgRiskScore * 0.10
  ) * 100) / 100;

  let riskLevel = 'low';
  if (riskScore >= 60) riskLevel = 'high';
  else if (riskScore >= 30) riskLevel = 'medium';

  // Read previous score (before overwrite) to determine trend
  const [existing] = await c.query('SELECT id, risk_score FROM vendor_risk_scores WHERE vendor_id = ?', [vendorId]);

  let riskTrend = 'stable';
  if (existing.length > 0 && existing[0].risk_score != null) {
    const prevScore = Number(existing[0].risk_score);
    const diff = riskScore - prevScore;
    if (diff > 5) riskTrend = 'worsening';
    else if (diff < -5) riskTrend = 'improving';
    else riskTrend = 'stable';
  }

  const row = {
    vendor_id: vendorId, risk_score: riskScore, risk_level: riskLevel,
    delay_score: delayScore, rejection_score: rejectionScore, audit_score: auditScore,
    financial_risk_score: financialRiskScore, dependency_risk_score: dependencyRiskScore,
    geographic_risk_score: geographicRiskScore, esg_risk_score: esgRiskScore, risk_trend: riskTrend,
  };

  if (existing.length === 0) {
    await c.query(
      `INSERT INTO vendor_risk_scores
       (id, vendor_id, risk_score, risk_level, delay_score, rejection_score, audit_score,
        financial_risk_score, dependency_risk_score, geographic_risk_score, esg_risk_score, risk_trend, calculated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [uuidv4(), vendorId, riskScore, riskLevel, delayScore, rejectionScore, auditScore,
        financialRiskScore, dependencyRiskScore, geographicRiskScore, esgRiskScore, riskTrend]
    );
  } else {
    await c.query(
      `UPDATE vendor_risk_scores SET
        risk_score = ?, risk_level = ?, delay_score = ?, rejection_score = ?, audit_score = ?,
        financial_risk_score = ?, dependency_risk_score = ?, geographic_risk_score = ?, esg_risk_score = ?,
        risk_trend = ?, calculated_at = NOW()
       WHERE vendor_id = ?`,
      [riskScore, riskLevel, delayScore, rejectionScore, auditScore,
        financialRiskScore, dependencyRiskScore, geographicRiskScore, esgRiskScore, riskTrend, vendorId]
    );
  }

  // Exception Management Engine: every caller of this function (the bulk
  // /risk/calculate loop, and ProcurementInsightsService.getVendorScore)
  // gets vendor-risk alerting for free, with no separate call needed.
  await detectVendorRiskAlert(vendorId, row, c);

  return row;
}

module.exports = { calculateVendorRiskScore };
