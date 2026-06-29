const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { ValidationError } = require('../../common/errors');
const { authenticate, requireRole } = require('../auth/auth.middleware');
const { evaluateConditions } = require('../../common/conditions');
const { getFeatureFlagStatus } = require('../../common/featureFlags');

const router = express.Router();

// GET /api/system/feature-flags/status — every seeded flag's enabled state +
// lifecycle stage (experimental/beta/stable), for the System Settings admin
// widget. Read-only; toggling a flag still goes through the existing
// PUT /api/system/settings.
router.get('/feature-flags/status', authenticate, requireRole('system_admin', 'mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const data = await getFeatureFlagStatus();
  res.json({ success: true, data });
}));

// system_admin/mdm_admin always see every field regardless of visible_roles —
// the same top-level-override convention used throughout (workflow step
// approvals, etc.).
const FIELD_VISIBILITY_OVERRIDE_ROLES = ['system_admin', 'mdm_admin'];

function isVisibleToRole(visibleRoles, role) {
  if (FIELD_VISIBILITY_OVERRIDE_ROLES.includes(role)) return true;
  if (!visibleRoles) return true;
  const parsed = typeof visibleRoles === 'string' ? JSON.parse(visibleRoles) : visibleRoles;
  return !Array.isArray(parsed) || parsed.length === 0 || parsed.includes(role);
}

// GET /api/system/settings — Get all system settings
router.get('/settings', authenticate, requireRole('system_admin', 'mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM system_settings ORDER BY setting_key');
  res.json({ success: true, data: rows });
}));

// GET /api/system/settings/:key — single-setting lookup, open to any authenticated
// role (unlike the bulk catalog above), since some settings drive non-admin pages'
// own UI (e.g. procurement_admin needs po_require_pr_reference on the PO screen).
router.get('/settings/:key', authenticate, asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT setting_value FROM system_settings WHERE setting_key = ?', [req.params.key]);
  res.json({ success: true, data: { key: req.params.key, value: rows.length > 0 ? rows[0].setting_value : null } });
}));

// PUT /api/system/settings — Update a setting
router.put('/settings', authenticate, requireRole('system_admin'), asyncHandler(async (req, res) => {
  const { key, value } = req.body;
  if (!key) throw new ValidationError('Missing required field', ['key']);

  const [existing] = await pool.query('SELECT id FROM system_settings WHERE setting_key = ?', [key]);
  if (existing.length === 0) {
    await pool.query('INSERT INTO system_settings (id, setting_key, setting_value) VALUES (?, ?, ?)', [uuidv4(), key, value]);
  } else {
    await pool.query('UPDATE system_settings SET setting_value = ? WHERE setting_key = ?', [value, key]);
  }

  res.json({ success: true, message: 'Setting updated' });
}));

// GET /api/system/usage — System usage statistics
router.get('/usage', authenticate, requireRole('system_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const [[{ totalUsers }]] = await pool.query('SELECT COUNT(*) as totalUsers FROM users');
  const [[{ activeUsers }]] = await pool.query("SELECT COUNT(*) as activeUsers FROM users WHERE is_active = TRUE");
  const [[{ totalVendors }]] = await pool.query('SELECT COUNT(*) as totalVendors FROM vendors');
  const [[{ totalASNs }]] = await pool.query('SELECT COUNT(*) as totalASNs FROM asns');
  const [[{ totalPOs }]] = await pool.query('SELECT COUNT(*) as totalPOs FROM purchase_orders');
  const [[{ totalTickets }]] = await pool.query('SELECT COUNT(*) as totalTickets FROM tickets');
  const [[{ dbSize }]] = await pool.query(
    "SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as dbSize FROM information_schema.tables WHERE table_schema = DATABASE()"
  );

  res.json({
    success: true,
    data: {
      totalUsers,
      activeUsers,
      totalVendors,
      totalASNs,
      totalPOs,
      totalTickets,
      dbSizeMB: dbSize || 0,
    },
  });
}));

// GET /api/system/field-config — All field mandatory/optional settings (admin UI)
router.get('/field-config', authenticate, requireRole('system_admin'), asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM field_requirements ORDER BY module_key, display_order');
  res.json({ success: true, data: rows });
}));

// GET /api/system/field-config/:module — { field_key: is_mandatory } map for
// one module, used by forms at render time. Response SHAPE is unchanged
// (still a flat field_key->boolean map) so every existing caller of
// useFieldConfig keeps working untouched — the boolean itself is now
// "effective" mandatory-ness: the static flag OR a matching condition_rule
// (Conditional Mandatory Fields), evaluated against the request's query
// params as context (e.g. ?total_value=1200000). Fields hidden from the
// caller's role (Role-Based Visibility) are omitted from the map entirely,
// which useFieldConfig already treats as "use the form's own fallback".
router.get('/field-config/:module', authenticate, asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM field_requirements WHERE module_key = ?', [req.params.module]);
  const map = {};
  rows.forEach(r => {
    if (!isVisibleToRole(r.visible_roles, req.user.role)) return;
    map[r.field_key] = !!r.is_mandatory || evaluateConditions(r.condition_rule, req.query);
  });
  res.json({ success: true, data: map });
}));

