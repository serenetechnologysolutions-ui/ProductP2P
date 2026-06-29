const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { authenticate, requireRole } = require('../auth/auth.middleware');

const router = express.Router();

// GET /api/sub-masters/cost-centre?company_id=X
// Returns cost centres scoped to a specific company OR unscoped (legacy).
router.get('/cost-centre', authenticate, asyncHandler(async (req, res) => {
  const { company_id } = req.query;
  if (!company_id) return res.json({ success: true, data: [] });
  const [rows] = await pool.query(
    'SELECT * FROM sub_masters WHERE category = ? AND (company_id = ? OR company_id IS NULL) AND is_active = TRUE ORDER BY name',
    ['cost_center', company_id]
  );
  res.json({ success: true, data: rows });
}));

// GET /api/sub-masters/:category
router.get('/:category', authenticate, asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM sub_masters WHERE category = ? AND is_active = TRUE ORDER BY name', [req.params.category]);
  res.json({ success: true, data: rows });
}));

// POST /api/sub-masters
router.post('/', authenticate, requireRole('mdm_admin', 'procurement_admin', 'system_admin'), asyncHandler(async (req, res) => {
  const { category, name, code, company_id, tax_percentage } = req.body;
  // HSN codes are always global (no company scoping)
  const effectiveCompanyId = category === 'hsn_code' ? null : (company_id || null);
  // Validate tax_percentage for hsn_code
  if (category === 'hsn_code' && tax_percentage != null) {
    const val = Number(tax_percentage);
    if (isNaN(val) || val < 0 || val > 100) throw new ValidationError('Tax percentage must be between 0 and 100');
  }
  const id = uuidv4();
  await pool.query('INSERT INTO sub_masters (id, category, name, code, company_id, tax_percentage) VALUES (?, ?, ?, ?, ?, ?)',
    [id, category, name, code || null, effectiveCompanyId, tax_percentage != null ? tax_percentage : null]);
  res.status(201).json({ success: true, data: { id, category, name, code, company_id: effectiveCompanyId, tax_percentage } });
}));

// PUT /api/sub-masters/:id
router.put('/:id', authenticate, requireRole('mdm_admin', 'procurement_admin', 'system_admin'), asyncHandler(async (req, res) => {
  const { name, code, is_active, company_id, tax_percentage } = req.body;
  // Validate tax_percentage
  if (tax_percentage != null) {
    const val = Number(tax_percentage);
    if (isNaN(val) || val < 0 || val > 100) throw new ValidationError('Tax percentage must be between 0 and 100');
  }
  if (tax_percentage !== undefined) {
    await pool.query('UPDATE sub_masters SET name = ?, code = ?, is_active = ?, company_id = ?, tax_percentage = ? WHERE id = ?',
      [name, code, is_active !== false, company_id !== undefined ? (company_id || null) : null, tax_percentage, req.params.id]);
  } else if (company_id !== undefined) {
    await pool.query('UPDATE sub_masters SET name = ?, code = ?, is_active = ?, company_id = ? WHERE id = ?',
      [name, code, is_active !== false, company_id || null, req.params.id]);
  } else {
    await pool.query('UPDATE sub_masters SET name = ?, code = ?, is_active = ? WHERE id = ?',
      [name, code, is_active !== false, req.params.id]);
  }
  res.json({ success: true, message: 'Updated' });
}));

// DELETE /api/sub-masters/:id
router.delete('/:id', authenticate, requireRole('mdm_admin'), asyncHandler(async (req, res) => {
  await pool.query('UPDATE sub_masters SET is_active = FALSE WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: 'Removed' });
}));

module.exports = router;
