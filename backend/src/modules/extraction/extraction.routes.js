const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { authenticate, requireRole } = require('../auth/auth.middleware');

const router = express.Router();

// GET /api/extraction-configs
router.get('/', authenticate, requireRole('procurement_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM extraction_configs WHERE is_active = TRUE ORDER BY FIELD(priority, "high", "medium", "low")');
  res.json({ success: true, data: rows });
}));

// POST /api/extraction-configs
router.post('/', authenticate, requireRole('procurement_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const { field_name, aliases, regex_pattern, priority } = req.body;
  const id = uuidv4();
  await pool.query(
    'INSERT INTO extraction_configs (id, field_name, aliases, regex_pattern, priority) VALUES (?, ?, ?, ?, ?)',
    [id, field_name, JSON.stringify(aliases), regex_pattern || null, priority || 'medium']
  );
  res.status(201).json({ success: true, data: { id, field_name, aliases, regex_pattern, priority } });
}));

// PUT /api/extraction-configs/:id
router.put('/:id', authenticate, requireRole('procurement_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const { field_name, aliases, regex_pattern, priority } = req.body;
  await pool.query(
    'UPDATE extraction_configs SET field_name = ?, aliases = ?, regex_pattern = ?, priority = ? WHERE id = ?',
    [field_name, JSON.stringify(aliases), regex_pattern || null, priority || 'medium', req.params.id]
  );
  res.json({ success: true, message: 'Updated' });
}));

// DELETE /api/extraction-configs/:id
router.delete('/:id', authenticate, requireRole('procurement_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  await pool.query('UPDATE extraction_configs SET is_active = FALSE WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: 'Removed' });
}));

module.exports = router;
