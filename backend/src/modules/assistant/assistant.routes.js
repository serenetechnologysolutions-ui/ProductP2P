const express = require('express');
const { asyncHandler } = require('../../common/middleware');
const { authenticate, requireRole } = require('../auth/auth.middleware');
const { isFeatureEnabled } = require('../../common/featureFlags');
const smartAssistant = require('../../services/SmartAssistantService');

const router = express.Router();
const INTERNAL_ROLES = ['mdm_admin', 'procurement_admin'];

// Feature-flag gate, applied identically to all three routes below: while
// smart_assistant_enabled is off, every route responds the same way the
// frontend's SmartAssistantPanel already treats "no insights" — an empty,
// well-formed payload — rather than a 404, so a disabled flag never looks
// like a broken endpoint to anything calling it directly.
router.use(asyncHandler(async (req, res, next) => {
  req.smartAssistantEnabled = await isFeatureEnabled('smart_assistant_enabled');
  next();
}));

// GET /api/assistant/pr/:id
router.get('/pr/:id', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  if (!req.smartAssistantEnabled) return res.json({ success: true, data: { insights: [] }, feature_enabled: false });
  const data = await smartAssistant.getPrAssistant(req.params.id);
  res.json({ success: true, data, feature_enabled: true });
}));

// GET /api/assistant/rfq/:id
router.get('/rfq/:id', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  if (!req.smartAssistantEnabled) return res.json({ success: true, data: { insights: [] }, feature_enabled: false });
  const data = await smartAssistant.getRfqAssistant(req.params.id);
  res.json({ success: true, data, feature_enabled: true });
}));

// GET /api/assistant/vendor/:id
router.get('/vendor/:id', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  if (!req.smartAssistantEnabled) return res.json({ success: true, data: { insights: [] }, feature_enabled: false });
  const data = await smartAssistant.getVendorAssistant(req.params.id);
  res.json({ success: true, data, feature_enabled: true });
}));

// GET /api/assistant/po/:id
router.get('/po/:id', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  if (!req.smartAssistantEnabled) return res.json({ success: true, data: { insights: [] }, feature_enabled: false });
  const data = await smartAssistant.getPoAssistant(req.params.id);
  res.json({ success: true, data, feature_enabled: true });
}));

// GET /api/assistant/cost-saving-opportunities — Procurement Command Center:
// cost_saving-type insights across recent open requisitions.
router.get('/cost-saving-opportunities', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  if (!req.smartAssistantEnabled) return res.json({ success: true, data: [], feature_enabled: false });
  const data = await smartAssistant.getTopCostSavingOpportunities(req.query.limit);
  res.json({ success: true, data, feature_enabled: true });
}));

const EMPTY_DECISION_PANEL = { critical_alerts: [], risks: [], cost_saving_opportunities: [], recommendations: [] };

// GET /api/decision-panel/:entityType/:id — bucketed regrouping of the same
// per-entity assistant data above, for the DecisionPanel UI component.
router.get('/decision-panel/:entityType/:id', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  if (!req.smartAssistantEnabled) return res.json({ success: true, data: EMPTY_DECISION_PANEL, feature_enabled: false });
  const data = await smartAssistant.getDecisionPanel(req.params.entityType, req.params.id);
  res.json({ success: true, data, feature_enabled: true });
}));

module.exports = router;
