const express = require('express');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { ValidationError, NotFoundError, AuthorizationError } = require('../../common/errors');
const { authenticate, requireRole } = require('../auth/auth.middleware');
const { recordAudit } = require('../../common/auditLog');
const { resolveCompanyAccess } = require('./company.middleware');
const { validatePAN, validatePINCode, validateCIN, validateCertificateFile } = require('./company.validators');

// Configure multer for certificate uploads
const uploadDir = path.join(__dirname, '../../../uploads/certificates');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({ dest: uploadDir, limits: { fileSize: 5 * 1024 * 1024 } });

const router = express.Router();

// ─── Organizations ──────────────────────────────────────────────────────
router.get('/organizations', authenticate, requireRole('system_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM organization_master ORDER BY org_name');
  res.json({ success: true, data: rows });
}));

// ─── Companies ───────────────────────────────────────────────────────────
// Module 10: a procurement_admin only ever sees companies they've been
// explicitly granted access to (user_company_access); system_admin/mdm_admin
// see everything, same override convention used everywhere else in this app.
router.get('/', authenticate, requireRole('system_admin', 'mdm_admin', 'procurement_admin'), resolveCompanyAccess, asyncHandler(async (req, res) => {
  let sql = `SELECT c.*, o.org_name FROM company_master c LEFT JOIN organization_master o ON c.organization_id = o.id WHERE 1=1`;
  const params = [];

  // Filter by user's accessible companies (non-system_admin)
  if (req.companyIds !== null) {
    if (req.companyIds.length === 0) return res.json({ success: true, data: [] });
    sql += ` AND c.id IN (${req.companyIds.map(() => '?').join(',')})`;
    params.push(...req.companyIds);
  }

  // Filter by active status when requested (used by dropdown components)
  if (req.query.active_only === 'true') {
    sql += ` AND c.is_active = TRUE`;
  }

  sql += ' ORDER BY c.company_name';
  const [rows] = await pool.query(sql, params);
  res.json({ success: true, data: rows });
}));

// ─── User Company Access grants ──────────────────────────────────────────
router.get('/user-access/:userId', authenticate, requireRole('system_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT uca.*, c.company_name FROM user_company_access uca LEFT JOIN company_master c ON uca.company_id = c.id WHERE uca.user_id = ?`,
    [req.params.userId]
  );
  res.json({ success: true, data: rows });
}));

router.post('/user-access', authenticate, requireRole('system_admin'), asyncHandler(async (req, res) => {
  const { user_id, company_id } = req.body;
  if (!user_id || !company_id) throw new ValidationError('Missing required fields', ['user_id', 'company_id']);

  const [existing] = await pool.query('SELECT id FROM user_company_access WHERE user_id = ? AND company_id = ?', [user_id, company_id]);
  if (existing.length > 0) return res.json({ success: true, data: existing[0] });

  const id = uuidv4();
  await pool.query('INSERT INTO user_company_access (id, user_id, company_id) VALUES (?, ?, ?)', [id, user_id, company_id]);
  await recordAudit(req.user.id, 'grant_access', 'company', company_id, null, { user_id, company_id }, req.ip);
  const [rows] = await pool.query('SELECT * FROM user_company_access WHERE id = ?', [id]);
  res.status(201).json({ success: true, data: rows[0] });
}));

router.delete('/user-access/:id', authenticate, requireRole('system_admin'), asyncHandler(async (req, res) => {
  const [existing] = await pool.query('SELECT * FROM user_company_access WHERE id = ?', [req.params.id]);
  if (existing.length === 0) throw new NotFoundError('Access grant not found');
  await pool.query('DELETE FROM user_company_access WHERE id = ?', [req.params.id]);
  await recordAudit(req.user.id, 'revoke_access', 'company', existing[0].company_id, existing[0], null, req.ip);
  res.json({ success: true, message: 'Access revoked' });
}));

