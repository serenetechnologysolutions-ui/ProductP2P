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
const { resolveCompanyAccess } = require('../company/company.middleware');
const { withTransaction } = require('../../common/db');
const { getVendorSummary } = require('./vendor-summary.service');
const { getComplianceStatus, syncComplianceExceptions } = require('./vendor-compliance.service');
const { calculateVendorRiskScore } = require('../risk/risk.service');

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

// Vendor Segmentation — a strategic sourcing classification, distinct from
// preferred_vendor_flag (a simple "ok to auto/direct-PO" boolean) and
// risk_category (a risk axis). Fixed, code-level values (drives PR sourcing
// recommendation + RFQ vendor ordering branching below), not a sub-master.
const VENDOR_SEGMENTS = ['strategic', 'preferred', 'approved', 'tactical'];

// `vendor_addresses`/`vendor_bank_accounts` have several NOT NULL columns
// (line1/city/state/country/pin_code; ifsc_code/account_number/
// account_holder_name/bank_name/branch/city/state/country) that the
// create/edit forms collect via plain, non-required Select/Input rows — a
// row left incomplete previously reached the INSERT and failed on the DB's
// own NOT NULL constraint, surfacing as an opaque 500 instead of a clear
// "which field, which row" message. Validated explicitly here so the error
// is actionable, and so it's caught before anything is written, not after
// a partial delete-then-reinsert.
function validateAddressRows(addresses) {
  const required = ['line1', 'city', 'state', 'country', 'pin_code'];
  (addresses || []).forEach((addr, i) => {
    const missing = required.filter(f => !addr[f]);
    if (missing.length > 0) throw new ValidationError(`Address ${i + 1} is missing: ${missing.join(', ')}`, missing);
  });
}
function validateBankAccountRows(bankAccounts) {
  const required = ['ifsc_code', 'account_number', 'account_holder_name', 'bank_name', 'branch', 'city', 'state', 'country'];
  (bankAccounts || []).forEach((bank, i) => {
    const missing = required.filter(f => !bank[f]);
    if (missing.length > 0) throw new ValidationError(`Bank account ${i + 1} is missing: ${missing.join(', ')}`, missing);
  });
}

