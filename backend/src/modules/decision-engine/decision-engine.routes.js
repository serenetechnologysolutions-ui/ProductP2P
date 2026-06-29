const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { ValidationError, NotFoundError } = require('../../common/errors');
const { authenticate, requireRole } = require('../auth/auth.middleware');
const { evaluateDecisionRules } = require('./decision-engine.service');

const router = express.Router();

const INTERNAL_ROLES = ['procurement_admin', 'mdm_admin', 'system_admin'];
const MODULES = ['pr', 'rfq', 'po', 'invoice'];
const OUTPUT_TYPES = ['best_vendor', 'risk_alert', 'budget_alert', 'cost_insight'];

router.get('/rules', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const { module_name } = req.query;
  let sql = 'SELECT * FROM decision_rules WHERE 1=1';
  const params = [];
  if (module_name) { sql += ' AND module_name = ?'; params.push(module_name); }
  sql += ' ORDER BY module_name, priority';
  const [rows] = await pool.query(sql, params);
  res.json({ success: true, data: rows });
}));

router.post('/rules', authenticate, requireRole('system_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const { rule_name, module_name, conditions, output_type, output_template, priority } = req.body;
  if (!rule_name || !module_name || !output_type) throw new ValidationError('Missing required fields', ['rule_name', 'module_name', 'output_type']);
  if (!MODULES.includes(module_name)) throw new ValidationError(`module_name must be one of: ${MODULES.join(', ')}`);
  if (!OUTPUT_TYPES.includes(output_type)) throw new ValidationError(`output_type must be one of: ${OUTPUT_TYPES.join(', ')}`);

  const id = uuidv4();
  await pool.query(
    'INSERT INTO decision_rules (id, rule_name, module_name, conditions, output_type, output_template, priority) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, rule_name, module_name, conditions ? JSON.stringify(conditions) : null, output_type, output_template ? JSON.stringify(output_template) : null, priority ?? 100]
  );
  const [rows] = await pool.query('SELECT * FROM decision_rules WHERE id = ?', [id]);
  res.status(201).json({ success: true, data: rows[0] });
}));

router.put('/rules/:id', authenticate, requireRole('system_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const { conditions, output_template, priority, is_active } = req.body;
  const [existing] = await pool.query('SELECT id FROM decision_rules WHERE id = ?', [req.params.id]);
  if (existing.length === 0) throw new NotFoundError('Decision rule not found');

  await pool.query(
    'UPDATE decision_rules SET conditions = COALESCE(?, conditions), output_template = COALESCE(?, output_template), priority = COALESCE(?, priority), is_active = COALESCE(?, is_active) WHERE id = ?',
    [conditions !== undefined ? JSON.stringify(conditions) : null, output_template !== undefined ? JSON.stringify(output_template) : null, priority ?? null, is_active === undefined ? null : !!is_active, req.params.id]
  );
  const [rows] = await pool.query('SELECT * FROM decision_rules WHERE id = ?', [req.params.id]);
  res.json({ success: true, data: rows[0] });
}));

// GET /api/decision-engine/outputs — what the engine has produced for a record.
router.get('/outputs', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const { module_name, record_id } = req.query;
  let sql = 'SELECT * FROM decision_outputs WHERE 1=1';
  const params = [];
  if (module_name) { sql += ' AND module_name = ?'; params.push(module_name); }
  if (record_id) { sql += ' AND record_id = ?'; params.push(record_id); }
  sql += ' ORDER BY created_at DESC LIMIT 200';
  const [rows] = await pool.query(sql, params);
  res.json({ success: true, data: rows });
}));

// POST /api/decision-engine/evaluate — on-demand evaluation (also called
// internally from pr.routes.js's submit flow; exposed here too so an admin
// can preview what a rule set would produce for a given context).
router.post('/evaluate', authenticate, requireRole(...INTERNAL_ROLES), asyncHandler(async (req, res) => {
  const { module_name, context } = req.body;
  if (!module_name || !MODULES.includes(module_name)) throw new ValidationError(`module_name must be one of: ${MODULES.join(', ')}`);
  const outputs = await evaluateDecisionRules(module_name, context || {});
  res.json({ success: true, data: outputs });
}));

module.exports = router;
