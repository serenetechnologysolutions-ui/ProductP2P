const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { ValidationError, NotFoundError, InvalidStateTransitionError, ConflictError, AuthorizationError } = require('../../common/errors');
const { generatePassword } = require('../../common/password');
const { authenticate, requireRole } = require('../auth/auth.middleware');

const router = express.Router();
const excelUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const REQUIRED_IMPORT_FIELDS = ['vendor_name', 'email', 'phone', 'company_name', 'department', 'supplier_group', 'supplier_category', 'supplier_location'];

function normalizeHeader(key) {
  return key.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

// Vendor workflow state machine
const VALID_TRANSITIONS = {
  draft: ['submitted'],
  submitted: ['under_review'],
  under_review: ['approved', 'rejected'],
  rejected: ['draft'],
  approved: ['inactive'],
};

// vendor_code_auto: system-generated unique sequential code, separate from the
// timestamp-based vendor_number and from the admin-entered (manual) vendor_code.
async function autoVendorCode() {
  const [[{ maxNum }]] = await pool.query(
    "SELECT MAX(CAST(SUBSTRING(vendor_code_auto, 4) AS UNSIGNED)) as maxNum FROM vendors WHERE vendor_code_auto LIKE 'VC-%'"
  );
  const next = (maxNum || 0) + 1;
  return `VC-${String(next).padStart(6, '0')}`;
}

function gstValidationStatus(gstNumber) {
  if (!gstNumber) return 'pending';
  return GST_REGEX.test(gstNumber) ? 'valid' : 'invalid';
}

function panValidationStatus(panNumber) {
  if (!panNumber) return 'pending';
  return PAN_REGEX.test(panNumber) ? 'valid' : 'invalid';
}

// lifecycle_stage is derived, not user-set: blacklisted vendors are always
// 'blocked'; otherwise it tracks the approval status. 'dormant' has no
// automatic trigger today (it would need an inactivity job) so it's only
// reachable via direct admin override, which this helper does not produce.
function computeLifecycleStage(status, blacklistFlag) {
  if (blacklistFlag) return 'blocked';
  if (status === 'approved') return 'active';
  if (status === 'inactive') return 'blocked';
  return 'onboarding';
}

async function syncLifecycleStage(vendorId) {
  const [[row]] = await pool.query('SELECT status, blacklist_flag FROM vendors WHERE id = ?', [vendorId]);
  if (!row) return;
  const stage = computeLifecycleStage(row.status, !!row.blacklist_flag);
  await pool.query('UPDATE vendors SET lifecycle_stage = ? WHERE id = ?', [stage, vendorId]);
}

// POST /api/vendors — Create a new vendor (MDM admin only)
router.post('/', authenticate, requireRole('mdm_admin'), asyncHandler(async (req, res) => {
  const {
    vendor_name, email, phone, company_name, department, supplier_group, supplier_category, supplier_location,
    vendor_code, vendor_type, industry, registration_type, currency_code, account_manager_name,
  } = req.body;

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
  if (!EMAIL_REGEX.test(email)) throw new ValidationError('Invalid email format', ['email']);

  // Check duplicate email
  const [existing] = await pool.query('SELECT id FROM vendors WHERE email = ?', [email]);
  if (existing.length > 0) throw new ConflictError('A vendor with this email already exists');

  if (vendor_code) {
    const [dup] = await pool.query('SELECT id FROM vendors WHERE vendor_code = ?', [vendor_code]);
    if (dup.length > 0) throw new ConflictError('A vendor with this vendor_code already exists');
  }

  const vendorId = uuidv4();
  const vendorNumber = 'VND-' + Date.now().toString(36).toUpperCase();
  const vendorCodeAuto = await autoVendorCode();
  const plainPassword = generatePassword();
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  // Insert vendor
  await pool.query(
    `INSERT INTO vendors (id, vendor_number, vendor_name, email, phone, company_name, department, supplier_group, supplier_category, supplier_location, status, created_by,
       vendor_code, vendor_code_auto, vendor_type, industry, registration_type, currency_code, account_manager_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [vendorId, vendorNumber, vendor_name, email, phone, company_name, department, supplier_group, supplier_category, supplier_location, req.user.id,
      vendor_code || null, vendorCodeAuto, vendor_type || null, industry || null, registration_type || null, currency_code || 'INR', account_manager_name || null]
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
      vendor_code: vendor_code || null,
      vendor_code_auto: vendorCodeAuto,
      vendor_name,
      email,
      phone,
      company_name,
      department,
      supplier_group,
      supplier_category,
      supplier_location,
      status: 'draft',
      lifecycle_stage: 'onboarding',
      temporary_password: plainPassword,
    },
  });
}));

// POST /api/vendors/import — Bulk create vendors from an Excel file (MDM admin only)
router.post('/import', authenticate, requireRole('mdm_admin'), excelUpload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new ValidationError('Excel file is required');

  const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (rawRows.length === 0) throw new ValidationError('Excel file has no data rows');

  const created = [];
  const skipped = [];

  for (let i = 0; i < rawRows.length; i++) {
    const rowNum = i + 2; // +1 for header row, +1 for 1-indexing
    const row = {};
    Object.entries(rawRows[i]).forEach(([key, value]) => {
      row[normalizeHeader(key)] = typeof value === 'string' ? value.trim() : value;
    });

    const missing = REQUIRED_IMPORT_FIELDS.filter(f => !row[f]);
    if (missing.length > 0) {
      skipped.push({ row: rowNum, reason: `Missing: ${missing.join(', ')}` });
      continue;
    }
    if (!EMAIL_REGEX.test(row.email)) {
      skipped.push({ row: rowNum, reason: 'Invalid email format' });
      continue;
    }

    const [existing] = await pool.query('SELECT id FROM vendors WHERE email = ?', [row.email]);
    if (existing.length > 0) {
      skipped.push({ row: rowNum, reason: `Vendor with email ${row.email} already exists` });
      continue;
    }

    const vendorId = uuidv4();
    const vendorNumber = 'VND-' + Date.now().toString(36).toUpperCase() + i;
    const plainPassword = generatePassword();
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    await pool.query(
      `INSERT INTO vendors (id, vendor_number, vendor_name, email, phone, company_name, department, supplier_group, supplier_category, supplier_location, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
      [vendorId, vendorNumber, row.vendor_name, row.email, row.phone, row.company_name, row.department, row.supplier_group, row.supplier_category, row.supplier_location, req.user.id]
    );

    const userId = uuidv4();
    await pool.query(
      `INSERT INTO users (id, email, password_hash, role, vendor_id, must_reset_password, full_name)
       VALUES (?, ?, ?, 'vendor', ?, TRUE, ?)`,
      [userId, row.email, passwordHash, vendorId, row.vendor_name]
    );

    created.push({ row: rowNum, vendor_number: vendorNumber, vendor_name: row.vendor_name, email: row.email });
  }

  res.status(201).json({ success: true, data: { created, skipped, total: rawRows.length } });
}));

// GET /api/vendors — List vendors with filtering and pagination
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { status, name, phone, email, vendor_type, risk_category, lifecycle_stage, blacklist_flag, page = 1, limit = 10 } = req.query;
  let sql = 'SELECT id, vendor_number, vendor_code, vendor_code_auto, vendor_name, email, phone, company_name, department, supplier_group, supplier_category, supplier_location, status, vendor_type, industry, risk_category, lifecycle_stage, blacklist_flag, preferred_vendor_flag, created_at, updated_at FROM vendors WHERE 1=1';
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
  if (vendor_type) { sql += ' AND vendor_type = ?'; params.push(vendor_type); }
  if (risk_category) { sql += ' AND risk_category = ?'; params.push(risk_category); }
  if (lifecycle_stage) { sql += ' AND lifecycle_stage = ?'; params.push(lifecycle_stage); }
  if (blacklist_flag !== undefined) { sql += ' AND blacklist_flag = ?'; params.push(blacklist_flag === 'true' || blacklist_flag === '1'); }

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
    phone1, phone2, email1, email2, addresses, bank_accounts,
    vendor_code, vendor_type, industry, registration_type, credit_rating, credit_limit, payment_terms_id,
    currency_code, risk_category, blacklist_flag, blacklist_reason, compliance_expiry_dates,
    geo_latitude, geo_longitude, serviceable_regions, account_manager_name, preferred_vendor_flag,
  } = req.body;

  if (vendor_code) {
    const [dup] = await pool.query('SELECT id FROM vendors WHERE vendor_code = ? AND id != ?', [vendor_code, id]);
    if (dup.length > 0) throw new ConflictError('A vendor with this vendor_code already exists');
  }

  // Update all editable fields (admin can update everything except email which is login key)
  await pool.query(
    `UPDATE vendors SET vendor_name=?, phone=?, company_name=?, department=?, supplier_group=?, supplier_category=?, supplier_location=?, gst_number=?, pan_number=?, trade_name=?, legal_name=?, msme_type=?, itr_filing_status=?, phone1=?, phone2=?, email1=?, email2=?,
       vendor_code=?, vendor_type=?, industry=?, registration_type=?, gst_validation_status=?, pan_validation_status=?,
       credit_rating=?, credit_limit=?, payment_terms_id=?, currency_code=?, risk_category=?, blacklist_flag=?, blacklist_reason=?,
       compliance_expiry_dates=?, geo_latitude=?, geo_longitude=?, serviceable_regions=?, account_manager_name=?, preferred_vendor_flag=?
     WHERE id=?`,
    [vendor_name, phone, company_name, department, supplier_group, supplier_category, supplier_location, gst_number || null, pan_number || null, trade_name || null, legal_name || null, msme_type || null, itr_filing_status || null, phone1 || null, phone2 || null, email1 || null, email2 || null,
      vendor_code || null, vendor_type || null, industry || null, registration_type || null, gstValidationStatus(gst_number), panValidationStatus(pan_number),
      credit_rating || null, credit_limit ?? null, payment_terms_id || null, currency_code || 'INR', risk_category || null, !!blacklist_flag, blacklist_reason || null,
      compliance_expiry_dates ? JSON.stringify(compliance_expiry_dates) : null, geo_latitude ?? null, geo_longitude ?? null, serviceable_regions ? JSON.stringify(serviceable_regions) : null, account_manager_name || null, !!preferred_vendor_flag,
      id]
  );

  await syncLifecycleStage(id);

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

  const {
    gst_number, pan_number, trade_name, legal_name, msme_type, itr_filing_status, phone1, phone2, email1, email2, addresses, bank_accounts,
    vendor_type, industry, registration_type, currency_code, geo_latitude, geo_longitude, serviceable_regions, compliance_expiry_dates,
  } = req.body;

  // Update business fields (vendor self-onboarding cannot set internal governance fields
  // like credit_limit, risk_category, or blacklist_flag — those remain admin-only)
  await pool.query(
    `UPDATE vendors SET gst_number = ?, pan_number = ?, trade_name = ?, legal_name = ?, msme_type = ?, itr_filing_status = ?, phone1 = ?, phone2 = ?, email1 = ?, email2 = ?,
       gst_validation_status = ?, pan_validation_status = ?, vendor_type = ?, industry = ?, registration_type = ?, currency_code = ?,
       geo_latitude = ?, geo_longitude = ?, serviceable_regions = ?, compliance_expiry_dates = ?
     WHERE id = ?`,
    [gst_number || null, pan_number || null, trade_name || null, legal_name || null, msme_type || null, itr_filing_status || null, phone1 || null, phone2 || null, email1 || null, email2 || null,
      gstValidationStatus(gst_number), panValidationStatus(pan_number), vendor_type || null, industry || null, registration_type || null, currency_code || 'INR',
      geo_latitude ?? null, geo_longitude ?? null, serviceable_regions ? JSON.stringify(serviceable_regions) : null, compliance_expiry_dates ? JSON.stringify(compliance_expiry_dates) : null,
      id]
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
  await syncLifecycleStage(id);
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
  await syncLifecycleStage(id);
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
  await syncLifecycleStage(id);
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
  await syncLifecycleStage(id);
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
  await syncLifecycleStage(id);

  // Deactivate associated user account
  await pool.query('UPDATE users SET is_active = FALSE WHERE vendor_id = ?', [id]);

  res.json({ success: true, message: 'Vendor deactivated' });
}));

