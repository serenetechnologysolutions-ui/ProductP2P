const express = require('express');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { authenticate, requireRole } = require('../auth/auth.middleware');
const { withTransaction } = require('../../common/db');
const {
  createBranchOrder,
  approveBranchOrder,
  dispatchBranchOrder,
  receiveBranchOrder,
  getBranchOrders,
  getBranchOrderById,
  getAvailableStockAtLocation,
} = require('./branchOrder.service');

const router = express.Router();

const BRANCH_ORDER_ROLES = ['procurement_admin', 'system_admin', 'mdm_admin'];

// GET /api/inventory/branch-orders/available-stock/:locationId — available stock at a location
// NOTE: must be defined before /:id to avoid matching 'available-stock' as an id
router.get('/available-stock/:locationId', authenticate, requireRole(...BRANCH_ORDER_ROLES), asyncHandler(async (req, res) => {
  const stock = await getAvailableStockAtLocation(req.params.locationId);
  res.json({ success: true, data: stock });
}));

// GET /api/inventory/branch-orders — list with filters
router.get('/', authenticate, requireRole(...BRANCH_ORDER_ROLES), asyncHandler(async (req, res) => {
  const { status, from_location_id, to_location_id } = req.query;
  const filters = {};
  if (status) filters.status = status;
  if (from_location_id) filters.from_location_id = from_location_id;
  if (to_location_id) filters.to_location_id = to_location_id;

  const orders = await getBranchOrders(filters);
  res.json({ success: true, data: orders });
}));

// GET /api/inventory/branch-orders/:id — get single order with lines
router.get('/:id', authenticate, requireRole(...BRANCH_ORDER_ROLES), asyncHandler(async (req, res) => {
  const order = await getBranchOrderById(req.params.id);
  res.json({ success: true, data: order });
}));

// POST /api/inventory/branch-orders — create order request
router.post('/', authenticate, requireRole(...BRANCH_ORDER_ROLES), asyncHandler(async (req, res) => {
  const result = await withTransaction((conn) => createBranchOrder(req.body, req.user.id, conn));
  res.status(201).json({ success: true, data: result });
}));

// POST /api/inventory/branch-orders/:id/approve — approve order
router.post('/:id/approve', authenticate, requireRole(...BRANCH_ORDER_ROLES), asyncHandler(async (req, res) => {
  const result = await withTransaction((conn) => approveBranchOrder(req.params.id, req.user.id, conn));
  res.json({ success: true, data: result });
}));

// POST /api/inventory/branch-orders/:id/dispatch — mark as dispatched/in-transit
router.post('/:id/dispatch', authenticate, requireRole(...BRANCH_ORDER_ROLES), asyncHandler(async (req, res) => {
  const result = await withTransaction((conn) => dispatchBranchOrder(req.params.id, req.user.id, conn));
  res.json({ success: true, data: result });
}));

// POST /api/inventory/branch-orders/:id/receive — confirm receipt with received quantities
router.post('/:id/receive', authenticate, requireRole(...BRANCH_ORDER_ROLES), asyncHandler(async (req, res) => {
  const { received_lines } = req.body;
  const result = await withTransaction((conn) => receiveBranchOrder(req.params.id, received_lines, req.user.id, conn));
  res.json({ success: true, data: result });
}));

module.exports = router;