// vendor_code_auto: system-generated unique sequential code, separate from the
// timestamp-based vendor_number and from the admin-entered (manual) vendor_code.
async function autoVendorCode(conn) {
  const [[{ maxNum }]] = await (conn || pool).query(
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

// lifecycle_stage is derived, not user-set: blacklisted vendors and vendors
// with an expired compliance document (Vendor Compliance Engine) are always
// 'blocked'; otherwise it tracks the approval status. 'dormant' has no
// automatic trigger today (it would need an inactivity job) so it's only
// reachable via direct admin override, which this helper does not produce.
function computeLifecycleStage(status, blacklistFlag, complianceBlocked) {
  if (blacklistFlag || complianceBlocked) return 'blocked';
  if (status === 'approved') return 'active';
  if (status === 'inactive') return 'blocked';
  return 'onboarding';
}

async function syncLifecycleStage(vendorId) {
  const [[row]] = await pool.query('SELECT status, blacklist_flag FROM vendors WHERE id = ?', [vendorId]);
  if (!row) return;
  // Also raises/auto-resolves compliance_expiry exceptions as a side effect —
  // every one of this function's existing call sites (admin edit, onboarding
  // save, submit/review/approve/reject/deactivate) now keeps compliance
  // tracking current for free, with no extra call needed at each site.
  const compliance = await syncComplianceExceptions(vendorId);
  const stage = computeLifecycleStage(row.status, !!row.blacklist_flag, compliance.is_blocked);
  await pool.query('UPDATE vendors SET lifecycle_stage = ? WHERE id = ?', [stage, vendorId]);
}

// POST /api/vendors — Create a new vendor (MDM admin or System admin)
router.post('/', authenticate, requireRole('mdm_admin', 'system_admin'), resolveCompanyAccess, asyncHandler(async (req, res) => {
  const {
    vendor_name, email, phone, company_name, department, supplier_group, supplier_category, supplier_location,
    vendor_code, vendor_type, industry, registration_type, currency_code, account_manager_name,
    company_ids,
  } = req.body;

  // Multi-company isolation: MDM_Admin must provide at least one company mapping
  // from their accessible companies. System_Admin can optionally provide company_ids.
  if (req.companyIds !== null) {
    // Non-system_admin (MDM_Admin): require at least one company_id
    if (!company_ids || !Array.isArray(company_ids) || company_ids.length === 0) {
      throw new ValidationError('At least one company mapping is required', ['company_ids']);
    }
    // Validate all provided company_ids are in the user's accessible companies
    const unauthorized = company_ids.filter(cid => !req.companyIds.includes(cid));
    if (unauthorized.length > 0) {
      throw new AuthorizationError('You do not have access to one or more specified companies');
    }
  }

  // Validate mandatory fields
  const missing = [];
  if (!vendor_name) missing.push('vendor_name');
  if (!email) missing.push('email');
  if (!phone) missing.push('phone');
  if (!company_name) missing.push('company_name');
  if (!department) missing.push('department');
  if (!supplier_category) missing.push('supplier_category');
  if (!supplier_location) missing.push('supplier_location');
  if (missing.length > 0) throw new ValidationError('Missing mandatory fields', missing);

  // Validate email format
  if (!EMAIL_REGEX.test(email)) throw new ValidationError('Invalid email format', ['email']);

  // Check duplicate email — both against vendors AND users, since vendor
  // creation also creates a login: a vendor row can be unique on its own
  // table yet still collide with an existing user account (admin, or a
  // different vendor's login) on the shared users.email UNIQUE constraint.
  // Checking only `vendors.email` let that second collision reach the
  // users INSERT below, which failed with an unhandled 500 *after* the
  // vendors row had already committed — an orphaned, login-less "ghost"
  // vendor. The transaction below is the real fix (belt-and-suspenders
  // against a race between this check and the inserts); this check just
  // turns the common case into a clean 409 instead of a 500.
  const [existing] = await pool.query('SELECT id FROM vendors WHERE email = ?', [email]);
  if (existing.length > 0) throw new ConflictError('A vendor with this email already exists');
  const [existingUser] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  if (existingUser.length > 0) throw new ConflictError('A user account with this email already exists');

  if (vendor_code) {
    const [dup] = await pool.query('SELECT id FROM vendors WHERE vendor_code = ?', [vendor_code]);
    if (dup.length > 0) throw new ConflictError('A vendor with this vendor_code already exists');
  }

  const vendorId = uuidv4();
  const vendorNumber = 'VND-' + Date.now().toString(36).toUpperCase();
  const plainPassword = generatePassword();
  const passwordHash = await bcrypt.hash(plainPassword, 10);
  let vendorCodeAuto;

  await withTransaction(async (conn) => {
    vendorCodeAuto = await autoVendorCode(conn);
    await conn.query(
      `INSERT INTO vendors (id, vendor_number, vendor_name, email, phone, company_name, department, supplier_group, supplier_category, supplier_location, status, created_by,
         vendor_code, vendor_code_auto, vendor_type, industry, registration_type, currency_code, account_manager_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [vendorId, vendorNumber, vendor_name, email, phone, company_name, department, supplier_group, supplier_category, supplier_location, req.user.id,
        vendor_code || null, vendorCodeAuto, vendor_type || null, industry || null, registration_type || null, currency_code || 'INR', account_manager_name || null]
    );

    // Create user account for vendor — same transaction, so a failure here
    // (e.g. a concurrent request just took this exact email) rolls the
    // vendor insert back too, instead of leaving it orphaned.
    const userId = uuidv4();
    await conn.query(
      `INSERT INTO users (id, email, password_hash, role, vendor_id, must_reset_password, full_name)
       VALUES (?, ?, ?, 'vendor', ?, TRUE, ?)`,
      [userId, email, passwordHash, vendorId, vendor_name]
    );

    // Multi-company isolation: create vendor-company mappings if company_ids provided
    if (company_ids && Array.isArray(company_ids) && company_ids.length > 0) {
      for (const companyId of company_ids) {
        await conn.query(
          'INSERT INTO vendor_company_mapping (id, vendor_id, company_id) VALUES (?, ?, ?)',
          [uuidv4(), vendorId, companyId]
        );
      }
    }
  });

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
    const [existingUser] = await pool.query('SELECT id FROM users WHERE email = ?', [row.email]);
    if (existingUser.length > 0) {
      skipped.push({ row: rowNum, reason: `A user account with email ${row.email} already exists` });
      continue;
    }

    const vendorId = uuidv4();
    const vendorNumber = 'VND-' + Date.now().toString(36).toUpperCase() + i;
    const plainPassword = generatePassword();
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    // Each row's vendor+user pair commits atomically — a failure partway
    // through one row rolls back just that row, not the rows already
    // committed before it (one bad row shouldn't undo a whole batch).
    try {
      await withTransaction(async (conn) => {
        await conn.query(
          `INSERT INTO vendors (id, vendor_number, vendor_name, email, phone, company_name, department, supplier_group, supplier_category, supplier_location, status, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
          [vendorId, vendorNumber, row.vendor_name, row.email, row.phone, row.company_name, row.department, row.supplier_group, row.supplier_category, row.supplier_location, req.user.id]
        );

        const userId = uuidv4();
        await conn.query(
          `INSERT INTO users (id, email, password_hash, role, vendor_id, must_reset_password, full_name)
           VALUES (?, ?, ?, 'vendor', ?, TRUE, ?)`,
          [userId, row.email, passwordHash, vendorId, row.vendor_name]
        );
      });
      created.push({ row: rowNum, vendor_number: vendorNumber, vendor_name: row.vendor_name, email: row.email });
    } catch (err) {
      skipped.push({ row: rowNum, reason: `Failed to create: ${err.message}` });
    }
  }

  res.status(201).json({ success: true, data: { created, skipped, total: rawRows.length } });
}));

// GET /api/vendors — List vendors with filtering and pagination
// Multi-Company Isolation: resolveCompanyAccess sets req.companyIds.
// Non-system_admin users see only vendors mapped to their accessible companies
// via vendor_company_mapping. The optional ?company_id=X further narrows to a
// single company (e.g. PO form vendor dropdown).
router.get('/', authenticate, resolveCompanyAccess, asyncHandler(async (req, res) => {
  const { status, name, phone, email, vendor_type, risk_category, lifecycle_stage, blacklist_flag, vendor_segment, sort_by_segment, company_id, page = 1, limit = 10 } = req.query;

  // Build the base query. When company filtering is needed, we JOIN
  // vendor_company_mapping and use the alias `v` for the vendors table.
  const companyIds = req.companyIds; // null for system_admin, array for others
  const needsCompanyJoin = companyIds !== null || company_id;

  let fromClause;
  let whereClause = ' WHERE 1=1';
  const params = [];

  if (needsCompanyJoin) {
    fromClause = 'FROM vendors v INNER JOIN vendor_company_mapping vcm ON v.id = vcm.vendor_id';
    // Filter by user's accessible companies (non-system_admin)
    if (companyIds !== null) {
      if (companyIds.length === 0) {
        // User has no company access — return empty result
        return res.json({ success: true, data: [], pagination: { current: parseInt(page), pageSize: parseInt(limit), total: 0 } });
      }
      whereClause += ` AND vcm.company_id IN (${companyIds.map(() => '?').join(',')})`;
      params.push(...companyIds);
    }
    // Further filter by specific company_id query param
    if (company_id) {
      whereClause += ' AND vcm.company_id = ?';
      params.push(company_id);
    }
  } else {
    fromClause = 'FROM vendors v';
  }

  // Use the alias 'v' consistently for all column references
  let sql = `SELECT DISTINCT v.id, v.vendor_number, v.vendor_code, v.vendor_code_auto, v.vendor_name, v.email, v.phone, v.company_name, v.department, v.supplier_group, v.supplier_category, v.supplier_location, v.status, v.vendor_type, v.industry, v.risk_category, v.vendor_segment, v.lifecycle_stage, v.blacklist_flag, v.preferred_vendor_flag, v.created_at, v.updated_at ${fromClause}${whereClause}`;

  // Vendor isolation: vendors can only see themselves
  if (req.user.role === 'vendor') {
    sql += ' AND v.id = ?';
    params.push(req.user.vendorId);
  }

  if (status) { sql += ' AND v.status = ?'; params.push(status); }
  if (name) { sql += ' AND v.vendor_name LIKE ?'; params.push(`%${name}%`); }
  if (phone) { sql += ' AND v.phone LIKE ?'; params.push(`%${phone}%`); }
  if (email) { sql += ' AND v.email LIKE ?'; params.push(`%${email}%`); }
  if (vendor_type) { sql += ' AND v.vendor_type = ?'; params.push(vendor_type); }
  if (risk_category) { sql += ' AND v.risk_category = ?'; params.push(risk_category); }
  if (lifecycle_stage) { sql += ' AND v.lifecycle_stage = ?'; params.push(lifecycle_stage); }
  if (blacklist_flag !== undefined) { sql += ' AND v.blacklist_flag = ?'; params.push(blacklist_flag === 'true' || blacklist_flag === '1'); }
  if (vendor_segment) { sql += ' AND v.vendor_segment = ?'; params.push(vendor_segment); }

  const countSql = sql.replace(/SELECT .* FROM/, 'SELECT COUNT(DISTINCT v.id) as total FROM');
  const [countRows] = await pool.query(countSql, params);
  const total = countRows[0].total;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  // Vendor Segmentation: opt-in ordering for callers that want their best-fit
  // vendors surfaced first (e.g. RFQ's "Invite Vendors" picker) — every other
  // caller omits this param and keeps the existing created_at DESC ordering.
  if (sort_by_segment === 'true' || sort_by_segment === '1') {
    sql += ` ORDER BY CASE v.vendor_segment
               WHEN 'strategic' THEN 1 WHEN 'preferred' THEN 2 WHEN 'approved' THEN 3 WHEN 'tactical' THEN 4 ELSE 5
             END, v.created_at DESC LIMIT ? OFFSET ?`;
  } else {
    sql += ' ORDER BY v.created_at DESC LIMIT ? OFFSET ?';
  }
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

// GET /api/vendors/:id/summary — Vendor 360 Profile. Every field here is
// computed on read from purchase_orders/asns (see vendor-summary.service.js) —
// nothing here is a stored column on the vendor record.
router.get('/:id/summary', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (req.user.role === 'vendor' && req.user.vendorId !== id) throw new AuthorizationError();
  const data = await getVendorSummary(id);
  res.json({ success: true, data });
}));

// GET /api/vendors/:id/compliance — Vendor Compliance Engine: per-document
// expired/expiring_soon/ok status against the configured alert window.
router.get('/:id/compliance', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (req.user.role === 'vendor' && req.user.vendorId !== id) throw new AuthorizationError();
  const data = await getComplianceStatus(id);
  res.json({ success: true, data });
}));