// DELETE /api/vendors/:id — Permanently delete a vendor (admin only)
// Blocked if the vendor has transactional history (POs, ASNs, RFQ activity, tickets) — deactivate those instead.
router.delete('/:id', authenticate, requireRole('mdm_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [rows] = await pool.query('SELECT id FROM vendors WHERE id = ?', [id]);
  if (rows.length === 0) throw new NotFoundError('Vendor not found');

  const checks = [
    ['purchase_orders', 'purchase orders'],
    ['asns', 'ASNs'],
    ['ticket_vendors', 'support tickets'],
    ['rfq_vendors', 'RFQ invitations'],
    ['vendor_bids', 'RFQ bids'],
    ['price_history', 'price history'],
  ];
  for (const [table, label] of checks) {
    const [[{ count }]] = await pool.query(`SELECT COUNT(*) as count FROM ${table} WHERE vendor_id = ?`, [id]);
    if (count > 0) throw new ValidationError(`Cannot delete: vendor has existing ${label}. Deactivate the vendor instead.`);
  }

  await pool.query('DELETE FROM vendor_risk_scores WHERE vendor_id = ?', [id]);
  await pool.query('DELETE FROM vendor_esg WHERE vendor_id = ?', [id]);
  await pool.query('DELETE FROM users WHERE vendor_id = ?', [id]);
  await pool.query('DELETE FROM vendors WHERE id = ?', [id]); // cascades addresses, bank accounts, documents

  res.json({ success: true, message: 'Vendor deleted' });
}));

module.exports = router;
