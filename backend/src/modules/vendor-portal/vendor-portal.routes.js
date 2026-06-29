const express = require('express');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { authenticate, requireRole } = require('../auth/auth.middleware');
const { isFeatureEnabled } = require('../../common/featureFlags');
const { getVendorScore } = require('../insights/insights.service');
const { getComplianceStatus } = require('../vendor/vendor-compliance.service');
const { listExceptions } = require('../exceptions/exceptions.service');

const router = express.Router();

// Vendor Portal 2.0 — entirely new, self-service endpoints for the vendor
// role, kept in their own module rather than added to the existing
// modules/vendor/vendor.routes.js (the admin-facing CRUD module other roles
// depend on) so this work can never collide with or destabilize it. Every
// route is scoped to req.user.vendorId (the same JWT-derived isolation the
// rest of the app already uses) — a vendor can only ever see their own data.
router.use(authenticate, requireRole('vendor'));
router.use(asyncHandler(async (req, res, next) => {
  req.vendorPortalV2Enabled = await isFeatureEnabled('vendor_portal_v2_enabled');
  next();
}));

const DISABLED_RESPONSE = { success: true, data: null, feature_enabled: false };

// GET /api/vendor-portal/dashboard
router.get('/dashboard', asyncHandler(async (req, res) => {
  if (!req.vendorPortalV2Enabled) return res.json(DISABLED_RESPONSE);
  const vendorId = req.user.vendorId;

  const [[{ activeRfqs }]] = await pool.query(
    `SELECT COUNT(*) as activeRfqs FROM rfq_vendors rv INNER JOIN rfqs r ON rv.rfq_id = r.id
     WHERE rv.vendor_id = ? AND r.status IN ('published','negotiation')`,
    [vendorId]
  );
  const [[{ openPos }]] = await pool.query(
    "SELECT COUNT(*) as openPos FROM purchase_orders WHERE vendor_id = ? AND status IN ('open','partially_fulfilled')",
    [vendorId]
  );
  const [[{ pendingAsns }]] = await pool.query(
    "SELECT COUNT(*) as pendingAsns FROM asns WHERE vendor_id = ? AND status IN ('draft','submitted','validated')",
    [vendorId]
  );
  // No payment/ERP integration exists in this app — this is computed from the
  // real invoices this vendor has on file (not a fabricated mock number).
  const [[paymentStatus]] = await pool.query(
    `SELECT COUNT(*) as invoice_count,
       COALESCE(SUM(total_amount), 0) as total_invoiced,
       COALESCE(SUM(CASE WHEN match_status = 'matched' THEN total_amount ELSE 0 END), 0) as matched_amount,
       COALESCE(SUM(CASE WHEN match_status = 'blocked' THEN total_amount ELSE 0 END), 0) as blocked_amount,
       COALESCE(SUM(CASE WHEN match_status = 'pending' THEN total_amount ELSE 0 END), 0) as pending_amount
     FROM invoices WHERE vendor_id = ?`,
    [vendorId]
  );

  const [recentRfqs] = await pool.query(
    `SELECT r.id, r.rfq_number as number, r.status, rv.invited_at as at FROM rfq_vendors rv
     INNER JOIN rfqs r ON rv.rfq_id = r.id WHERE rv.vendor_id = ? ORDER BY rv.invited_at DESC LIMIT 5`,
    [vendorId]
  );
  const [recentPos] = await pool.query(
    'SELECT id, po_number as number, status, created_at as at FROM purchase_orders WHERE vendor_id = ? ORDER BY created_at DESC LIMIT 5',
    [vendorId]
  );
  const [recentAsns] = await pool.query(
    'SELECT id, asn_number as number, status, created_at as at FROM asns WHERE vendor_id = ? ORDER BY created_at DESC LIMIT 5',
    [vendorId]
  );
  const recentActivity = [
    ...recentRfqs.map(r => ({ type: 'rfq', ...r })),
    ...recentPos.map(r => ({ type: 'purchase_order', ...r })),
    ...recentAsns.map(r => ({ type: 'asn', ...r })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 8);

  const compliance = await getComplianceStatus(vendorId);
  const { rows: openExceptions } = await listExceptions({ module_name: 'vendor', record_id: vendorId, status: 'open' });

  res.json({
    success: true,
    feature_enabled: true,
    data: {
      active_rfqs: Number(activeRfqs),
      open_pos: Number(openPos),
      pending_asns: Number(pendingAsns),
      payment_status: paymentStatus,
      recent_activity: recentActivity,
      alerts: {
        compliance_blocked: compliance.is_blocked,
        compliance_documents_at_risk: compliance.documents.filter(d => d.status !== 'ok'),
        open_exception_count: openExceptions.length,
      },
    },
  });
}));

// GET /api/vendor-portal/performance
router.get('/performance', asyncHandler(async (req, res) => {
  if (!req.vendorPortalV2Enabled) return res.json(DISABLED_RESPONSE);
  // Reuses ProcurementInsightsService.getVendorScore() verbatim — the exact
  // same function the admin-facing Vendors > Intelligence tab calls — so a
  // vendor's self-service view of their own score can never disagree with
  // what an MDM/Procurement admin sees for them.
  const score = await getVendorScore(req.user.vendorId);
  res.json({ success: true, feature_enabled: true, data: score });
}));

// GET /api/vendor-portal/transactions?type=rfq|purchase_order|asn&page=1&limit=10
router.get('/transactions', asyncHandler(async (req, res) => {
  if (!req.vendorPortalV2Enabled) return res.json(DISABLED_RESPONSE);
  const vendorId = req.user.vendorId;
  const { type } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
  const offset = (page - 1) * limit;

  if (type === 'rfq') {
    const [[{ total }]] = await pool.query('SELECT COUNT(*) as total FROM rfq_vendors WHERE vendor_id = ?', [vendorId]);
    const [rows] = await pool.query(
      `SELECT r.id, r.rfq_number, r.title, r.status, rv.participation_status, rv.invited_at
       FROM rfq_vendors rv INNER JOIN rfqs r ON rv.rfq_id = r.id
       WHERE rv.vendor_id = ? ORDER BY rv.invited_at DESC LIMIT ? OFFSET ?`,
      [vendorId, limit, offset]
    );
    return res.json({ success: true, feature_enabled: true, data: rows, pagination: { page, limit, total: Number(total) } });
  }

  if (type === 'purchase_order') {
    const [[{ total }]] = await pool.query('SELECT COUNT(*) as total FROM purchase_orders WHERE vendor_id = ?', [vendorId]);
    const [rows] = await pool.query(
      'SELECT id, po_number, status, total_value, created_at FROM purchase_orders WHERE vendor_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [vendorId, limit, offset]
    );
    return res.json({ success: true, feature_enabled: true, data: rows, pagination: { page, limit, total: Number(total) } });
  }

  if (type === 'asn') {
    const [[{ total }]] = await pool.query('SELECT COUNT(*) as total FROM asns WHERE vendor_id = ?', [vendorId]);
    const [rows] = await pool.query(
      'SELECT id, asn_number, status, created_at FROM asns WHERE vendor_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [vendorId, limit, offset]
    );
    return res.json({ success: true, feature_enabled: true, data: rows, pagination: { page, limit, total: Number(total) } });
  }

  // No type filter — a capped snapshot of all three, for the default "All" view.
  const [rfqs] = await pool.query(
    `SELECT r.id, r.rfq_number, r.title, r.status, rv.participation_status, rv.invited_at
     FROM rfq_vendors rv INNER JOIN rfqs r ON rv.rfq_id = r.id WHERE rv.vendor_id = ? ORDER BY rv.invited_at DESC LIMIT 20`,
    [vendorId]
  );
  const [purchaseOrders] = await pool.query(
    'SELECT id, po_number, status, total_value, created_at FROM purchase_orders WHERE vendor_id = ? ORDER BY created_at DESC LIMIT 20',
    [vendorId]
  );
  const [asns] = await pool.query(
    'SELECT id, asn_number, status, created_at FROM asns WHERE vendor_id = ? ORDER BY created_at DESC LIMIT 20',
    [vendorId]
  );
  res.json({ success: true, feature_enabled: true, data: { rfqs, purchase_orders: purchaseOrders, asns } });
}));

module.exports = router;
