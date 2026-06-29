const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../config/database');
const { asyncHandler } = require('../../common/middleware');
const { ValidationError, NotFoundError } = require('../../common/errors');
const { authenticate, requireRole } = require('../auth/auth.middleware');
const { evaluateActionRules } = require('./action-engine.service');

const router = express.Router();

router.get('/rules', authenticate, requireRole('system_admin', 'mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const { trigger_event } = req.query;
  let sql = 'SELECT * FROM action_rules WHERE 1=1';
  const params = [];
  if (trigger_event) { sql += ' AND trigger_event = ?'; params.push(trigger_event); }
  sql += ' ORDER BY trigger_event, priority';
  const [rows] = await pool.query(sql, params);
  res.json({ success: true, data: rows });
}));

router.post('/rules', authenticate, requireRole('system_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const { rule_name, trigger_event, conditions, recommended_action, action_payload, priority } = req.body;
  if (!rule_name || !trigger_event || !recommended_action) {
    throw new ValidationError('Missing required fields', ['rule_name', 'trigger_event', 'recommended_action']);
  }
  const id = uuidv4();
  await pool.query(
    'INSERT INTO action_rules (id, rule_name, trigger_event, conditions, recommended_action, action_payload, priority) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, rule_name, trigger_event, conditions ? JSON.stringify(conditions) : null, recommended_action, action_payload ? JSON.stringify(action_payload) : null, priority ?? 100]
  );
  const [rows] = await pool.query('SELECT * FROM action_rules WHERE id = ?', [id]);
  res.status(201).json({ success: true, data: rows[0] });
}));

router.put('/rules/:id', authenticate, requireRole('system_admin', 'mdm_admin'), asyncHandler(async (req, res) => {
  const { conditions, action_payload, priority, is_active } = req.body;
  const [existing] = await pool.query('SELECT id FROM action_rules WHERE id = ?', [req.params.id]);
  if (existing.length === 0) throw new NotFoundError('Action rule not found');

  await pool.query(
    'UPDATE action_rules SET conditions = COALESCE(?, conditions), action_payload = COALESCE(?, action_payload), priority = COALESCE(?, priority), is_active = COALESCE(?, is_active) WHERE id = ?',
    [conditions !== undefined ? JSON.stringify(conditions) : null, action_payload !== undefined ? JSON.stringify(action_payload) : null, priority ?? null, is_active === undefined ? null : !!is_active, req.params.id]
  );
  const [rows] = await pool.query('SELECT * FROM action_rules WHERE id = ?', [req.params.id]);
  res.json({ success: true, data: rows[0] });
}));

// POST /api/action-engine/evaluate — preview what a trigger_event/context would recommend.
router.post('/evaluate', authenticate, requireRole('system_admin', 'mdm_admin', 'procurement_admin'), asyncHandler(async (req, res) => {
  const { trigger_event, context } = req.body;
  if (!trigger_event) throw new ValidationError('Missing required field', ['trigger_event']);
  const actions = await evaluateActionRules(trigger_event, context || {});
  res.json({ success: true, data: actions });
}));

module.exports = router;
