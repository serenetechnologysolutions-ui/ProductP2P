const express = require('express');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { authenticate, requireRole } = require('../auth/auth.middleware');
const { getBatches, getBatchById, consumeFromBatch } = require('./batch.service');

const router = express.Router();

const BATCH_ROLES = ['procurement_admin', 'system_admin', 'mdm_admin'];

// GET /api/inventory/batches — list batches with query filters
router.get('/', authenticate, requireRole(...BATCH_ROLES), asyncHandler(async (req, res) => {
  const { item_code, batch_number, location_id, include_exhausted } = req.query;
  const filters = {};
  if (item_code) filters.item_code = item_code;
  if (batch_number) filters.batch_number = batch_number;
  if (location_id) filters.location_id = location_id;
  if (include_exhausted === 'true') filters.include_exhausted = true;

  const batches = await getBatches(filters);
  res.json({ success: true, data: batches });
}));

// GET /api/inventory/batches/:id — get single batch detail
router.get('/:id', authenticate, requireRole(...BATCH_ROLES), asyncHandler(async (req, res) => {
  const batch = await getBatchById(req.params.id);
  res.json({ success: true, data: batch });
}));

// POST /api/inventory/batches/consume — consume stock from a specific batch
router.post('/consume', authenticate, requireRole(...BATCH_ROLES), asyncHandler(async (req, res) => {
  const { batch_id, quantity, reference } = req.body;
  const result = await consumeFromBatch(batch_id, Number(quantity), reference, req.user.id);
  res.json({ success: true, data: result });
}));

module.exports = router;
