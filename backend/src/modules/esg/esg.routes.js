const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { ValidationError, NotFoundError } = require('../../common/errors');
const { authenticate, requireRole } = require('../auth/auth.middleware');

const router = express.Router();

// GET /api/esg — List all vendor ESG data with vendor name
router.get('/', authenticate, requireRole('procurement_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT e.*, v.vendor_name FROM vendor_esg e LEFT JOIN vendors v ON e.vendor_id = v.id ORDER BY v.vendor_name'
  );
  res.json({ success: true, data: rows });
}));

// PUT /api/esg/:vendorId — Update ESG data for a vendor
router.put('/:vendorId', authenticate, requireRole('procurement_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const { vendorId } = req.params;
  const { diversity_flag, compliance_status, remarks } = req.body;

  // Verify vendor exists
  const [vendor] = await pool.query('SELECT id FROM vendors WHERE id = ?', [vendorId]);
  if (vendor.length === 0) throw new NotFoundError('Vendor not found');

  // Upsert ESG record
  const [existing] = await pool.query('SELECT id FROM vendor_esg WHERE vendor_id = ?', [vendorId]);
  if (existing.length === 0) {
    await pool.query(
      'INSERT INTO vendor_esg (id, vendor_id, diversity_flag, compliance_status, remarks, updated_by) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), vendorId, diversity_flag || false, compliance_status || 'pending', remarks || null, req.user.id]
    );
  } else {
    await pool.query(
      'UPDATE vendor_esg SET diversity_flag = ?, compliance_status = ?, remarks = ?, updated_by = ? WHERE vendor_id = ?',
      [diversity_flag || false, compliance_status || 'pending', remarks || null, req.user.id, vendorId]
    );
  }

  res.json({ success: true, message: 'ESG data updated' });
}));

module.exports = router;
