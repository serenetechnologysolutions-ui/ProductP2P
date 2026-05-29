const express = require('express');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { authenticate } = require('../auth/auth.middleware');

const router = express.Router();

// GET /api/dashboard — Role-based dashboard data
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { role, vendorId } = req.user;

  if (role === 'vendor') {
    // Vendor dashboard — their own data
    const [vendor] = await pool.query('SELECT status, vendor_name FROM vendors WHERE id = ?', [vendorId]);
    const [myAsns] = await pool.query('SELECT COUNT(*) as count FROM asns WHERE vendor_id = ?', [vendorId]);
    const [submittedAsns] = await pool.query("SELECT COUNT(*) as count FROM asns WHERE vendor_id = ? AND status = 'submitted'", [vendorId]);
    const [postedAsns] = await pool.query("SELECT COUNT(*) as count FROM asns WHERE vendor_id = ? AND status = 'posted'", [vendorId]);
    const [myPos] = await pool.query('SELECT COUNT(*) as count FROM purchase_orders WHERE vendor_id = ?', [vendorId]);
    const [recentAsns] = await pool.query('SELECT asn_number, invoice_number, total_amount, status, created_at FROM asns WHERE vendor_id = ? ORDER BY created_at DESC LIMIT 5', [vendorId]);

    return res.json({
      success: true,
      data: {
        role: 'vendor',
        summary: {
          vendor_status: vendor[0]?.status || 'unknown',
          vendor_name: vendor[0]?.vendor_name || '',
          total_asns: myAsns[0].count,
          submitted_asns: submittedAsns[0].count,
          posted_asns: postedAsns[0].count,
          total_pos: myPos[0].count,
        },
        recent_asns: recentAsns,
      },
    });
  }

  if (role === 'procurement_admin') {
    // Procurement admin — ASN focused
    const [totalAsns] = await pool.query('SELECT COUNT(*) as count FROM asns');
    const [pendingValidation] = await pool.query("SELECT COUNT(*) as count FROM asns WHERE status = 'submitted'");
    const [validated] = await pool.query("SELECT COUNT(*) as count FROM asns WHERE status = 'validated'");
    const [posted] = await pool.query("SELECT COUNT(*) as count FROM asns WHERE status = 'posted'");
    const [rejected] = await pool.query("SELECT COUNT(*) as count FROM asns WHERE status = 'rejected'");
    const [asnsByStatus] = await pool.query('SELECT status, COUNT(*) as count FROM asns GROUP BY status');
    const [asnsByMonth] = await pool.query("SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count FROM asns GROUP BY month ORDER BY month DESC LIMIT 12");
    const [recentAsns] = await pool.query('SELECT a.asn_number, a.invoice_number, a.total_amount, a.status, a.created_at, v.vendor_name FROM asns a LEFT JOIN vendors v ON a.vendor_id = v.id ORDER BY a.created_at DESC LIMIT 10');

    return res.json({
      success: true,
      data: {
        role: 'procurement_admin',
        summary: {
          total_asns: totalAsns[0].count,
          pending_validation: pendingValidation[0].count,
          validated: validated[0].count,
          posted_erp: posted[0].count,
          rejected: rejected[0].count,
        },
        charts: { asns_by_status: asnsByStatus, asns_by_month: asnsByMonth },
        recent_asns: recentAsns,
      },
    });
  }

  // MDM Admin — full overview
  const [totalVendors] = await pool.query('SELECT COUNT(*) as count FROM vendors');
  const [pendingApproval] = await pool.query("SELECT COUNT(*) as count FROM vendors WHERE status IN ('submitted', 'under_review')");
  const [activeVendors] = await pool.query("SELECT COUNT(*) as count FROM vendors WHERE status = 'approved'");
  const [totalAsns] = await pool.query('SELECT COUNT(*) as count FROM asns');
  const [pendingValidation] = await pool.query("SELECT COUNT(*) as count FROM asns WHERE status = 'submitted'");
  const [postedErp] = await pool.query("SELECT COUNT(*) as count FROM asns WHERE status = 'posted'");
  const [vendorsByStatus] = await pool.query('SELECT status, COUNT(*) as count FROM vendors GROUP BY status');
  const [asnsByMonth] = await pool.query("SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count FROM asns GROUP BY month ORDER BY month DESC LIMIT 12");
  const [recentVendors] = await pool.query('SELECT vendor_number, vendor_name, email, status, created_at FROM vendors ORDER BY created_at DESC LIMIT 10');

  res.json({
    success: true,
    data: {
      role: 'mdm_admin',
      summary: {
        total_vendors: totalVendors[0].count,
        pending_approval: pendingApproval[0].count,
        active_vendors: activeVendors[0].count,
        total_asns: totalAsns[0].count,
        pending_validation: pendingValidation[0].count,
        posted_erp: postedErp[0].count,
      },
      charts: { vendors_by_status: vendorsByStatus, asns_by_month: asnsByMonth },
      recent_vendors: recentVendors,
    },
  });
}));

module.exports = router;
