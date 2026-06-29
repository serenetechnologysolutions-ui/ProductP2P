const express = require('express');
const { asyncHandler } = require('../../common/middleware');
const { authenticate, requireRole } = require('../auth/auth.middleware');
const exceptionsService = require('./exceptions.service');

const router = express.Router();
const INTERNAL_ROLES = ['mdm_admin', 'procurement_admin'];

// GET /api/exceptions — list with filters: status, exception_type, severity,
// module_name, record_id, vendor_id, transaction_chain_id, page, limit
router.get('/', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const { rows, pagination } = await exceptionsService.listExceptions(req.query);
  res.json({ success: true, data: rows, pagination });
}));

// GET /api/exceptions/summary — global open/resolved counts by severity and
// type, for the Control Tower dashboard's summary panel. Registered before
// /:id so "summary" is never mistaken for an exception id.
router.get('/summary', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const data = await exceptionsService.getSummaryCounts();
  res.json({ success: true, data });
}));

// GET /api/exceptions/budget-health — Procurement Command Center: every cost
// center's budget rollup. Registered before /:id for the same reason
// /summary is — so "budget-health" is never mistaken for an exception id.
router.get('/budget-health', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const data = await exceptionsService.getBudgetHealth();
  res.json({ success: true, data });
}));

// GET /api/exceptions/vendor-risk — Procurement Command Center: top N
// highest-risk vendors.
router.get('/vendor-risk', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const data = await exceptionsService.getTopRiskVendors(req.query.limit);
  res.json({ success: true, data });
}));

// GET /api/exceptions/:id
router.get('/:id', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const data = await exceptionsService.getException(req.params.id);
  res.json({ success: true, data });
}));

// PUT /api/exceptions/:id/resolve — body: { resolution_remarks }
router.put('/:id/resolve', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const data = await exceptionsService.resolveException(req.params.id, {
    resolved_by: req.user.id,
    resolution_remarks: req.body.resolution_remarks,
  });
  res.json({ success: true, data });
}));

module.exports = router;
