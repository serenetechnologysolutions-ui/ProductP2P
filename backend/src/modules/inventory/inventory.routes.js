const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { ValidationError, NotFoundError } = require('../../common/errors');
const { authenticate, requireRole } = require('../auth/auth.middleware');
const { resolveCompanyAccess } = require('../company/company.middleware');
const { registerInventoryEventSubscribers, consumeStock } = require('./inventory.service');

const router = express.Router();

registerInventoryEventSubscribers();

const INVENTORY_ROLES = ['system_admin', 'procurement_admin'];

// ─── Warehouses ───────────────────────────────────────────────────────────
router.get('/warehouses', authenticate, requireRole(...INVENTORY_ROLES), resolveCompanyAccess, asyncHandler(async (req, res) => {
  const { companyIds } = req;
  let sql = 'SELECT * FROM warehouses';
  const params = [];
  if (companyIds !== null && Array.isArray(companyIds)) {
    if (companyIds.length === 0) return res.json({ success: true, data: [] });
    sql += ` WHERE (company_id IN (${companyIds.map(() => '?').join(',')}) OR company_id IS NULL)`;
    params.push(...companyIds);
  }
  sql += ' ORDER BY warehouse_name';
  const [rows] = await pool.query(sql, params);
  res.json({ success: true, data: rows });
}));

router.post('/warehouses', authenticate, requireRole('system_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const { warehouse_code, warehouse_name, location, company_id } = req.body;
  if (!warehouse_code || !warehouse_name) throw new ValidationError('Missing required fields', ['warehouse_code', 'warehouse_name']);
  const id = uuidv4();
  await pool.query('INSERT INTO warehouses (id, warehouse_code, warehouse_name, location, company_id) VALUES (?, ?, ?, ?, ?)', [id, warehouse_code, warehouse_name, location || null, company_id || null]);
  const [rows] = await pool.query('SELECT * FROM warehouses WHERE id = ?', [id]);
  res.status(201).json({ success: true, data: rows[0] });
}));

// ─── Stock ────────────────────────────────────────────────────────────────
router.get('/stock', authenticate, requireRole(...INVENTORY_ROLES), resolveCompanyAccess, asyncHandler(async (req, res) => {
  const { warehouse_id, below_reorder } = req.query;
  const { companyIds } = req;
  let sql = `SELECT s.*, w.warehouse_name, im.item_code, im.item_description
             FROM inventory_stock s
             LEFT JOIN warehouses w ON s.warehouse_id = w.id
             LEFT JOIN item_master im ON s.item_master_id = im.id WHERE 1=1`;
  const params = [];
  if (companyIds !== null && Array.isArray(companyIds)) {
    if (companyIds.length === 0) return res.json({ success: true, data: [] });
    // Filter by items mapped to user's companies (item_company_mapping)
    sql += ` AND (s.item_master_id IN (SELECT icm.item_id FROM item_company_mapping icm WHERE icm.company_id IN (${companyIds.map(() => '?').join(',')})) OR NOT EXISTS (SELECT 1 FROM item_company_mapping icm2 WHERE icm2.item_id = s.item_master_id))`;
    params.push(...companyIds);
  }
  if (warehouse_id) { sql += ' AND s.warehouse_id = ?'; params.push(warehouse_id); }
  if (below_reorder === 'true') { sql += ' AND s.quantity_on_hand < s.reorder_level'; }
  sql += ' ORDER BY im.item_code';
  const [rows] = await pool.query(sql, params);
  res.json({ success: true, data: rows });
}));

// PUT /api/inventory/stock/:warehouseId/:itemMasterId — set reorder levels
// (create the stock row if it doesn't exist yet, starting at 0 on hand).
router.put('/stock/:warehouseId/:itemMasterId', authenticate, requireRole(...INVENTORY_ROLES), asyncHandler(async (req, res) => {
  const { reorder_level, reorder_quantity } = req.body;
  const { warehouseId, itemMasterId } = req.params;
  const [existing] = await pool.query('SELECT id FROM inventory_stock WHERE warehouse_id = ? AND item_master_id = ?', [warehouseId, itemMasterId]);
  if (existing.length === 0) {
    await pool.query(
      'INSERT INTO inventory_stock (id, warehouse_id, item_master_id, reorder_level, reorder_quantity) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), warehouseId, itemMasterId, reorder_level || 0, reorder_quantity || 0]
    );
  } else {
    await pool.query('UPDATE inventory_stock SET reorder_level = ?, reorder_quantity = ? WHERE id = ?', [reorder_level || 0, reorder_quantity || 0, existing[0].id]);
  }
  const [rows] = await pool.query('SELECT * FROM inventory_stock WHERE warehouse_id = ? AND item_master_id = ?', [warehouseId, itemMasterId]);
  res.json({ success: true, data: rows[0] });
}));

// POST /api/inventory/consume — manual stock-out, triggers auto-reorder PR if applicable.
router.post('/consume', authenticate, requireRole(...INVENTORY_ROLES), asyncHandler(async (req, res) => {
  const { warehouse_id, item_master_id, quantity, reference } = req.body;
  const result = await consumeStock(warehouse_id, item_master_id, Number(quantity), reference, req.user.id);
  res.json({ success: true, data: result });
}));

// GET /api/inventory/movements — stock movement history.
router.get('/movements', authenticate, requireRole(...INVENTORY_ROLES), resolveCompanyAccess, asyncHandler(async (req, res) => {
  const { item_master_id, warehouse_id } = req.query;
  const { companyIds } = req;
  let sql = `SELECT sm.*, im.item_code, w.warehouse_name FROM stock_movements sm
             LEFT JOIN item_master im ON sm.item_master_id = im.id
             LEFT JOIN warehouses w ON sm.warehouse_id = w.id WHERE 1=1`;
  const params = [];
  if (companyIds !== null && Array.isArray(companyIds)) {
    if (companyIds.length === 0) return res.json({ success: true, data: [] });
    sql += ` AND (w.company_id IN (${companyIds.map(() => '?').join(',')}) OR w.company_id IS NULL)`;
    params.push(...companyIds);
  }
  if (item_master_id) { sql += ' AND sm.item_master_id = ?'; params.push(item_master_id); }
  if (warehouse_id) { sql += ' AND sm.warehouse_id = ?'; params.push(warehouse_id); }
  sql += ' ORDER BY sm.created_at DESC LIMIT 200';
  const [rows] = await pool.query(sql, params);
  res.json({ success: true, data: rows });
}));

module.exports = router;