// GET /api/vendors/:id/risk-actions — Vendor Risk Actionability: turns the
// existing risk score + compliance status into concrete, rule-based "what to
// do about it" recommendations, rather than leaving the score visible but
// inert. No new scoring — reuses calculateVendorRiskScore() and
// getComplianceStatus() verbatim, the same functions the Risk Dashboard and
// Vendor Compliance tab already call.
router.get('/:id/risk-actions', authenticate, requireRole('mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [[vendor]] = await pool.query('SELECT vendor_name, supplier_category, blacklist_flag FROM vendors WHERE id = ?', [id]);
  if (!vendor) throw new NotFoundError('Vendor not found');

  const risk = await calculateVendorRiskScore(id);
  const compliance = await getComplianceStatus(id);
  const actions = [];

  if (risk.risk_level === 'high' && Number(risk.rejection_score) >= Number(risk.delay_score) && Number(risk.rejection_score) >= Number(risk.audit_score)) {
    const [suggested] = await pool.query(
      `SELECT id as vendor_id, vendor_name FROM vendors
       WHERE supplier_category = ? AND status = 'approved' AND blacklist_flag = FALSE AND id != ?
       ORDER BY vendor_name LIMIT 5`,
      [vendor.supplier_category, id]
    );
    actions.push({ action: 'replace_vendor', reason: `High rejection rate (rejection score ${risk.rejection_score}/100) is the dominant driver of this vendor's High risk level.`, suggested_vendors: suggested });
  }

  if (Number(risk.dependency_risk_score) >= 60) {
    const [[{ poCount }]] = await pool.query(
      "SELECT COUNT(*) as poCount FROM purchase_orders WHERE vendor_id = ? AND status = 'open' AND created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)",
      [id]
    );
    actions.push({ action: 'reduce_dependency', reason: `${poCount} open PO(s) placed with this vendor in the last 90 days — concentration risk if this vendor is disrupted.`, suggested_vendors: [] });
  }

  if (Number(risk.audit_score) >= 45 || compliance.is_blocked || vendor.blacklist_flag) {
    const reason = vendor.blacklist_flag
      ? 'Vendor is blacklisted.'
      : compliance.is_blocked
        ? `Expired compliance document(s): ${compliance.documents.filter(d => d.status === 'expired').map(d => d.label).join(', ')}.`
        : `${risk.audit_score >= 45 ? 'Open audit findings' : ''} indicate an audit is overdue.`;
    actions.push({ action: 'trigger_audit', reason, suggested_vendors: [] });
  }

  res.json({ success: true, data: actions });
}));

