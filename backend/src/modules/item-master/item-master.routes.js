const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { ValidationError, NotFoundError, ConflictError } = require('../../common/errors');
const { authenticate, requireRole } = require('../auth/auth.middleware');

const router = express.Router();

// GET /api/item-master — list (search by code/description, optional category filter)
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { search, category } = req.query;
  let sql = 'SELECT * FROM item_master WHERE is_active = TRUE';
  const params = [];

  if (search) {
    sql += ' AND (item_code LIKE ? OR item_description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  sql += ' ORDER BY item_description';

  const [rows] = await pool.query(sql, params);
  res.json({ success: true, data: rows });
}));

// POST /api/item-master — create
router.post('/', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const {
    item_code, item_description, uom, category,
    item_name, category_id, subcategory_id, uom_id, hsn_sac_code, standard_cost, currency, specification_template,
  } = req.body;
  if (!item_code || !item_description) throw new ValidationError('item_code and item_description are required');

  const [existing] = await pool.query('SELECT id FROM item_master WHERE item_code = ?', [item_code]);
  if (existing.length > 0) throw new ConflictError('An item with this code already exists');

  const id = uuidv4();
  await pool.query(
    `INSERT INTO item_master
      (id, item_code, item_description, uom, category,
       item_name, category_id, subcategory_id, uom_id, hsn_sac_code, standard_cost, currency, specification_template)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, item_code, item_description, uom || 'Nos', category || null,
      item_name || null, category_id || null, subcategory_id || null, uom_id || null,
      hsn_sac_code || null, standard_cost ?? null, currency || 'INR',
      specification_template ? JSON.stringify(specification_template) : null,
    ]
  );
  res.status(201).json({
    success: true,
    data: {
      id, item_code, item_description, uom: uom || 'Nos', category,
      item_name: item_name || null, category_id: category_id || null, subcategory_id: subcategory_id || null,
      uom_id: uom_id || null, hsn_sac_code: hsn_sac_code || null, standard_cost: standard_cost ?? null,
      currency: currency || 'INR', specification_template: specification_template || null,
    },
  });
}));

// PUT /api/item-master/:id — update
router.put('/:id', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const {
    item_description, uom, category, is_active,
    item_name, category_id, subcategory_id, uom_id, hsn_sac_code, standard_cost, currency, specification_template,
  } = req.body;
  const [rows] = await pool.query('SELECT id FROM item_master WHERE id = ?', [req.params.id]);
  if (rows.length === 0) throw new NotFoundError('Item not found');

  await pool.query(
    `UPDATE item_master SET
       item_description = ?, uom = ?, category = ?, is_active = ?,
       item_name = ?, category_id = ?, subcategory_id = ?, uom_id = ?,
       hsn_sac_code = ?, standard_cost = ?, currency = ?, specification_template = ?
     WHERE id = ?`,
    [
      item_description, uom || 'Nos', category || null, is_active !== false,
      item_name || null, category_id || null, subcategory_id || null, uom_id || null,
      hsn_sac_code || null, standard_cost ?? null, currency || 'INR',
      specification_template ? JSON.stringify(specification_template) : null,
      req.params.id,
    ]
  );
  res.json({ success: true, message: 'Updated' });
}));

// DELETE /api/item-master/:id — soft delete
router.delete('/:id', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  await pool.query('UPDATE item_master SET is_active = FALSE WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: 'Removed' });
}));

// ─── Preferred Vendor Mapping (item_vendor_mapping) ───

// GET /api/item-master/:itemId/vendors — list mapped vendors for an item
router.get('/:itemId/vendors', authenticate, asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT m.id, m.item_id, m.vendor_id, m.is_preferred, m.created_at, v.vendor_name
     FROM item_vendor_mapping m
     LEFT JOIN vendors v ON m.vendor_id = v.id
     WHERE m.item_id = ?
     ORDER BY m.is_preferred DESC, v.vendor_name`,
    [req.params.itemId]
  );
  res.json({ success: true, data: rows });
}));

// POST /api/item-master/:itemId/vendors — upsert a vendor mapping for an item
router.post('/:itemId/vendors', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const { vendor_id, is_preferred } = req.body;
  if (!vendor_id) throw new ValidationError('vendor_id is required');

  const [item] = await pool.query('SELECT id FROM item_master WHERE id = ?', [itemId]);
  if (item.length === 0) throw new NotFoundError('Item not found');

  const id = uuidv4();
  await pool.query(
    `INSERT INTO item_vendor_mapping (id, item_id, vendor_id, is_preferred)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE is_preferred = VALUES(is_preferred)`,
    [id, itemId, vendor_id, !!is_preferred]
  );
  res.status(201).json({ success: true, message: 'Vendor mapping saved' });
}));

// DELETE /api/item-master/:itemId/vendors/:vendorId — remove a vendor mapping
router.delete('/:itemId/vendors/:vendorId', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const { itemId, vendorId } = req.params;
  await pool.query('DELETE FROM item_vendor_mapping WHERE item_id = ? AND vendor_id = ?', [itemId, vendorId]);
  res.json({ success: true, message: 'Vendor mapping removed' });
}));

module.exports = router;
