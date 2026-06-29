const express = require('express');
const { asyncHandler } = require('../../common/middleware');
const { authenticate, requireRole } = require('../auth/auth.middleware');
const traceabilityService = require('./traceability.service');

const router = express.Router();

// GET /api/traceability/:documentId — full PR -> RFQ -> PO -> ASN lifecycle
// for whichever document the id belongs to. Same role scoping as the other
// procurement modules — internal procurement roles only.
router.get('/:documentId', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const data = await traceabilityService.getFullTraceability(req.params.documentId);
  res.json({ success: true, data });
}));

module.exports = router;
