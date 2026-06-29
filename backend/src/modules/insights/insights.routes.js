const express = require('express');
const { asyncHandler } = require('../../common/middleware');
const { authenticate, requireRole } = require('../auth/auth.middleware');
const insightsService = require('./insights.service');

const router = express.Router();

// ProcurementInsightsService — thin controller layer. Every handler just
// parses the request and delegates to insights.service.js; no business logic
// lives here. Same role scoping as the rest of the procurement modules
// (PR, RFQ, Contracts, Risk, Pricing): internal procurement roles only.

// GET /api/insights/items/:itemId/price-benchmark
router.get('/items/:itemId/price-benchmark', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const data = await insightsService.getItemPriceBenchmark(req.params.itemId);
  res.json({ success: true, data });
}));

// GET /api/insights/items/:itemId/should-cost?quoted_price=123.45
router.get('/items/:itemId/should-cost', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const data = await insightsService.getShouldCostBenchmark(req.params.itemId, req.query.quoted_price ?? null);
  res.json({ success: true, data });
}));

// GET /api/insights/vendors/:vendorId/score
router.get('/vendors/:vendorId/score', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const data = await insightsService.getVendorScore(req.params.vendorId);
  res.json({ success: true, data });
}));

// GET /api/insights/vendors/:vendorId/contract-summary
router.get('/vendors/:vendorId/contract-summary', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const data = await insightsService.getVendorContractSummary(req.params.vendorId);
  res.json({ success: true, data });
}));

// GET /api/insights/pr/:prId
router.get('/pr/:prId', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const data = await insightsService.getPRInsights(req.params.prId);
  res.json({ success: true, data });
}));

module.exports = router;