router.post('/', authenticate, requireRole('system_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const { organization_id, company_code, company_name, gstin, address, cin, pan, city, state, pin_code } = req.body;
  if (!organization_id || !company_code || !company_name) {
    throw new ValidationError('Missing required fields', ['organization_id', 'company_code', 'company_name']);
  }

  // Validate statutory fields
  const panError = validatePAN(pan);
  if (panError) throw new ValidationError(panError, ['pan']);
  const pinError = validatePINCode(pin_code);
  if (pinError) throw new ValidationError(pinError, ['pin_code']);
  const cinError = validateCIN(cin);
  if (cinError) throw new ValidationError(cinError, ['cin']);

  const [existing] = await pool.query('SELECT id FROM company_master WHERE company_code = ?', [company_code]);
  if (existing.length > 0) throw new ValidationError(`Company code ${company_code} already exists`);

  const id = uuidv4();
  await pool.query(
    'INSERT INTO company_master (id, organization_id, company_code, company_name, gstin, address, cin, pan, city, state, pin_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, organization_id, company_code, company_name, gstin || null, address || null, cin || null, pan || null, city || null, state || null, pin_code || null]
  );
  const [rows] = await pool.query('SELECT * FROM company_master WHERE id = ?', [id]);
  await recordAudit(req.user.id, 'create', 'company', id, null, rows[0], req.ip);
  res.status(201).json({ success: true, data: rows[0] });
}));

router.put('/:id', authenticate, requireRole('system_admin', 'mdm_admin'), resolveCompanyAccess, asyncHandler(async (req, res) => {
  // MDM_Admin can only edit companies in their access set
  if (req.user.role === 'mdm_admin' && req.companyIds !== null) {
    if (!req.companyIds.includes(req.params.id)) {
      throw new AuthorizationError('You do not have access to this company');
    }
  }

  const { company_name, gstin, address, is_active, cin, pan, city, state, pin_code } = req.body;
  const [existing] = await pool.query('SELECT * FROM company_master WHERE id = ?', [req.params.id]);
  if (existing.length === 0) throw new NotFoundError('Company not found');

  // Validate statutory fields
  const panError = validatePAN(pan);
  if (panError) throw new ValidationError(panError, ['pan']);
  const pinError = validatePINCode(pin_code);
  if (pinError) throw new ValidationError(pinError, ['pin_code']);
  const cinError = validateCIN(cin);
  if (cinError) throw new ValidationError(cinError, ['cin']);

  await pool.query(
    `UPDATE company_master SET company_name = COALESCE(?, company_name), gstin = ?, address = ?, is_active = COALESCE(?, is_active),
     cin = ?, pan = ?, city = ?, state = ?, pin_code = ? WHERE id = ?`,
    [company_name || null, gstin ?? null, address ?? null, is_active === undefined ? null : !!is_active,
     cin ?? null, pan ?? null, city ?? null, state ?? null, pin_code ?? null, req.params.id]
  );
  const [rows] = await pool.query('SELECT * FROM company_master WHERE id = ?', [req.params.id]);
  await recordAudit(req.user.id, 'update', 'company', req.params.id, existing[0], rows[0], req.ip);
  res.json({ success: true, data: rows[0] });
}));

