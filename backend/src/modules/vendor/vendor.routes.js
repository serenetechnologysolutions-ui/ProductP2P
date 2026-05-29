const express = require('express');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { ValidationError, NotFoundError, InvalidStateTransitionError, ConflictError, AuthorizationError } = require('../../common/errors');
const { generatePassword } = require('../../common/password');
const { authenticate, requireRole } = require('../auth/auth.middleware');

const router = express.Router();

// Vendor workflow state machine
const VALID_TRANSITIONS = {
  draft: ['submitted'],
  submitted: ['under_review'],
  under_review: ['approved', 'rejected'],
  rejected: ['draft'],
  approved: ['inactive'],
};

// POST /api/vendors — Create a new vendor (MDM admin only)
router.post('/', authenticate, requireRole('mdm_admin'), asyncHandler(async (req, res) => {
  const { vendor_name, email, phone, company_name, department, supplier_group, supplier_category, supplier_location } = req.body;

  // Validate mandatory fields
  const missing = [];
  if (!vendor_name) missing.push('vendor_name');
  if (!email) missing.push('email');
  if (!phone) missing.push('phone');
  if (!company_name) missing.push('company_name');
  if (!department) missing.push('department');
  if (!supplier_group) missing.push('supplier_group');
  if (!supplier_category) missing.push('supplier_category');
  if (!supplier_location) missing.push('supplier_location');
  if (missing.length > 0) throw new ValidationError('Missing mandatory fields', missing);

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) throw new ValidationError('Invalid email format', ['email']);

  // Check duplicate email
  const [existing] = await pool.query('SELECT id FROM vendors WHERE email = ?', [email]);
  if (existing.length > 0) throw new ConflictError('A vendor with this email already exists');

  const vendorId = uuidv4();
  const vendorNumber = 'VND-' + Date.now().toString(36).toUpperCase();
  const plainPassword = generatePassword();
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  // Insert vendor
  await pool.query(
    `INSERT INTO vendors (id, vendor_number, vendor_name, email, phone, company_name, department, supplier_group, supplier_category, supplier_location, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
    [vendorId, vendorNumber, vendor_name, email, phone, company_name, department, supplier_group, supplier_category, supplier_location, req.user.id]
  );

  // Create user account for vendor
  const userId = uuidv4();
  await pool.query(
    `INSERT INTO users (id, email, password_hash, role, vendor_id, must_reset_password, full_name)
     VALUES (?, ?, ?, 'vendor', ?, TRUE, ?)`,
    [userId, email, passwordHash, vendorId, vendor_name]
  );

  res.status(201).json({
    success: true,
    data: {
      id: vendorId,
      vendor_number: vendorNumber,
      vendor_name,
      email,
      phone,
      company_name,
      department,
      supplier_group,
      supplier_category,
      supplier_location,
      status: 'draft',
      temporary_password: plainPassword,
    },
  });
}));

// GET /api/vendors — List vendors with filtering and pagination
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { status, name, phone, email, page = 1, limit = 10 } = req.query;
  let sql = 'SELECT id, vendor_number, vendor_name, email, phone, company_name, department, supplier_group, supplier_category, supplier_location, status, created_at, updated_at FROM vendors WHERE 1=1';
  const params = [];

  // Vendor isolation: vendors can only see themselves
  if (req.user.role === 'vendor') {
    sql += ' AND id = ?';
    params.push(req.user.vendorId);
  }

  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (name) { sql += ' AND vendor_name LIKE ?'; params.push(`%${name}%`); }
  if (phone) { sql += ' AND phone LIKE ?'; params.push(`%${phone}%`); }
  if (email) { sql += ' AND email LIKE ?'; params.push(`%${email}%`); }

  const countSql = sql.replace(/SELECT .* FROM/, 'SELECT COUNT(*) as total FROM');
  const [countRows] = await pool.query(countSql, params);
  const total = countRows[0].total;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);
  const [rows] = await pool.query(sql, params);

  res.json({ success: true, data: rows, pagination: { current: parseInt(page), pageSize: parseInt(limit), total } });
}));

// GET /api/vendors/:id — Get vendor detail
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Vendor isolation: vendor can only see own data
  if (req.user.role === 'vendor' && req.user.vendorId !== id) {
    throw new AuthorizationError();
  }

  const [rows] = await pool.query('SELECT * FROM vendors WHERE id = ?', [id]);
  if (rows.length === 0) throw new NotFoundError('Vendor not found');

  // Fetch related data
  const [addresses] = await pool.query('SELECT * FROM vendor_addresses WHERE vendor_id = ?', [id]);
  const [bankAccounts] = await pool.query('SELECT * FROM vendor_bank_accounts WHERE vendor_id = ?', [id]);
  const [documents] = await pool.query('SELECT * FROM vendor_documents WHERE vendor_id = ?', [id]);

  res.json({
    success: true,
    data: {
      ...rows[0],
      addresses,
      bank_accounts: bankAccounts,
      documents,
    },
  });
}));

// PUT /api/vendors/:id — Admin edit all vendor fields (MDM admin only)
router.put('/:id', authenticate, requireRole('mdm_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [vendor] = await pool.query('SELECT id FROM vendors WHERE id = ?', [id]);
  if (vendor.length === 0) throw new NotFoundError('Vendor not found');

  const {
    vendor_name, phone, company_name, department, supplier_group, supplier_category, supplier_location,
    gst_number, pan_number, trade_name, legal_name, msme_type, itr_filing_status,
    phone1, phone2, email1, email2, addresses, bank_accounts
  } = req.body;

  // Update all editable fields (admin can update everything except email which is login key)
  await pool.query(
    `UPDATE vendors SET vendor_name=?, phone=?, company_name=?, department=?, supplier_group=?, supplier_category=?, supplier_location=?, gst_number=?, pan_number=?, trade_name=?, legal_name=?, msme_type=?, itr_filing_status=?, phone1=?, phone2=?, email1=?, email2=? WHERE id=?`,
    [vendor_name, phone, company_name, department, supplier_group, supplier_category, supplier_location, gst_number || null, pan_number || null, trade_name || null, legal_name || null, msme_type || null, itr_filing_status || null, phone1 || null, phone2 || null, email1 || null, email2 || null, id]
  );

  // Replace addresses if provided
  if (addresses && Array.isArray(addresses)) {
    await pool.query('DELETE FROM vendor_addresses WHERE vendor_id = ?', [id]);
    for (const addr of addresses) {
      await pool.query(
        'INSERT INTO vendor_addresses (id, vendor_id, line1, line2, city, state, country, pin_code, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), id, addr.line1, addr.line2 || null, addr.city, addr.state, addr.country || 'India', addr.pin_code, addr.tags ? JSON.stringify(addr.tags) : null]
      );
    }
  }

  // Replace bank accounts if provided
  if (bank_accounts && Array.isArray(bank_accounts)) {
    await pool.query('DELETE FROM vendor_bank_accounts WHERE vendor_id = ?', [id]);
    for (const bank of bank_accounts) {
      await pool.query(
        'INSERT INTO vendor_bank_accounts (id, vendor_id, ifsc_code, account_number, account_holder_name, bank_name, branch, city, state, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), id, bank.ifsc_code, bank.account_number, bank.account_holder_name, bank.bank_name, bank.branch, bank.city, bank.state, bank.country || 'India']
      );
    }
  }

  res.json({ success: true, message: 'Vendor updated successfully' });
}));

// PUT /api/vendors/:id/onboarding — Update self-onboarding data (vendor only)
router.put('/:id/onboarding', authenticate, requireRole('vendor'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Vendor can only update own data
  if (req.user.vendorId !== id) throw new AuthorizationError();

  const [vendor] = await pool.query('SELECT id, status FROM vendors WHERE id = ?', [id]);
  if (vendor.length === 0) throw new NotFoundError('Vendor not found');

  const { gst_number, pan_number, trade_name, legal_name, msme_type, itr_filing_status, phone1, phone2, email1, email2, addresses, bank_accounts } = req.body;

  // Update business fields
  await pool.query(
    `UPDATE vendors SET gst_number = ?, pan_number = ?, trade_name = ?, legal_name = ?, msme_type = ?, itr_filing_status = ?, phone1 = ?, phone2 = ?, email1 = ?, email2 = ? WHERE id = ?`,
    [gst_number || null, pan_number || null, trade_name || null, legal_name || null, msme_type || null, itr_filing_status || null, phone1 || null, phone2 || null, email1 || null, email2 || null, id]
  );

  // Replace addresses (delete + re-insert)
  if (addresses && Array.isArray(addresses)) {
    await pool.query('DELETE FROM vendor_addresses WHERE vendor_id = ?', [id]);
    for (const addr of addresses) {
      await pool.query(
        'INSERT INTO vendor_addresses (id, vendor_id, line1, line2, city, state, country, pin_code, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), id, addr.line1, addr.line2 || null, addr.city, addr.state, addr.country || 'India', addr.pin_code, addr.tags ? JSON.stringify(addr.tags) : null]
      );
    }
  }

  // Replace bank accounts (delete + re-insert)
  if (bank_accounts && Array.isArray(bank_accounts)) {
    await pool.query('DELETE FROM vendor_bank_accounts WHERE vendor_id = ?', [id]);
    for (const bank of bank_accounts) {
      await pool.query(
        'INSERT INTO vendor_bank_accounts (id, vendor_id, ifsc_code, account_number, account_holder_name, bank_name, branch, city, state, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), id, bank.ifsc_code, bank.account_number, bank.account_holder_name, bank.bank_name, bank.branch, bank.city, bank.state, bank.country || 'India']
      );
    }
  }

  res.json({ success: true, message: 'Onboarding data updated' });
}));

// POST /api/vendors/:id/submit — Submit for approval (vendor only)
router.post('/:id/submit', authenticate, requireRole('vendor'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (req.user.vendorId !== id) throw new AuthorizationError();

  const [rows] = await pool.query('SELECT status FROM vendors WHERE id = ?', [id]);
  if (rows.length === 0) throw new NotFoundError('Vendor not found');

  if (!VALID_TRANSITIONS[rows[0].status]?.includes('submitted')) {
    throw new InvalidStateTransitionError(rows[0].status, 'submitted');
  }

  await pool.query('UPDATE vendors SET status = ? WHERE id = ?', ['submitted', id]);
  res.json({ success: true, message: 'Vendor submitted for approval' });
}));

// POST /api/vendors/:id/review — Begin review (admin only)
router.post('/:id/review', authenticate, requireRole('mdm_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [rows] = await pool.query('SELECT status FROM vendors WHERE id = ?', [id]);
  if (rows.length === 0) throw new NotFoundError('Vendor not found');

  if (!VALID_TRANSITIONS[rows[0].status]?.includes('under_review')) {
    throw new InvalidStateTransitionError(rows[0].status, 'under_review');
  }

  await pool.query('UPDATE vendors SET status = ? WHERE id = ?', ['under_review', id]);
  res.json({ success: true, message: 'Vendor is now under review' });
}));

// POST /api/vendors/:id/approve — Approve vendor (admin only)
router.post('/:id/approve', authenticate, requireRole('mdm_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [rows] = await pool.query('SELECT status FROM vendors WHERE id = ?', [id]);
  if (rows.length === 0) throw new NotFoundError('Vendor not found');

  if (!VALID_TRANSITIONS[rows[0].status]?.includes('approved')) {
    throw new InvalidStateTransitionError(rows[0].status, 'approved');
  }

  await pool.query('UPDATE vendors SET status = ? WHERE id = ?', ['approved', id]);
  res.json({ success: true, message: 'Vendor approved' });
}));

// POST /api/vendors/:id/reject — Reject vendor with reason (admin only)
router.post('/:id/reject', authenticate, requireRole('mdm_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason || reason.trim().length === 0) {
    throw new ValidationError('Rejection reason is required', ['reason']);
  }

  const [rows] = await pool.query('SELECT status FROM vendors WHERE id = ?', [id]);
  if (rows.length === 0) throw new NotFoundError('Vendor not found');

  if (!VALID_TRANSITIONS[rows[0].status]?.includes('rejected')) {
    throw new InvalidStateTransitionError(rows[0].status, 'rejected');
  }

  await pool.query('UPDATE vendors SET status = ?, rejection_reason = ? WHERE id = ?', ['rejected', reason.trim(), id]);
  res.json({ success: true, message: 'Vendor rejected' });
}));

// PUT /api/vendors/:id/deactivate — Soft delete / deactivate vendor (admin only)
router.put('/:id/deactivate', authenticate, requireRole('mdm_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [rows] = await pool.query('SELECT status FROM vendors WHERE id = ?', [id]);
  if (rows.length === 0) throw new NotFoundError('Vendor not found');

  if (!VALID_TRANSITIONS[rows[0].status]?.includes('inactive')) {
    throw new InvalidStateTransitionError(rows[0].status, 'inactive');
  }

  await pool.query('UPDATE vendors SET status = ? WHERE id = ?', ['inactive', id]);

  // Deactivate associated user account
  await pool.query('UPDATE users SET is_active = FALSE WHERE vendor_id = ?', [id]);

  res.json({ success: true, message: 'Vendor deactivated' });
}));

module.exports = router;
