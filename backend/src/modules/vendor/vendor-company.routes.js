const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { ValidationError, NotFoundError, AuthorizationError } = require('../../common/errors');
const { authenticate, requireRole } = require('../auth/auth.middleware');
const { resolveCompanyAccess } = require('../company/company.middleware');

const router = express.Router();

// GET / — list vendor-company mappings
router.get('/', authenticate, requireRole('system_admin', 'mdm_admin'), resolveCompanyAccess, asyncHandler(async (req, res) => {
  let sql = `SELECT vcm.*, v.vendor_name, c.company_name 
             FROM vendor_company_mapping vcm 
             LEFT JOIN vendors v ON vcm.vendor_id = v.id 
             LEFT JOIN company_master c ON vcm.company_id = c.id WHERE 1=1`;
  const params = [];

  // Filter by company_id if provided
  if (req.query.company_id) {
    sql += ' AND vcm.company_id = ?';
    params.push(req.query.company_id);
  }

  // Filter by vendor_id if provided
  if (req.query.vendor_id) {
    sql += ' AND vcm.vendor_id = ?';
    params.push(req.query.vendor_id);
  }

  // MDM_Admin sees only mappings for their accessible companies
  if (req.companyIds !== null) {
    if (req.companyIds.length === 0) return res.json({ success: true, data: [] });
    sql += ` AND vcm.company_id IN (${req.companyIds.map(() => '?').join(',')})`;
    params.push(...req.companyIds);
  }

  sql += ' ORDER BY v.vendor_name, c.company_name';
  const [rows] = await pool.query(sql, params);
  res.json({ success: true, data: rows });
}));

// POST / — create vendor-company mapping
router.post('/', authenticate, requireRole('system_admin', 'mdm_admin'), resolveCompanyAccess, asyncHandler(async (req, res) => {
  const { vendor_id, company_id } = req.body;
  if (!vendor_id || !company_id) throw new ValidationError('Missing required fields', ['vendor_id', 'company_id']);

  // Validate MDM_Admin has access to this company
  if (req.companyIds !== null && !req.companyIds.includes(company_id)) {
    throw new AuthorizationError('You do not have access to this company');
  }

  // Validate vendor exists and is active
  const [[vendor]] = await pool.query('SELECT id, status FROM vendors WHERE id = ?', [vendor_id]);
  if (!vendor) throw new ValidationError('Vendor not found', ['vendor_id']);

  // Validate company exists and is active
  const [[company]] = await pool.query('SELECT id, is_active FROM company_master WHERE id = ?', [company_id]);
  if (!company) throw new ValidationError('Company not found', ['company_id']);
  if (!company.is_active) throw new ValidationError('Company is inactive', ['company_id']);

  // Check if mapping already exists
  const [existing] = await pool.query('SELECT id FROM vendor_company_mapping WHERE vendor_id = ? AND company_id = ?', [vendor_id, company_id]);
  if (existing.length > 0) return res.json({ success: true, data: existing[0] });

  const id = uuidv4();
  await pool.query('INSERT INTO vendor_company_mapping (id, vendor_id, company_id) VALUES (?, ?, ?)', [id, vendor_id, company_id]);
  const [rows] = await pool.query(
    `SELECT vcm.*, v.vendor_name, c.company_name FROM vendor_company_mapping vcm 
     LEFT JOIN vendors v ON vcm.vendor_id = v.id LEFT JOIN company_master c ON vcm.company_id = c.id WHERE vcm.id = ?`, [id]
  );
  res.status(201).json({ success: true, data: rows[0] });
}));

// DELETE /:id — remove mapping
router.delete('/:id', authenticate, requireRole('system_admin', 'mdm_admin'), resolveCompanyAccess, asyncHandler(async (req, res) => {
  const [existing] = await pool.query('SELECT * FROM vendor_company_mapping WHERE id = ?', [req.params.id]);
  if (existing.length === 0) throw new NotFoundError('Mapping not found');

  // MDM_Admin can only delete mappings for their accessible companies
  if (req.companyIds !== null && !req.companyIds.includes(existing[0].company_id)) {
    throw new AuthorizationError('You do not have access to this company');
  }

  await pool.query('DELETE FROM vendor_company_mapping WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: 'Mapping removed' });
}));

module.exports = router;