// ─── Certificate Upload ──────────────────────────────────────────────────
router.post('/:id/certificate', authenticate, requireRole('system_admin', 'mdm_admin'), resolveCompanyAccess, upload.single('certificate'), asyncHandler(async (req, res) => {
  // MDM_Admin can only upload for companies in their access set
  if (req.user.role === 'mdm_admin' && req.companyIds !== null) {
    if (!req.companyIds.includes(req.params.id)) {
      throw new AuthorizationError('You do not have access to this company');
    }
  }

  // Validate company exists
  const [existing] = await pool.query('SELECT * FROM company_master WHERE id = ?', [req.params.id]);
  if (existing.length === 0) throw new NotFoundError('Company not found');

  // Validate uploaded file
  if (!req.file) throw new ValidationError('No certificate file uploaded', ['certificate']);
  const fileError = validateCertificateFile(req.file);
  if (fileError) {
    // Remove the uploaded file if validation fails
    fs.unlink(req.file.path, () => {});
    throw new ValidationError(fileError, ['certificate']);
  }

  // Update company record with certificate path
  const certificatePath = req.file.path;
  await pool.query('UPDATE company_master SET certificate_path = ? WHERE id = ?', [certificatePath, req.params.id]);

  const [rows] = await pool.query('SELECT * FROM company_master WHERE id = ?', [req.params.id]);
  await recordAudit(req.user.id, 'upload_certificate', 'company', req.params.id, existing[0], rows[0], req.ip);
  res.json({ success: true, data: rows[0] });
}));

// ─── Business Units ──────────────────────────────────────────────────────
router.get('/:id/business-units', authenticate, requireRole('system_admin', 'mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM business_unit_master WHERE company_id = ? ORDER BY bu_name', [req.params.id]);
  res.json({ success: true, data: rows });
}));

router.post('/:id/business-units', authenticate, requireRole('system_admin'), asyncHandler(async (req, res) => {
  const { bu_code, bu_name } = req.body;
  if (!bu_code || !bu_name) throw new ValidationError('Missing required fields', ['bu_code', 'bu_name']);

  const [company] = await pool.query('SELECT id FROM company_master WHERE id = ?', [req.params.id]);
  if (company.length === 0) throw new NotFoundError('Company not found');

  const id = uuidv4();
  await pool.query('INSERT INTO business_unit_master (id, company_id, bu_code, bu_name) VALUES (?, ?, ?, ?)', [id, req.params.id, bu_code, bu_name]);
  const [rows] = await pool.query('SELECT * FROM business_unit_master WHERE id = ?', [id]);
  res.status(201).json({ success: true, data: rows[0] });
}));

// ─── SAP Mapping ──────────────────────────────────────────────────────────
router.get('/:id/sap-mapping', authenticate, requireRole('system_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM company_sap_mapping WHERE company_id = ?', [req.params.id]);
  res.json({ success: true, data: rows[0] || null });
}));

router.put('/:id/sap-mapping', authenticate, requireRole('system_admin'), asyncHandler(async (req, res) => {
  const { sap_company_code, sap_system_id } = req.body;
  if (!sap_company_code) throw new ValidationError('Missing required field', ['sap_company_code']);

  const [existing] = await pool.query('SELECT id FROM company_sap_mapping WHERE company_id = ?', [req.params.id]);
  if (existing.length === 0) {
    await pool.query(
      'INSERT INTO company_sap_mapping (id, company_id, sap_company_code, sap_system_id) VALUES (?, ?, ?, ?)',
      [uuidv4(), req.params.id, sap_company_code, sap_system_id || null]
    );
  } else {
    await pool.query('UPDATE company_sap_mapping SET sap_company_code = ?, sap_system_id = ? WHERE company_id = ?', [sap_company_code, sap_system_id || null, req.params.id]);
  }
  const [rows] = await pool.query('SELECT * FROM company_sap_mapping WHERE company_id = ?', [req.params.id]);
  res.json({ success: true, data: rows[0] });
}));

// ─── Intercompany visibility ──────────────────────────────────────────────
router.get('/sales-orders', authenticate, requireRole('system_admin', 'mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT so.*, sc.company_name as selling_company_name, bc.company_name as buying_company_name, po.po_number as source_po_number
     FROM sales_orders so
     LEFT JOIN company_master sc ON so.selling_company_id = sc.id
     LEFT JOIN company_master bc ON so.buying_company_id = bc.id
     LEFT JOIN purchase_orders po ON so.source_po_id = po.id
     ORDER BY so.created_at DESC`
  );
  res.json({ success: true, data: rows });
}));

module.exports = router;