// GET /api/system/field-config/:module/visibility — { field_key: is_visible }
// map for the caller's own role — a NEW, separate endpoint (not folded into
// the mandatory map above) so existing callers of /field-config/:module are
// completely unaffected by this addition.
router.get('/field-config/:module/visibility', authenticate, asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT field_key, visible_roles FROM field_requirements WHERE module_key = ?', [req.params.module]);
  const map = {};
  rows.forEach(r => { map[r.field_key] = isVisibleToRole(r.visible_roles, req.user.role); });
  res.json({ success: true, data: map });
}));

// PUT /api/system/field-config/:id — update a field's mandatory flag,
// condition rule, and/or visible roles.
router.put('/field-config/:id', authenticate, requireRole('system_admin'), asyncHandler(async (req, res) => {
  const { is_mandatory, condition_rule, visible_roles } = req.body;
  if (typeof is_mandatory !== 'boolean') throw new ValidationError('Missing required field', ['is_mandatory']);

  await pool.query(
    'UPDATE field_requirements SET is_mandatory = ?, condition_rule = COALESCE(?, condition_rule), visible_roles = COALESCE(?, visible_roles) WHERE id = ?',
    [
      is_mandatory,
      condition_rule !== undefined ? JSON.stringify(condition_rule) : null,
      visible_roles !== undefined ? JSON.stringify(visible_roles) : null,
      req.params.id,
    ]
  );
  const [rows] = await pool.query('SELECT * FROM field_requirements WHERE id = ?', [req.params.id]);
  if (rows.length === 0) throw new ValidationError('Field requirement not found');
  res.json({ success: true, data: rows[0] });
}));

// GET /api/system/budget-allocations — list all department/cost-center budget
// allocations for the Budget Allocations admin screen. Includes the
// system-managed committed/consumed/actual columns (read-only context) that
// the Budget Commitment Funnel populates via the PR/PO/ASN flow.
router.get('/budget-allocations', authenticate, requireRole('system_admin', 'mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM budget_allocations ORDER BY fiscal_year DESC, cost_center');
  res.json({ success: true, data: rows });
}));

// POST /api/system/budget-allocations — create a new allocation for a
// cost_center+fiscal_year. committed_amount/consumed_amount/actual_amount are
// not accepted here — they're system-managed by the Budget Commitment Funnel
// (PR approval -> commit, PO -> consume, ASN/Invoice -> actual) and always
// start at 0 for a newly-created allocation.
router.post('/budget-allocations', authenticate, requireRole('system_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const { cost_center, fiscal_year, allocated_amount } = req.body;
  if (!cost_center || !fiscal_year || allocated_amount === undefined) {
    throw new ValidationError('Missing required fields', ['cost_center', 'fiscal_year', 'allocated_amount']);
  }

  const [existing] = await pool.query(
    'SELECT id FROM budget_allocations WHERE cost_center = ? AND fiscal_year = ?',
    [cost_center, fiscal_year]
  );
  if (existing.length > 0) {
    throw new ValidationError(`A budget allocation already exists for ${cost_center} / ${fiscal_year}. Edit it instead of creating a new one.`);
  }

  const id = uuidv4();
  await pool.query(
    'INSERT INTO budget_allocations (id, cost_center, fiscal_year, allocated_amount, committed_amount, consumed_amount, actual_amount) VALUES (?, ?, ?, ?, 0, 0, 0)',
    [id, cost_center, fiscal_year, allocated_amount]
  );
  const [rows] = await pool.query('SELECT * FROM budget_allocations WHERE id = ?', [id]);
  res.status(201).json({ success: true, data: rows[0] });
}));

// PUT /api/system/budget-allocations/:id — revise an allocation's
// allocated_amount only. cost_center/fiscal_year are immutable after creation
// since changing either would orphan the committed/consumed/actual tracking
// already accrued against this row; create a new allocation instead if a
// budget needs to move to a different cost center or fiscal year.
router.put('/budget-allocations/:id', authenticate, requireRole('system_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const { allocated_amount } = req.body;
  if (allocated_amount === undefined) throw new ValidationError('Missing required field', ['allocated_amount']);

  const [existing] = await pool.query('SELECT id FROM budget_allocations WHERE id = ?', [req.params.id]);
  if (existing.length === 0) throw new ValidationError('Budget allocation not found');

  await pool.query('UPDATE budget_allocations SET allocated_amount = ? WHERE id = ?', [allocated_amount, req.params.id]);
  const [rows] = await pool.query('SELECT * FROM budget_allocations WHERE id = ?', [req.params.id]);
  res.json({ success: true, data: rows[0] });
}));

module.exports = router;