// POST /api/vendors/compliance/recalculate — bulk re-check every vendor's
// compliance expiry (auto-block + raise/resolve exceptions). Manual trigger,
// same pattern as POST /risk/calculate — there's no scheduled job in this app.
router.post('/compliance/recalculate', authenticate, requireRole('mdm_admin'), asyncHandler(async (req, res) => {
  const [vendors] = await pool.query('SELECT id FROM vendors');
  for (const vendor of vendors) { await syncLifecycleStage(vendor.id); }
  res.json({ success: true, message: `Compliance re-checked for ${vendors.length} vendor(s)` });
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
    geo_latitude, geo_longitude, serviceable_regions, account_manager_name, preferred_vendor_flag, vendor_segment,
    internal_company_id,
  } = req.body;

  if (vendor_code) {
    const [dup] = await pool.query('SELECT id FROM vendors WHERE vendor_code = ? AND id != ?', [vendor_code, id]);
    if (dup.length > 0) throw new ConflictError('A vendor with this vendor_code already exists');
  }
  if (vendor_segment && !VENDOR_SEGMENTS.includes(vendor_segment)) {
    throw new ValidationError(`vendor_segment must be one of: ${VENDOR_SEGMENTS.join(', ')}`, ['vendor_segment']);
  }
  validateAddressRows(addresses);
  validateBankAccountRows(bank_accounts);

  // Update all editable fields (admin can update everything except email which is login key),
  // plus replace addresses/bank accounts (delete-then-reinsert) in the SAME
  // transaction — without it, a failure partway through re-inserting addresses
  // (or bank accounts) would leave the vendor updated but with addresses
  // already deleted and only some of the new ones written.
  await withTransaction(async (conn) => {
    await conn.query(
      `UPDATE vendors SET vendor_name=?, phone=?, company_name=?, department=?, supplier_group=?, supplier_category=?, supplier_location=?, gst_number=?, pan_number=?, trade_name=?, legal_name=?, msme_type=?, itr_filing_status=?, phone1=?, phone2=?, email1=?, email2=?,
         vendor_code=?, vendor_type=?, industry=?, registration_type=?, gst_validation_status=?, pan_validation_status=?,
         credit_rating=?, credit_limit=?, payment_terms_id=?, currency_code=?, risk_category=?, blacklist_flag=?, blacklist_reason=?,
         compliance_expiry_dates=?, geo_latitude=?, geo_longitude=?, serviceable_regions=?, account_manager_name=?, preferred_vendor_flag=?, vendor_segment=?, internal_company_id=?
       WHERE id=?`,
      [vendor_name, phone, company_name, department, supplier_group, supplier_category, supplier_location, gst_number || null, pan_number || null, trade_name || null, legal_name || null, msme_type || null, itr_filing_status || null, phone1 || null, phone2 || null, email1 || null, email2 || null,
        vendor_code || null, vendor_type || null, industry || null, registration_type || null, gstValidationStatus(gst_number), panValidationStatus(pan_number),
        credit_rating || null, credit_limit ?? null, payment_terms_id || null, currency_code || 'INR', risk_category || null, !!blacklist_flag, blacklist_reason || null,
        compliance_expiry_dates ? JSON.stringify(compliance_expiry_dates) : null,
        (geo_latitude !== '' && geo_latitude != null && !isNaN(geo_latitude)) ? Number(geo_latitude) : null,
        (geo_longitude !== '' && geo_longitude != null && !isNaN(geo_longitude)) ? Number(geo_longitude) : null,
        serviceable_regions ? JSON.stringify(serviceable_regions) : null, account_manager_name || null, !!preferred_vendor_flag, vendor_segment || 'approved', internal_company_id || null,
        id]
    );

    // Replace addresses if provided
    if (addresses && Array.isArray(addresses)) {
      await conn.query('DELETE FROM vendor_addresses WHERE vendor_id = ?', [id]);
      for (const addr of addresses) {
        await conn.query(
          'INSERT INTO vendor_addresses (id, vendor_id, line1, line2, city, state, country, pin_code, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [uuidv4(), id, addr.line1, addr.line2 || null, addr.city, addr.state, addr.country || 'India', addr.pin_code, addr.tags ? JSON.stringify(addr.tags) : null]
        );
      }
    }

    // Replace bank accounts if provided
    if (bank_accounts && Array.isArray(bank_accounts)) {
      await conn.query('DELETE FROM vendor_bank_accounts WHERE vendor_id = ?', [id]);
      for (const bank of bank_accounts) {
        await conn.query(
          'INSERT INTO vendor_bank_accounts (id, vendor_id, ifsc_code, account_number, account_holder_name, bank_name, branch, city, state, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [uuidv4(), id, bank.ifsc_code, bank.account_number, bank.account_holder_name, bank.bank_name, bank.branch, bank.city, bank.state, bank.country || 'India']
        );
      }
    }
  });

  // Lifecycle/compliance recompute stays outside the transaction — it's
  // derived state (self-correcting on the next sync), not primary data, and
  // syncComplianceExceptions has its own call sites that don't carry a conn.
  await syncLifecycleStage(id);

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

  validateAddressRows(addresses);
  validateBankAccountRows(bank_accounts);

  // Update business fields (vendor self-onboarding cannot set internal governance fields
  // like credit_limit, risk_category, or blacklist_flag — those remain admin-only),
  // plus replace addresses/bank accounts in the same transaction — see the
  // identical comment on PUT /:id above for why.
  await withTransaction(async (conn) => {
    await conn.query(
      `UPDATE vendors SET gst_number = ?, pan_number = ?, trade_name = ?, legal_name = ?, msme_type = ?, itr_filing_status = ?, phone1 = ?, phone2 = ?, email1 = ?, email2 = ?,
         gst_validation_status = ?, pan_validation_status = ?, vendor_type = ?, industry = ?, registration_type = ?, currency_code = ?,
         geo_latitude = ?, geo_longitude = ?, serviceable_regions = ?, compliance_expiry_dates = ?
       WHERE id = ?`,
      [gst_number || null, pan_number || null, trade_name || null, legal_name || null, msme_type || null, itr_filing_status || null, phone1 || null, phone2 || null, email1 || null, email2 || null,
        gstValidationStatus(gst_number), panValidationStatus(pan_number), vendor_type || null, industry || null, registration_type || null, currency_code || 'INR',
        (geo_latitude !== '' && geo_latitude != null && !isNaN(geo_latitude)) ? Number(geo_latitude) : null,
        (geo_longitude !== '' && geo_longitude != null && !isNaN(geo_longitude)) ? Number(geo_longitude) : null,
        serviceable_regions ? JSON.stringify(serviceable_regions) : null, compliance_expiry_dates ? JSON.stringify(compliance_expiry_dates) : null,
        id]
    );

    // Replace addresses (delete + re-insert)
    if (addresses && Array.isArray(addresses)) {
      await conn.query('DELETE FROM vendor_addresses WHERE vendor_id = ?', [id]);
      for (const addr of addresses) {
        await conn.query(
          'INSERT INTO vendor_addresses (id, vendor_id, line1, line2, city, state, country, pin_code, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [uuidv4(), id, addr.line1, addr.line2 || null, addr.city, addr.state, addr.country || 'India', addr.pin_code, addr.tags ? JSON.stringify(addr.tags) : null]
        );
      }
    }

    // Replace bank accounts (delete + re-insert)
    if (bank_accounts && Array.isArray(bank_accounts)) {
      await conn.query('DELETE FROM vendor_bank_accounts WHERE vendor_id = ?', [id]);
      for (const bank of bank_accounts) {
        await conn.query(
          'INSERT INTO vendor_bank_accounts (id, vendor_id, ifsc_code, account_number, account_holder_name, bank_name, branch, city, state, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [uuidv4(), id, bank.ifsc_code, bank.account_number, bank.account_holder_name, bank.bank_name, bank.branch, bank.city, bank.state, bank.country || 'India']
        );
      }
    }
  });

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

  // All-or-nothing: a failure partway through (e.g. an FK constraint on one
  // of these tables) must not leave the vendor half-deleted (its risk score
  // gone but the vendor row and login still present, or vice versa).
  await withTransaction(async (conn) => {
    await conn.query('DELETE FROM vendor_risk_scores WHERE vendor_id = ?', [id]);
    await conn.query('DELETE FROM vendor_esg WHERE vendor_id = ?', [id]);
    await conn.query('DELETE FROM users WHERE vendor_id = ?', [id]);
    await conn.query('DELETE FROM vendors WHERE id = ?', [id]); // cascades addresses, bank accounts, documents
  });

  res.json({ success: true, message: 'Vendor deleted' });
}));

module.exports = router;
