const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { authenticate, requireRole } = require('../auth/auth.middleware');

const router = express.Router();

// GET /api/sub-masters/:category
router.get('/:category', authenticate, asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM sub_masters WHERE category = ? AND is_active = TRUE ORDER BY name', [req.params.category]);
  res.json({ success: true, data: rows });
}));

// POST /api/sub-masters
router.post('/', authenticate, requireRole('mdm_admin'), asyncHandler(async (req, res) => {
  const { category, name, code } = req.body;
  const id = uuidv4();
  await pool.query('INSERT INTO sub_masters (id, category, name, code) VALUES (?, ?, ?, ?)', [id, category, name, code || null]);
  res.status(201).json({ success: true, data: { id, category, name, code } });
}));

// PUT /api/sub-masters/:id
router.put('/:id', authenticate, requireRole('mdm_admin'), asyncHandler(async (req, res) => {
  const { name, code, is_active } = req.body;
  await pool.query('UPDATE sub_masters SET name = ?, code = ?, is_active = ? WHERE id = ?', [name, code, is_active !== false, req.params.id]);
  res.json({ success: true, message: 'Updated' });
}));

// DELETE /api/sub-masters/:id
router.delete('/:id', authenticate, requireRole('mdm_admin'), asyncHandler(async (req, res) => {
  await pool.query('UPDATE sub_masters SET is_active = FALSE WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: 'Removed' });
}));

module.exports = router;
